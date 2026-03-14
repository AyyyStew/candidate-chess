# Chess Position Dataset Pipeline

A data pipeline that extracts, evaluates, and categorizes chess positions from the
Lichess Elite Database for use in a Family Feud-style chess candidate move training app.

---

## Source Data

**Lichess Elite Database** — https://database.nikonoel.fr

---

## Pipeline Overview

### 1. Position Extraction (`position_extractor.py`)

Streams PGN files and samples positions from each game using a random move interval
(2-10 moves between samples). Filters to moves 13-60 with at least 7 pieces remaining
to stay out of opening theory and trivial endgames.

Runs 7 parallel Stockfish 18 workers (AVX2, 2 threads each) that stay alive across
files via a shared task queue. A background extraction thread pre-fetches the next
file while workers evaluate the current one. Progress is saved after each file so
the run is resumable.

Each position is evaluated at depth 16 with MultiPV=5 and must pass a viability
filter to be kept:

- At least 5 moves with centipawn scores (no forced mates in top 3)
- Position not already decided (best move within ±900cp)
- Move 2-3 within 150cp of best
- Move 4 within 200cp of best
- Move 5 within 300cp of best

Output: `training_positions.jsonl`

---

### 2. Enrichment (`position_enrichment.py`)

Adds metadata to each position:

**Phase** — based on piece count

- Middlegame: >20 pieces
- Early endgame: 10-20 pieces
- Endgame: <10 pieces

**Category** — based on centipawn spread between moves

- `dominant` — spread_1_2 ≥ 75cp, clear best move
- `complex` — spread_1_2 25-75cp, slight preference
- `balanced` — spread_1_2 <25cp, all moves close
- `crushing` — best move >+300cp
- `defending` — best move <-300cp

**Balance** — evaluation of best move from side to move  
`winning / better / equal / worse / losing`

**Position features** — computed via python-chess

- `mobility` — number of legal moves
- `captures` — captures available
- `checks` — checks available
- `blocked_pawns` — locked pawn structure indicator

**Tag** — intended use case

- `daily` — mobility >30, captures >1, move <25, blocked pawns <3, balance = equal/better/winning
- `general` — everything else

Output: `training_positions_enriched.jsonl`

---

### 3. Chunking (`chunking.py`)

Slims each position to fields needed by the React app, shuffles both pools
(seed=42 for reproducibility), assigns calendar dates to daily positions
starting January 1 2026, then splits into static JSON files.

**Slim fields kept:**

- `fen` — position
- `tag` — daily or general
- `eval.pvs` — top 5 moves with best_move, cp, line
- `game` — white, black, white_elo, black_elo, date
- `daily_date` — assigned calendar date (daily positions only)

**Output structure:**

```
positions/
  daily/
    2026.json    (~365 positions)
    2027.json    (~365 positions)
    ...
  general/
    000.json     (500 positions)
    001.json     (500 positions)
    ...
```

---

## Dataset Stats (v1)

|                 | Count  |
| --------------- | ------ |
| Total positions | 12,483 |
| Daily pool      | 3,022  |
| General pool    | 9,461  |
| Avg move number | 27.8   |
| Move range      | 13-60  |
| White to move   | 6,341  |
| Black to move   | 6,142  |
| Avg piece count | 20.7   |

---

## Environment

- Python 3.x
- python-chess
- Stockfish 18 AVX2 (Windows)
- Source: Lichess Elite Database

---

## Notes

- Pipeline is resumable via `progress.json` — tracks completed files and total kept
- Daily positions are shuffled before date assignment so positions from different
  years are distributed evenly across the calendar
- Dataset covers ~8 years of daily puzzles (through ~2034)
- Configs are in the scripts themselves. Make sure to change them if you run them
