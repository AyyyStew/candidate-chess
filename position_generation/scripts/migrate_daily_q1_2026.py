"""
One-off migration: Jan–Mar 2026 daily positions → positions.db

Reads public/positions/daily/2026.json, converts positions from 2026-01-01
to 2026-03-31 into the "extracted" format (same as fresh out of extract.py)
and inserts them into positions.db.

Also writes/updates daily_schedule.json — the source of truth mapping
date → Zobrist ID for the daily lookup table.

After running:
  1. Re-evaluate these positions (eval step, depth 20)
  2. Run enrich.py
  3. Run deploy.py to publish chunks
"""

import io
import json
import os
import sys

import chess.pgn

REPO_ROOT    = os.path.join(os.path.dirname(__file__), "..")
DAILY_JSON   = os.path.join(REPO_ROOT, "public", "positions", "daily", "2026.json")
DB_PATH      = os.path.join(os.path.dirname(__file__), "positions.db")
SCHEDULE_PATH = os.path.join(os.path.dirname(__file__), "daily_schedule.json")

START_DATE = "2026-01-01"
END_DATE   = "2026-03-31"

sys.path.insert(0, os.path.dirname(__file__))
from store import db


def piece_count(fen: str) -> int:
    return sum(1 for c in fen.split(" ")[0] if c.isalpha())


def parse_pgn_headers(pgn_str: str) -> dict:
    try:
        game = chess.pgn.read_game(io.StringIO(pgn_str))
        if game:
            return {
                "eco":     game.headers.get("ECO", "?"),
                "opening": game.headers.get("Opening", "?"),
            }
    except Exception:
        pass
    return {"eco": "?", "opening": "?"}


def convert(old: dict) -> dict:
    fen       = old["fen"]
    fen_parts = fen.split(" ")
    side_char = fen_parts[1]
    side      = "white" if side_char == "w" else "black"
    move_num  = int(fen_parts[5])

    game    = old["game"]
    pgn_str = game.get("pgn", "")
    headers = parse_pgn_headers(pgn_str) if pgn_str else {"eco": "?", "opening": "?"}

    source_game = {
        "white":     game["white"],
        "black":     game["black"],
        "white_elo": game["white_elo"],
        "black_elo": game["black_elo"],
        "date":      game["date"],
        "pgn":       pgn_str,
        "eco":       headers["eco"],
        "opening":   headers["opening"],
    }

    old_pvs = old["eval"]["pvs"]
    evals = [{
        "depth":   1,  # placeholder — needs re-evaluation
        "pvs":     [{"cp": pv["cp"], "line": pv["line"], "best_move": pv["best_move"]} for pv in old_pvs],
        "multipv": len(old_pvs),
    }]

    return {
        "id":          old["id"],
        "fen":         fen,
        "move_number": move_num,
        "piece_count": piece_count(fen),
        "side_to_move": side,
        "source_game": source_game,
        "status":      db.STATUS_EXTRACTED,
        "evals":       evals,
        "tag":         "daily",
        "daily_date":  old["daily_date"],
    }


def main():
    with open(DAILY_JSON) as f:
        all_positions = json.load(f)

    positions = [p for p in all_positions if START_DATE <= p["daily_date"] <= END_DATE]
    print(f"Found {len(positions)} daily positions ({START_DATE} → {END_DATE})")

    db.init(DB_PATH)

    converted = [convert(p) for p in positions]
    db.upsert_many(DB_PATH, converted)
    print(f"Inserted {len(converted)} positions into {DB_PATH}")

    # Build schedule entries for this batch
    new_entries = {p["daily_date"]: p["id"] for p in positions}

    # Merge with any existing schedule
    schedule = {}
    if os.path.exists(SCHEDULE_PATH):
        with open(SCHEDULE_PATH) as f:
            schedule = json.load(f)
    schedule.update(new_entries)

    with open(SCHEDULE_PATH, "w") as f:
        json.dump(dict(sorted(schedule.items())), f, indent=2)

    print(f"Updated daily_schedule.json ({len(schedule)} total entries)")
    print(f"\nStatus counts: {db.count_by_status(DB_PATH)}")
    print("\nNext steps:")
    print("  1. Re-eval positions (depth 20)")
    print("  2. python enrich.py")
    print("  3. python deploy.py")


if __name__ == "__main__":
    main()
