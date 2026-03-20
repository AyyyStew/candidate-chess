"""
Enrich step — run whenever enrichment logic changes or new positions arrive.

Reads extracted positions from the DB, enriches them locally (no workers needed),
applies fine filters, and writes results back to the DB.

Usage:
    python enrich.py
    python enrich.py --config /path/to/config.toml
"""

import argparse
import io
import os
import tomllib
from collections import Counter
from concurrent.futures import ProcessPoolExecutor

import chess

import chess.pgn
import chess.polyglot
from tqdm import tqdm

from store import db
from filter import default_fine_filters, run_filters


def load_config(path: str) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


# ── phase detection ─────────────────────────────────────────────────────────
# Based on the Lichess Divider algorithm (chess/Divider.scala).
# We replay the full source PGN to find the opening→middlegame and
# middlegame→endgame transition plies, then map the position's ply into
# whichever phase it falls in.


def _majors_and_minors(board: chess.Board) -> int:
    """Count non-king, non-pawn pieces (knights + bishops + rooks + queens)."""
    return bin(board.occupied & ~board.kings & ~board.pawns).count("1")


def _backrank_sparse(board: chess.Board) -> bool:
    """True when pieces have been developed off the back rank (opening ended)."""
    white_on_rank1 = bin(board.occupied_co[chess.WHITE] & chess.BB_RANK_1).count("1")
    black_on_rank8 = bin(board.occupied_co[chess.BLACK] & chess.BB_RANK_8).count("1")
    return white_on_rank1 < 4 or black_on_rank8 < 4


def _classify_phase_from_board(board: chess.Board) -> str:
    """Fallback single-board phase estimate when no PGN is available."""
    majors = _majors_and_minors(board)
    if majors <= 6:
        return "endgame"
    if majors <= 10 or _backrank_sparse(board):
        return "middlegame"
    return "opening"


def classify_phase(pos: dict) -> str:
    """
    Replay the source PGN to find the game phase at the position's ply.

    Transition rules (from Lichess Divider):
      middlegame starts at the first ply where majors_and_minors <= 10
        OR the back rank is sparse (pieces developed).
      endgame starts at the first ply (after midgame) where majors_and_minors <= 6.
    """
    pgn_str = pos.get("source_game", {}).get("pgn", "")
    move_number = pos["move_number"]
    side = pos["side_to_move"]
    # ply 0 = initial position before any moves
    target_ply = (move_number - 1) * 2 + (0 if side == "white" else 1)

    if pgn_str:
        try:
            game = chess.pgn.read_game(io.StringIO(pgn_str))
            if game is not None:
                board = game.board()
                boards = [board.copy()]
                for move in game.mainline_moves():
                    board.push(move)
                    boards.append(board.copy())

                middle_ply = None
                end_ply = None
                for i, b in enumerate(boards):
                    if middle_ply is None:
                        if _majors_and_minors(b) <= 10 or _backrank_sparse(b):
                            middle_ply = i
                    else:
                        if _majors_and_minors(b) <= 6:
                            end_ply = i
                            break

                if end_ply is not None and target_ply >= end_ply:
                    return "endgame"
                if middle_ply is not None and target_ply >= middle_ply:
                    return "middlegame"
                return "opening"
        except Exception:
            pass

    return _classify_phase_from_board(chess.Board(pos["fen"]))


# ── complexity tags ──────────────────────────────────────────────────────────
# Tags are additive — a position can have multiple simultaneously.
#
#   sharp    — one move clearly best (spread_1_2 >= 75 cp)
#   rich     — moves 2–4 are clustered (good alternatives exist even if sharp)
#   balanced — all top-5 moves within 40 cp of each other
#   active   — high captures/checks available


def classify_complexity(pvs: list, features: dict) -> list[str]:
    scores = [pv["cp"] for pv in pvs[:5] if "cp" in pv]
    if len(scores) < 2:
        return []

    spread_1_2 = abs(scores[0] - scores[1])
    spread_2_4 = abs(scores[1] - scores[3]) if len(scores) > 3 else None
    spread_1_5 = abs(scores[0] - scores[4]) if len(scores) > 4 else None

    tags = []

    if spread_1_2 >= 75:
        tags.append("sharp")

    # Rich: even if best stands out, moves 2-4 are all decent
    if spread_2_4 is not None and spread_2_4 < 50:
        tags.append("rich")

    if spread_1_5 is not None and spread_1_5 < 40:
        tags.append("balanced")

    if features.get("captures", 0) > 3 or features.get("checks", 0) > 2:
        tags.append("active")

    return tags


# ── tactics detection ────────────────────────────────────────────────────────
# Each detector checks a single board state from the perspective of board.turn.
# tag_pv_tactics() walks the full PV line and runs all detectors at each step,
# recording the depth at which each tactic first appears.


def _slider_attacks_ray(piece_type: int, from_sq: int, to_sq: int) -> bool:
    """True if piece_type can attack along the geometric ray from from_sq to to_sq."""
    ff, fr = chess.square_file(from_sq), chess.square_rank(from_sq)
    tf, tr = chess.square_file(to_sq), chess.square_rank(to_sq)
    on_rank_or_file = ff == tf or fr == tr
    on_diagonal = abs(ff - tf) == abs(fr - tr) and ff != tf
    if piece_type == chess.ROOK:
        return on_rank_or_file
    if piece_type == chess.BISHOP:
        return on_diagonal
    if piece_type == chess.QUEEN:
        return on_rank_or_file or on_diagonal
    return False


_PIECE_VALUE = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 99,
}


def _detect_fork(board: chess.Board) -> bool:
    """
    A piece attacks 2+ enemy pieces each worth >= the forking piece.
    Filters out a queen "attacking" two pawns, which is not a real fork.
    """
    color = board.turn
    for sq in chess.scan_forward(board.occupied_co[color] & ~board.kings):
        forker_val = _PIECE_VALUE.get(board.piece_type_at(sq), 0)
        valuable_targets = [
            esq
            for esq in chess.SquareSet(board.attacks(sq)) & board.occupied_co[not color]
            if _PIECE_VALUE.get(board.piece_type_at(esq), 0) >= forker_val
        ]
        if len(valuable_targets) >= 2:
            return True
    return False


def _detect_pin(board: chess.Board) -> bool:
    """Any enemy piece is pinned to its king."""
    enemy_color = not board.turn
    for sq in chess.scan_forward(board.occupied_co[enemy_color] & ~board.kings):
        if board.is_pinned(enemy_color, sq):
            return True
    return False


def _detect_hanging(board: chess.Board) -> bool:
    """An enemy piece worth >= a minor piece is attacked and not defended."""
    color = board.turn
    minor_or_above = {chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING}
    for sq in chess.scan_forward(board.occupied_co[not color]):
        if board.piece_type_at(sq) not in minor_or_above:
            continue
        if board.is_attacked_by(color, sq) and not board.is_attacked_by(not color, sq):
            return True
    return False


def _detect_skewer(board: chess.Board) -> bool:
    """
    A sliding piece attacks a high-value enemy piece with another enemy
    piece behind it on the same ray.
    """
    color = board.turn
    high_value = {chess.QUEEN, chess.ROOK, chess.KING}
    sliders = (
        board.pieces(chess.ROOK, color)
        | board.pieces(chess.BISHOP, color)
        | board.pieces(chess.QUEEN, color)
    )
    for attacker_sq in sliders:
        for victim_sq in board.attacks(attacker_sq) & board.occupied_co[not color]:
            if board.piece_type_at(victim_sq) not in high_value:
                continue
            # Temporarily remove the victim; if the attacker now hits another
            # enemy piece, there was a piece hiding behind the victim.
            victim_piece = board.remove_piece_at(victim_sq)
            hits_behind = bool(
                board.attacks(attacker_sq) & board.occupied_co[not color]
            )
            board.set_piece_at(victim_sq, victim_piece)
            if hits_behind:
                return True
    return False


def _detect_discovered_attack(board: chess.Board) -> bool:
    """
    Moving any piece reveals a sliding piece that attacks a high-value enemy
    (rook, queen, or king). Ignores reveals onto pawns/minors — too common.
    """
    color = board.turn
    high_value = {chess.ROOK, chess.QUEEN, chess.KING}
    sliders = (
        board.pieces(chess.ROOK, color)
        | board.pieces(chess.BISHOP, color)
        | board.pieces(chess.QUEEN, color)
    )
    for move in board.legal_moves:
        from_sq = move.from_square
        own_sliders = sliders & ~chess.BB_SQUARES[from_sq]
        for slider_sq in own_sliders:
            slider_type = board.piece_type_at(slider_sq)
            for enemy_sq in chess.scan_forward(
                board.occupied_co[not color] & ~chess.BB_SQUARES[move.to_square]
            ):
                if board.piece_type_at(enemy_sq) not in high_value:
                    continue
                between = chess.between(slider_sq, enemy_sq)
                if not (between & chess.BB_SQUARES[from_sq]):
                    continue
                if between & board.occupied & ~chess.BB_SQUARES[from_sq]:
                    continue
                if not _slider_attacks_ray(slider_type, slider_sq, enemy_sq):
                    continue
                return True
    return False


_TACTIC_DETECTORS: dict = {
    "fork": _detect_fork,
    "pin": _detect_pin,
    "hanging": _detect_hanging,
    "skewer": _detect_skewer,
    "discovered_attack": _detect_discovered_attack,
}


def _detect_all_tactics(board: chess.Board) -> set[str]:
    return {name for name, fn in _TACTIC_DETECTORS.items() if fn(board)}


def tag_pv_tactics(fen: str, pv: dict) -> list[dict]:
    """
    Walk the full PV line and detect tactics at every step.

    Returns a list of {"type": str, "depth": int} entries — one per
    (tactic, depth) pair found. Depth 0 = the root position itself.
    The same tactic can appear at multiple depths.
    """
    line = pv.get("line", "")
    if not line:
        return []

    board = chess.Board(fen)
    found = []

    for tactic in _detect_all_tactics(board):
        found.append({"type": tactic, "depth": 0})

    for depth, uci in enumerate(line.split(), start=1):
        try:
            board.push(chess.Move.from_uci(uci))
        except Exception:
            break
        for tactic in _detect_all_tactics(board):
            found.append({"type": tactic, "depth": depth})

    return found


# ── enrichment logic ────────────────────────────────────────────────────────


def classify_category(pvs: list, side_to_move: str) -> tuple[str, str, dict]:
    scores = [pv["cp"] for pv in pvs[:5]]
    best = scores[0]

    spread_1_2 = abs(best - scores[1])
    spread_1_3 = abs(best - scores[2]) if len(scores) > 2 else 0
    spread_1_5 = abs(best - scores[4]) if len(scores) > 4 else 0
    spread_2_4 = abs(scores[1] - scores[3]) if len(scores) > 3 else 0

    if best > 300:
        balance = "winning"
    elif best > 100:
        balance = "better"
    elif best > -100:
        balance = "equal"
    elif best > -300:
        balance = "worse"
    else:
        balance = "losing"

    if spread_1_2 >= 75:
        category = "dominant"
    elif spread_1_2 >= 25:
        category = "complex"
    else:
        category = "balanced"

    if best > 300:
        category = "crushing"
    elif best < -300:
        category = "defending"

    return (
        category,
        balance,
        {
            "spread_1_2": spread_1_2,
            "spread_1_3": spread_1_3,
            "spread_1_5": spread_1_5,
            "spread_2_4": spread_2_4,
            "best_cp": best,
        },
    )


def position_features(fen: str) -> dict:
    board = chess.Board(fen)
    mobility = board.legal_moves.count()
    captures = sum(1 for m in board.legal_moves if board.is_capture(m))
    checks = sum(1 for m in board.legal_moves if board.gives_check(m))

    white_pawns = board.pieces(chess.PAWN, chess.WHITE)
    black_pawns = board.pieces(chess.PAWN, chess.BLACK)

    white_blocked = sum(1 for sq in white_pawns if sq + 8 in black_pawns)
    black_blocked = sum(1 for sq in black_pawns if sq - 8 in white_pawns)
    blocked_pawns = white_blocked + black_blocked

    pawn_tension = 0
    for sq in white_pawns:
        for cap_sq in board.attacks(sq):
            if cap_sq in black_pawns:
                pawn_tension += 1
    for sq in black_pawns:
        for cap_sq in board.attacks(sq):
            if cap_sq in white_pawns:
                pawn_tension += 1

    return {
        "mobility": mobility,
        "captures": captures,
        "checks": checks,
        "blocked_pawns": blocked_pawns,
        "pawn_tension": pawn_tension,
    }


def tag_position(pos: dict) -> str:
    features = pos["features"]
    if (
        features["mobility"] > 30
        and features["captures"] > 1
        and pos["move_number"] < 25
        and features["blocked_pawns"] < 3
        and pos["balance"] in ("equal", "better", "winning")
    ):
        return "daily"
    return "general"


# Max PV depth at which each tactic is surfaced to the position level.
# Hanging is only meaningful right now (depth 0); structural tactics can develop.
TACTIC_POSITION_DEPTHS: dict[str, int] = {
    "fork": 5,
    "pin": 5,
    "skewer": 5,
    "discovered_attack": 5,
    "hanging": 0,
}


def enrich(pos: dict) -> dict | None:
    best_eval = max(pos.get("evals", []), key=lambda e: e.get("depth", 0), default={})
    pvs = best_eval.get("pvs", [])

    # Only use PVs with cp scores for evaluation (mate scores are fine elsewhere)
    cp_pvs = [pv for pv in pvs if "cp" in pv]
    if len(cp_pvs) < 2:
        return None

    phase = classify_phase(pos)
    category, balance, spreads = classify_category(cp_pvs, pos["side_to_move"])
    features = position_features(pos["fen"])
    complexity = classify_complexity(cp_pvs, features)

    # Annotate every PV with full-depth tactics, but only surface shallow ones
    # at the position level (depth <= TACTIC_POSITION_DEPTH = clean signal)
    all_tactics: list[dict] = []
    for pv in pvs:
        pv_tactics = tag_pv_tactics(pos["fen"], pv)
        pv["tactics"] = pv_tactics
        all_tactics.extend(pv_tactics)

    position_tactics = sorted(
        {
            t["type"]
            for t in all_tactics
            if t["depth"] <= TACTIC_POSITION_DEPTHS.get(t["type"], 5)
        }
    )

    pos["phase"] = phase
    pos["eco"] = pos.get("source_game", {}).get("eco", "?")
    pos["opening_name"] = pos.get("source_game", {}).get("opening", "?")
    pos["category"] = category
    pos["balance"] = balance
    pos["spreads"] = spreads
    pos["features"] = features
    pos["complexity"] = complexity
    pos["tactics"] = position_tactics
    pos["tag"] = tag_position({**pos, "balance": balance, "features": features})

    return pos


# ── main ───────────────────────────────────────────────────────────────────────


def run(config_path: str):
    cfg = load_config(config_path)
    db_path = cfg["store"]["db_path"]

    db.init(db_path)

    positions = db.get_all(db_path)
    print(f"Positions to enrich: {len(positions)}")

    fine_filters = default_fine_filters()
    workers = cfg.get("enrich", {}).get("workers", os.cpu_count())
    print(f"Workers: {workers}")

    enriched = []
    discarded = []
    skipped_positions = []
    reject_reasons: Counter = Counter()

    with ProcessPoolExecutor(max_workers=workers) as executor:
        results = tqdm(
            zip(positions, executor.map(enrich, positions)),
            total=len(positions),
            desc="Enriching",
            unit="pos",
        )
        for pos, result in results:
            if result is None:
                skipped_positions.append(pos)
                continue

            passed, reason = run_filters(result, fine_filters)
            if passed:
                result["status"] = db.STATUS_FINE_FILTER_PASSED
                enriched.append(result)
            else:
                result["status"] = db.STATUS_FINE_FILTER_FAILED
                result["discard_reason"] = reason
                discarded.append(result)
                reject_reasons[reason] += 1

    db.upsert_many(db_path, enriched)
    db.upsert_many(db_path, discarded)

    skipped = len(skipped_positions)
    total = len(enriched) + len(discarded) + skipped
    print(f"\nInput:    {total}")
    print(f"Enriched: {len(enriched)}")
    print(f"Discarded:{len(discarded)}  {dict(reject_reasons)}")
    print(f"Skipped:  {skipped}  (< 2 cp pvs)")

    if skipped_positions:
        print(f"\n-- Skipped sample (first 5) --")
        for pos in skipped_positions[:5]:
            best_eval = max(
                pos.get("evals", []), key=lambda e: e.get("depth", 0), default={}
            )
            pvs = best_eval.get("pvs", [])
            pv_summary = [{"cp": p.get("cp"), "mate": p.get("mate")} for p in pvs[:5]]
            print(f"  {pos['id']}  move={pos['move_number']}  pvs={pv_summary}")

    if enriched:
        tags = Counter(p["tag"] for p in enriched)
        phases = Counter(p["phase"] for p in enriched)
        balances = Counter(p["balance"] for p in enriched)
        complexity_counts = Counter(
            tag for p in enriched for tag in p.get("complexity", [])
        )
        tactics_counts = Counter(t for p in enriched for t in p.get("tactics", []))
        print(f"\nTags:       {dict(tags)}")
        print(f"Phase:      {dict(phases)}")
        print(f"Balance:    {dict(balances)}")
        print(f"Complexity: {dict(complexity_counts)}")
        print(f"Tactics:    {dict(tactics_counts)}")

    print(f"\n{db.count_by_status(db_path)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PIPELINE_CONFIG", os.path.join(os.path.dirname(__file__), "config.toml")
        ),
    )
    args = parser.parse_args()
    run(args.config)
