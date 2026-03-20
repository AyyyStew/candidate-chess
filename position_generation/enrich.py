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
import time
import tomllib
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from functools import lru_cache

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


@lru_cache(maxsize=512)
def _pgn_phase_plies(pgn_str: str) -> tuple[int | None, int | None] | None:
    """
    Replay a PGN once and return (middle_ply, end_ply). Result is cached per
    unique PGN string so multiple positions from the same game pay this cost once.
    Returns None on parse failure.
    """
    try:
        game = chess.pgn.read_game(io.StringIO(pgn_str))
        if game is None:
            return None
        board = game.board()
        middle_ply = None
        end_ply = None
        for i, move in enumerate(game.mainline_moves()):
            if middle_ply is None:
                if _majors_and_minors(board) <= 10 or _backrank_sparse(board):
                    middle_ply = i
            else:
                if _majors_and_minors(board) <= 6:
                    end_ply = i
                    break
            board.push(move)
        return middle_ply, end_ply
    except Exception:
        return None


def classify_phase(pos: dict) -> str:
    """
    Map the position's ply to opening / middlegame / endgame using the
    Lichess Divider algorithm. Falls back to a board-only estimate when
    no source PGN is available or parsing fails.
    """
    pgn_str = pos.get("source_game", {}).get("pgn", "")
    move_number = pos["move_number"]
    side = pos["side_to_move"]
    target_ply = (move_number - 1) * 2 + (0 if side == "white" else 1)

    if pgn_str:
        result = _pgn_phase_plies(pgn_str)
        if result is not None:
            middle_ply, end_ply = result
            if end_ply is not None and target_ply >= end_ply:
                return "endgame"
            if middle_ply is not None and target_ply >= middle_ply:
                return "middlegame"
            return "opening"

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

    t0 = time.perf_counter()
    phase = classify_phase(pos)
    t_phase = time.perf_counter() - t0

    t0 = time.perf_counter()
    category, balance, spreads = classify_category(cp_pvs, pos["side_to_move"])
    features = position_features(pos["fen"])
    complexity = classify_complexity(cp_pvs, features)
    t_classify = time.perf_counter() - t0

    pos["phase"] = phase
    pos["eco"] = pos.get("source_game", {}).get("eco", "?")
    pos["opening_name"] = pos.get("source_game", {}).get("opening", "?")
    pos["category"] = category
    pos["balance"] = balance
    pos["spreads"] = spreads
    pos["features"] = features
    pos["complexity"] = complexity
    pos["tag"] = tag_position({**pos, "balance": balance, "features": features})
    pos["_timings"] = {"phase": t_phase, "classify": t_classify}

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
    timing_totals: Counter = Counter()

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

            timings = result.pop("_timings", {})
            for k, v in timings.items():
                timing_totals[k] += v

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

    processed = len(enriched) + len(discarded)
    if processed > 0 and timing_totals:
        t_total = sum(timing_totals.values())
        print("\n── Timing breakdown (total wall, all workers) ──")
        for step, t in sorted(timing_totals.items(), key=lambda x: -x[1]):
            pct = 100 * t / t_total
            avg_ms = 1000 * t / processed
            print(f"  {step:<12} {t:6.1f}s  {pct:5.1f}%  avg {avg_ms:.1f}ms/pos")
        print(f"  {'TOTAL':<12} {t_total:6.1f}s  100.0%")

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
        print(f"\nTags:       {dict(tags)}")
        print(f"Phase:      {dict(phases)}")
        print(f"Balance:    {dict(balances)}")
        print(f"Complexity: {dict(complexity_counts)}")

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
