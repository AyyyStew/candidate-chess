import json
from collections import Counter


def passes_filter(pos, reject_balance, locked_blocked_min, locked_tension_floor, min_tactical_activity):
    balance = pos.get("balance", "")
    features = pos.get("features", {})

    captures = features.get("captures", 0)
    checks = features.get("checks", 0)
    blocked = features.get("blocked_pawns", 0)
    tension = features.get("pawn_tension", 0)

    if balance in reject_balance:
        return False, "losing"

    if blocked >= locked_blocked_min and tension <= locked_tension_floor:
        return False, "locked_pawns"

    if captures + checks < min_tactical_activity:
        return False, "low_activity"

    return True, "ok"


# ── main ──────────────────────────────────────────────────────────────────────


def run(
    input_file="training_positions_enriched.jsonl",
    output_file="training_positions_filtered.jsonl",
    reject_balance=None,
    locked_blocked_min=6,
    locked_tension_floor=0,
    min_tactical_activity=2,
):
    if reject_balance is None:
        reject_balance = {"losing"}

    kept = []
    reject_reasons = Counter()

    with open(input_file) as f:
        for line in f:
            if not line.strip():
                continue
            try:
                pos = json.loads(line)
                ok, reason = passes_filter(
                    pos, reject_balance, locked_blocked_min, locked_tension_floor, min_tactical_activity
                )
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

    with open(output_file, "w") as f:
        for pos in kept:
            f.write(json.dumps(pos) + "\n")

    print(f"\nSaved to {output_file}")


if __name__ == "__main__":
    run()
