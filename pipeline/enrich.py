"""
Enrich step — run whenever enrichment logic changes or new positions arrive.

Reads extracted positions from the DB, enriches them locally (no workers needed),
applies fine filters, and writes results back to the DB.

Usage:
    python enrich.py
    python enrich.py --config /path/to/config.toml
"""

import argparse
import os
import tomllib
from collections import Counter

import chess
import chess.polyglot

from store import db
from filter import default_fine_filters, run_filters


def load_config(path: str) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


# ── enrichment logic ───────────────────────────────────────────────────────────


def classify_phase(piece_count: int) -> str:
    if piece_count > 20:
        return "middlegame"
    elif piece_count >= 10:
        return "early_endgame"
    else:
        return "endgame"


def classify_category(pvs: list, side_to_move: str) -> tuple[str, str, dict]:
    scores = [pv["cp"] for pv in pvs[:5]]
    best = scores[0]

    spread_1_2 = abs(best - scores[1])
    spread_1_3 = abs(best - scores[2]) if len(scores) > 2 else 0
    spread_1_5 = abs(best - scores[4]) if len(scores) > 4 else 0

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

    return category, balance, {
        "spread_1_2": spread_1_2,
        "spread_1_3": spread_1_3,
        "spread_1_5": spread_1_5,
        "best_cp": best,
    }


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
    pvs = max(pos.get("evals", []), key=lambda e: e.get("depth", 0), default={}).get("pvs", [])
    if not all("cp" in pv for pv in pvs[:5]):
        return None

    phase = classify_phase(pos["piece_count"])
    category, balance, spreads = classify_category(pvs, pos["side_to_move"])
    features = position_features(pos["fen"])

    pos["phase"] = phase
    pos["category"] = category
    pos["balance"] = balance
    pos["spreads"] = spreads
    pos["features"] = features
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

    enriched = []
    discarded = []
    reject_reasons: Counter = Counter()
    skipped = 0

    for pos in positions:
        result = enrich(pos)
        if result is None:
            skipped += 1
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

    total = len(enriched) + len(discarded) + skipped
    print(f"\nInput:    {total}")
    print(f"Enriched: {len(enriched)}")
    print(f"Discarded:{len(discarded)}  {dict(reject_reasons)}")
    print(f"Skipped:  {skipped}  (bad eval data)")

    if enriched:
        tags = Counter(p["tag"] for p in enriched)
        phases = Counter(p["phase"] for p in enriched)
        balances = Counter(p["balance"] for p in enriched)
        print(f"\nTags:    {dict(tags)}")
        print(f"Phase:   {dict(phases)}")
        print(f"Balance: {dict(balances)}")

    print(f"\n{db.count_by_status(db_path)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=os.environ.get("PIPELINE_CONFIG", os.path.join(os.path.dirname(__file__), "config.toml")))
    args = parser.parse_args()
    run(args.config)
