"""
Deploy positions from positions.db to public/positions/chunks/.

Positions are grouped by the first hex digit of their Zobrist ID (16 buckets).
Only fine_filter_passed positions are deployed.

Usage:
    python deploy.py
    python deploy.py --db /path/to/positions.db
"""

import argparse
import json
import os
import sqlite3
from collections import defaultdict

DB_PATH       = os.path.join(os.path.dirname(__file__), "positions.db")
OUT_DIR       = os.path.join(os.path.dirname(__file__), "..", "public", "positions", "chunks")
SCHEDULE_SRC  = os.path.join(os.path.dirname(__file__), "daily_schedule.json")
SCHEDULE_DEST = os.path.join(os.path.dirname(__file__), "..", "public", "positions", "daily_schedule.json")


def load_passed(db_path: str) -> list[dict]:
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT data FROM positions WHERE status = 'fine_filter_passed'"
    ).fetchall()
    conn.close()
    return [json.loads(row[0]) for row in rows]


def deploy(db_path: str, out_dir: str):
    positions = load_passed(db_path)
    print(f"Loaded {len(positions)} passed positions from {db_path}")

    buckets: dict[str, list[dict]] = defaultdict(list)
    for pos in positions:
        prefix = pos["id"][0]
        buckets[prefix].append(pos)

    os.makedirs(out_dir, exist_ok=True)

    for prefix in sorted(buckets):
        chunk = buckets[prefix]
        out_path = os.path.join(out_dir, f"{prefix}.json")
        with open(out_path, "w") as f:
            json.dump(chunk, f)
        print(f"  {prefix}.json  ({len(chunk)} positions)")

    total = sum(len(v) for v in buckets.values())
    print(f"\nTotal: {total} positions across {len(buckets)} chunks")

    # Publish daily schedule
    if os.path.exists(SCHEDULE_SRC):
        import shutil
        shutil.copy2(SCHEDULE_SRC, SCHEDULE_DEST)
        with open(SCHEDULE_SRC) as f:
            schedule = json.load(f)
        print(f"Published daily_schedule.json ({len(schedule)} entries)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=DB_PATH)
    args = parser.parse_args()
    deploy(args.db, OUT_DIR)
