"""One-time migration: add Zobrist id to training_positions_evaluated.jsonl"""
import json
import chess
import chess.polyglot

FILE = "training_positions_evaluated.jsonl"

with open(FILE) as f:
    positions = [json.loads(l) for l in f if l.strip()]

for pos in positions:
    pos["id"] = f"{chess.polyglot.zobrist_hash(chess.Board(pos['fen'])):016x}"

with open(FILE, "w") as f:
    for pos in positions:
        f.write(json.dumps(pos) + "\n")

print(f"Done. Added ids to {len(positions)} positions.")
