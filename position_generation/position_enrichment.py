import json
import chess
from collections import Counter


# ── classifiers ───────────────────────────────────────────────────────────────


def classify_phase(piece_count):
    if piece_count > 20:
        return "middlegame"
    elif piece_count >= 10:
        return "early_endgame"
    else:
        return "endgame"


def classify_category(pvs, side_to_move):
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

    return (
        category,
        balance,
        {
            "spread_1_2": spread_1_2,
            "spread_1_3": spread_1_3,
            "spread_1_5": spread_1_5,
            "best_cp": best,
        },
    )


def position_features(fen):
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


def tag_position(pos):
    mobility = pos["features"]["mobility"]
    captures = pos["features"]["captures"]
    move_num = pos["move_number"]
    blocked = pos["features"]["blocked_pawns"]
    balance = pos["balance"]

    if (
        mobility > 30
        and captures > 1
        and move_num < 25
        and blocked < 3
        and balance in ("equal", "better", "winning")
    ):
        return "daily"
    else:
        return "general"


def enrich(pos):
    pvs = pos["eval"]["pvs"]
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
    pos["tag"] = tag_position(pos)

    return pos


# ── main ──────────────────────────────────────────────────────────────────────


def run(
    input_file="training_positions.jsonl",
    output_file="training_positions_enriched.jsonl",
):
    positions = []
    skipped = 0

    with open(input_file) as f:
        for line in f:
            if not line.strip():
                continue
            try:
                pos = json.loads(line)
                enriched = enrich(pos)
                if enriched:
                    positions.append(enriched)
                else:
                    skipped += 1
            except (json.JSONDecodeError, Exception):
                skipped += 1

    print(f"Enriched: {len(positions)} | Skipped: {skipped}")

    tags = Counter(p["tag"] for p in positions)
    phases = Counter(p["phase"] for p in positions)
    categories = Counter(p["category"] for p in positions)
    balances = Counter(p["balance"] for p in positions)

    print(f"\nTags:     {dict(tags)}")
    print(f"Phase:    {dict(phases)}")
    print(f"Category: {dict(categories)}")
    print(f"Balance:  {dict(balances)}")

    print(f"\nDaily breakdown:")
    daily = [p for p in positions if p["tag"] == "daily"]
    print(f"  Phase:    {dict(Counter(p['phase'] for p in daily))}")
    print(f"  Category: {dict(Counter(p['category'] for p in daily))}")
    print(f"  Balance:  {dict(Counter(p['balance'] for p in daily))}")

    with open(output_file, "w") as f:
        for pos in positions:
            f.write(json.dumps(pos) + "\n")

    print(f"\nSaved to {output_file}")


if __name__ == "__main__":
    run()
