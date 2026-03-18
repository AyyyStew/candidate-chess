import json
import os
import random
from datetime import date, timedelta


def slim(pos):
    return {
        "fen": pos["fen"],
        "tag": pos["tag"],
        "eval": {
            "pvs": [
                {k: v for k, v in pv.items() if k in ("best_move", "cp", "line")}
                for pv in pos["eval"]["pvs"]
            ]
        },
        "game": {
            "white": pos["source_game"]["white"],
            "black": pos["source_game"]["black"],
            "white_elo": pos["source_game"]["white_elo"],
            "black_elo": pos["source_game"]["black_elo"],
            "date": pos["source_game"]["date"],
            "pgn": pos["source_game"]["pgn"],
        },
    }


def run(
    input_file="training_positions_evaluated.jsonl",
    output_dir="positions",
    general_chunk_size=500,
    seed=42,
    daily_years=5,
):
    random.seed(seed)

    with open(input_file) as f:
        positions = [json.loads(l) for l in f if l.strip()]

    daily_all = [slim(p) for p in positions if p["tag"] == "daily"]
    general = [slim(p) for p in positions if p["tag"] == "general"]

    random.shuffle(daily_all)
    random.shuffle(general)

    daily_cap = daily_years * 365
    daily = daily_all[:daily_cap]
    general = daily_all[daily_cap:] + general
    random.shuffle(general)

    print(f"Daily pool:   {len(daily_all)} → capped at {len(daily)}, {len(daily_all) - len(daily)} moved to general")

    start_date = date(2026, 1, 1)
    for i, pos in enumerate(daily):
        pos["daily_date"] = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")

    daily_by_year = {}
    for pos in daily:
        year = pos["daily_date"][:4]
        daily_by_year.setdefault(year, []).append(pos)

    daily_dir = os.path.join(output_dir, "daily")
    os.makedirs(daily_dir, exist_ok=True)

    for year, year_positions in sorted(daily_by_year.items()):
        path = os.path.join(daily_dir, f"{year}.json")
        with open(path, "w") as f:
            json.dump(year_positions, f)
        size_kb = os.path.getsize(path) / 1024
        print(f"  daily/{year}.json — {len(year_positions)} positions ({size_kb:.1f}kb)")

    general_dir = os.path.join(output_dir, "general")
    os.makedirs(general_dir, exist_ok=True)

    chunks = [
        general[i : i + general_chunk_size]
        for i in range(0, len(general), general_chunk_size)
    ]
    for i, chunk in enumerate(chunks):
        path = os.path.join(general_dir, f"{i:03d}.json")
        with open(path, "w") as f:
            json.dump(chunk, f)
        size_kb = os.path.getsize(path) / 1024
        print(f"  general/{i:03d}.json — {len(chunk)} positions ({size_kb:.1f}kb)")

    print(f"\nDone.")
    print(f"  Daily:   {len(daily)} positions across {len(daily_by_year)} years")
    print(f"  General: {len(general)} positions across {len(chunks)} chunks ({len(daily_all) - len(daily)} surplus dailies included)")


if __name__ == "__main__":
    run()
