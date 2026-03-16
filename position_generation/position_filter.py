import json
from collections import Counter

INPUT_FILE = "training_positions_enriched.jsonl"
OUTPUT_FILE = "training_positions_filtered.jsonl"

# ── thresholds ────────────────────────────────────────────────────────────────

# Drop positions where the side to move is this far behind.
# "losing" = best_cp < -300, "worse" = -300 to -100.
REJECT_BALANCE = {"losing"}

# A pawn structure is considered locked when blocked_pawns (both sides combined)
# is at or above this value AND pawn_tension is at or below the tension floor.
# Positions with active pawn breaks (tension > LOCKED_TENSION_FLOOR) are kept
# even if many pawns face each other.
LOCKED_BLOCKED_MIN = 6
LOCKED_TENSION_FLOOR = 0

# Minimum combined checks + captures available to the side to move.
# Ensures there is something happening tactically.
MIN_TACTICAL_ACTIVITY = 2

# ── filter ────────────────────────────────────────────────────────────────────


def passes_filter(pos):
    balance = pos.get("balance", "")
    features = pos.get("features", {})

    captures = features.get("captures", 0)
    checks = features.get("checks", 0)
    blocked = features.get("blocked_pawns", 0)
    tension = features.get("pawn_tension", 0)

    if balance in REJECT_BALANCE:
        return False, "losing"

    if blocked >= LOCKED_BLOCKED_MIN and tension <= LOCKED_TENSION_FLOOR:
        return False, "locked_pawns"

    if captures + checks < MIN_TACTICAL_ACTIVITY:
        return False, "low_activity"

    return True, "ok"


# ── main ──────────────────────────────────────────────────────────────────────


def run():
    kept = []
    reject_reasons = Counter()

    with open(INPUT_FILE) as f:
        for line in f:
            if not line.strip():
                continue
            try:
                pos = json.loads(line)
                ok, reason = passes_filter(pos)
                if ok:
                    kept.append(pos)
                else:
                    reject_reasons[reason] += 1
            except (json.JSONDecodeError, Exception):
                reject_reasons["parse_error"] += 1

    total_in = len(kept) + sum(reject_reasons.values())
    print(f"Input:    {total_in}")
    print(f"Kept:     {len(kept)}  ({100*len(kept)/total_in:.1f}%)")
    print(f"Rejected: {sum(reject_reasons.values())}")
    for reason, count in reject_reasons.most_common():
        print(f"  {reason}: {count}")

    print(f"\nKept breakdown:")
    print(f"  Balance:  {dict(Counter(p['balance'] for p in kept))}")
    print(f"  Phase:    {dict(Counter(p['phase'] for p in kept))}")
    print(f"  Category: {dict(Counter(p['category'] for p in kept))}")
    print(f"  Tag:      {dict(Counter(p['tag'] for p in kept))}")

    with open(OUTPUT_FILE, "w") as f:
        for pos in kept:
            f.write(json.dumps(pos) + "\n")

    print(f"\nSaved to {OUTPUT_FILE}")


if __name__ == "__main__":
    run()
