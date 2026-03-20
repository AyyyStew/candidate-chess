"""
Add one month of daily positions to daily_schedule.json.

Picks fine_filter_passed positions tagged "daily" that haven't been scheduled
yet, assigns one per day for the next calendar month after the last scheduled
date, and updates daily_schedule.json.

Usage:
    python schedule_next_month.py              # auto-detect next month
    python schedule_next_month.py --month 2026-05  # explicit month
    python schedule_next_month.py --dry-run    # preview without writing
"""

import argparse
import calendar
import json
import os
import random
import sqlite3
import sys
from datetime import date

DB_PATH       = os.path.join(os.path.dirname(__file__), "positions.db")
SCHEDULE_PATH = os.path.join(os.path.dirname(__file__), "daily_schedule.json")


def load_schedule() -> dict[str, str]:
    if not os.path.exists(SCHEDULE_PATH):
        return {}
    with open(SCHEDULE_PATH) as f:
        return json.load(f)


def next_month_after(schedule: dict[str, str]) -> tuple[int, int]:
    """Return (year, month) for the calendar month after the last scheduled date."""
    if not schedule:
        today = date.today()
        return today.year, today.month
    last = max(schedule.keys())
    y, m, _ = (int(x) for x in last.split("-"))
    m += 1
    if m > 12:
        m, y = 1, y + 1
    return y, m


def days_in_month(year: int, month: int) -> list[str]:
    _, n = calendar.monthrange(year, month)
    return [date(year, month, d).isoformat() for d in range(1, n + 1)]


def load_available(db_path: str, already_used: set[str]) -> list[str]:
    """Return IDs of fine_filter_passed daily-tagged positions not yet scheduled."""
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        """
        SELECT id FROM positions
        WHERE status = 'fine_filter_passed'
          AND json_extract(data, '$.tag') = 'daily'
        """
    ).fetchall()
    conn.close()
    return [row[0] for row in rows if row[0] not in already_used]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--month",   help="YYYY-MM to schedule (default: auto)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    schedule = load_schedule()
    already_used = set(schedule.values())

    if args.month:
        try:
            y, m = (int(x) for x in args.month.split("-"))
        except ValueError:
            print(f"Bad --month value '{args.month}', expected YYYY-MM")
            sys.exit(1)
    else:
        y, m = next_month_after(schedule)

    days = days_in_month(y, m)

    # Check none of these days are already scheduled
    already_scheduled = [d for d in days if d in schedule]
    if already_scheduled:
        print(f"Warning: {len(already_scheduled)} day(s) already in schedule — they will be overwritten")

    available = load_available(DB_PATH, already_used)
    if len(available) < len(days):
        print(f"Not enough positions: need {len(days)}, have {len(available)}")
        sys.exit(1)

    picked = random.sample(available, len(days))
    new_entries = dict(zip(days, picked))

    print(f"Scheduling {calendar.month_name[m]} {y} ({len(days)} days)")
    for day, pos_id in new_entries.items():
        print(f"  {day}  {pos_id}")

    if args.dry_run:
        print("\nDry run — nothing written.")
        return

    schedule.update(new_entries)
    with open(SCHEDULE_PATH, "w") as f:
        json.dump(dict(sorted(schedule.items())), f, indent=2)

    print(f"\nUpdated daily_schedule.json ({len(schedule)} total entries)")
    print(f"Pool remaining: {len(available) - len(days)} unscheduled daily positions")


if __name__ == "__main__":
    main()
