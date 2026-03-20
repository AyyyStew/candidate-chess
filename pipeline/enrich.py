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
from utils.cook import cook as cook_puzzle
from utils.model import Puzzle


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


# ── tactics via lichess cook ─────────────────────────────────────────────────
# Tags produced by cook() that aren't useful at the position level.
_EXCLUDED_TAGS = {
    "mate", "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5",
    "oneMove", "short", "long", "veryLong",
}


def build_puzzle(pos: dict, pv: dict) -> Puzzle | None:
    """
    Build a lichess-compatible Puzzle from a position + single PV.

    Prepends the move that led TO this position so the game tree matches
    the lichess convention: opponent move first, pov moves at mainline[1::2].
    Falls back to a direct build with field override when no prior move exists.
    """
    line = pv.get("line", "")
    cp = pv.get("cp", 0)
    if not line:
        return None

    pgn_str = pos.get("source_game", {}).get("pgn", "")
    move_number = pos["move_number"]
    side = pos["side_to_move"]
    target_ply = (move_number - 1) * 2 + (0 if side == "white" else 1)

    try:
        if pgn_str and target_ply > 0:
            src_game = chess.pgn.read_game(io.StringIO(pgn_str))
            if src_game is None:
                return None
            src_moves = list(src_game.mainline_moves())
            if target_ply - 1 >= len(src_moves):
                return None

            board = src_game.board()
            for m in src_moves[:target_ply - 1]:
                board.push(m)
            preceding_move = src_moves[target_ply - 1]

            # Snapshot as clean FEN — from_board() replays the move stack,
            # so passing the original board would include all historical moves.
            new_game = chess.pgn.Game.from_board(chess.Board(board.fen()))
            node = new_game.add_main_variation(preceding_move)
            board.push(preceding_move)
        else:
            board = chess.Board(pos["fen"])
            new_game = chess.pgn.Game.from_board(board)
            node = new_game

        for uci in line.split():
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                break
            node = node.add_main_variation(move)
            board.push(move)

        puzzle = Puzzle(id=pos["id"], game=new_game, cp=cp)

        # Fallback: no prior move means pov is inverted by __post_init__ — fix it
        if not (pgn_str and target_ply > 0):
            puzzle.pov = chess.WHITE if side == "white" else chess.BLACK
            puzzle.mainline = [new_game] + list(new_game.mainline())  # type: ignore[list-item]

        return puzzle
    except Exception:
        return None


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

    # Tag each PV line using lichess cook, aggregate to position level
    all_tags: set[str] = set()
    for pv in pvs:
        puzzle = build_puzzle(pos, pv)
        pv_tags = [t for t in cook_puzzle(puzzle) if t not in _EXCLUDED_TAGS] if puzzle else []
        pv["tactics"] = pv_tags
        all_tags.update(pv_tags)

    position_tactics = sorted(all_tags)

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
