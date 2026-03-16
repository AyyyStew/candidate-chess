# Candidate Chess — Architecture

A chess training app that asks you to find the engine's top 5 moves, Family Feud style — no hints, no eval bar, 3 strikes. Built to train middlegame intuition through deliberate candidate move thinking.

See the [README](./README.md) for a full feature overview.

## Tech Stack

| Layer       | Choice                              |
| ----------- | ----------------------------------- |
| Framework   | React 19 + TypeScript               |
| Build       | Vite                                |
| Routing     | React Router v7                     |
| Styling     | Tailwind CSS v4                     |
| Chess logic | chess.js                            |
| Board UI    | react-chessboard                    |
| Engine      | Stockfish 18 (WASM via Web Workers) |
| Persistence | localStorage (daily stats only)     |
| Backend     | None — fully client-side            |

---

## Project Structure

```
src/
  components/     # UI components
  contexts/       # React contexts (Engine, Board)
  engine/         # Stockfish pool, coordinator, analysis logic
  hooks/          # Custom React hooks
  pages/          # Route-level page components
  services/       # Data fetching and localStorage access
  sessions/       # Game and Study session state managers
  utils/          # Chess utilities, sound
  App.tsx         # Root with routing + EngineProvider
  main.tsx        # React entry point

public/
  stockfish.js    # Stockfish WASM bundle (committed)
  positions/      # Pre-computed position JSON files
    daily/        # One position per day (by year)
    general/      # Random pool (chunked JSON)

position_generation/  # Offline Python pipeline to generate position dataset
  position_extractor.py   # Extract & evaluate positions from PGN files
  position_eval.py        # Deep re-evaluation at higher MultiPV
  position_enrichment.py  # Add phase, category, balance, feature metadata
  position_filter.py      # Heuristic filtering to remove poor puzzles
  chunking.py             # Slim, shuffle, assign dates, split to JSON files
  deploy_positions.py     # Copy output to public/positions/
  LichessEliteDatabase/   # Source PGN files (Lichess Elite Database)
```

---

## Data Flow

### Game Mode (Daily / Random)

```
Page loads
  → positionService fetches position JSON
  → createGameSession(position, engine)
      ├─ EngineAnalysis runs Stockfish on position → topMoves[]
      └─ Session waits for analysis before accepting moves

User drags a piece
  → submitMove(from, to)
      ├─ Validated with chess.js
      ├─ Compared against topMoves (rank ≤ 5 = hit, else miss)
      ├─ Updates candidates[], strikes, hits
      └─ Notifies React via onChange → UI re-renders

Game ends when: strikes === 3 OR all top moves found
  → FamilyFeudBoard reveals remaining moves
  → Daily mode saves result to localStorage
```

### Study Mode

```
User inputs a FEN
  → createStudySession(fen, engine)

User adds candidate moves
  → addCandidate(move)

User clicks "Compare"
  → Engine evaluates each candidate in parallel
  → Assigns quality: Best / Excellent / Good / Inaccuracy / Mistake / Blunder
  → ResultsPanel renders ranked table
```

---

## Engine Architecture

The most complex part of the app. Stockfish runs in Web Workers to avoid blocking the UI.

```
EngineContext (React Context)
  └─ EngineCoordinator
        └─ EnginePool (2 instances: active + standby)
              └─ EngineInstance
                    ├─ analyzeWorker    → getTopMoves() — MultiPV analysis
                    ├─ evaluateWorker   → getPositionEval() — single eval
                    └─ positionWorker   → getMoveWithLine() — move + continuation
```

**Key design: pool rotation.** While a user plays a position, the standby engine pre-analyzes the next one. On advance, active becomes standby, a new standby is spawned, and analysis results are ready immediately.

**EngineCoordinator** is an imperative singleton (not React state). It handles:

- `advance()` — rotate to next position
- `advanceWithPosition(pos)` — analyze a specific position
- `preloadNext()` — background analysis of upcoming position

Each `EngineInstance` has a queued command system (FIFO per worker) and parses raw Stockfish UCI output (`info depth ... score cp ... pv ...` lines).

---

## State Management

This app uses a layered state architecture.

| Layer               | What it manages                                                            |
| ------------------- | -------------------------------------------------------------------------- |
| **React Context**   | Stockfish engine pool (expensive, shared globally)                         |
| **Session objects** | Game/Study session state — imperative JS objects with `onChange` callbacks |
| **Component state** | Local UI (snapshots from sessions, modal visibility, settings)             |
| **localStorage**    | Daily stats (streaks, results history)                                     |

Sessions (`GameSession`, `StudySession`) are plain JS objects — not React state. Pages hold a `useRef` to the session and call `setSnap()` in the `onChange` callback to trigger re-renders when session state changes.

---

## Position Data

Positions are pre-computed JSON files fetched at runtime (no API).

```typescript
{
  fen: string
  tag: "daily" | "general"
  daily_date?: string          // "YYYY-MM-DD" for daily positions
  eval: {
    pvs: [{
      best_move: string        // UCI notation e.g. "e2e4"
      cp: number               // centipawns
      line: string             // full PV line in UCI
    }]
  }
  game: {
    white: string
    black: string
    white_elo: string | number
    black_elo: string | number
    date: string
  }
}
```

Pre-computed PVs mean the engine doesn't need to run from scratch on every load. If PVs are missing, the engine falls back to live analysis at depth 15.

General positions are chunked into 19 JSON files and loaded lazily.

---

## Move Quality Categorization

When evaluating candidates in Study mode:

1. Both the position eval and the post-move eval are fetched from Stockfish (centipawns)
2. Converted to win% using a logistic function: `evalToWinPercent(cp)`
3. Win% drop determines the category:

| Category   | Win% drop                  |
| ---------- | -------------------------- |
| Best       | Same as engine's best move |
| Excellent  | < 1%                       |
| Good       | < 3%                       |
| Inaccuracy | < 7%                       |
| Mistake    | < 15%                      |
| Blunder    | ≥ 15%                      |

---

## Daily Challenge

- One position per day, shared across all users (same FEN per date)
- Stored in `public/positions/daily/[YEAR].json`, keyed by date
- Results saved to localStorage: hits, strikes, won/lost, candidates submitted
- **Streaks** computed by walking backward from today through localStorage entries:
  - Participation streak: consecutive days played
  - Win streak: consecutive days won

---

## Routing

| Route       | Page         | Mode                     |
| ----------- | ------------ | ------------------------ |
| `/`         | DailyPage    | Game — today's position  |
| `/random`   | RandomPage   | Game — random from pool  |
| `/practice` | PracticePage | Game                     |
| `/study`    | StudyPage    | Study — custom FEN input |
| `/about`    | AboutPage    | Static                   |

`EngineProvider` wraps all routes. `positionService.preload()` is called on app mount to start fetching position data early.

---

## Position Generation Pipeline

The positions in `public/positions/` are produced offline by a Python pipeline in [position_generation/](position_generation/). See [position_generation/readme.md](position_generation/readme.md) for full details.

**Source data:** [Lichess Elite Database](https://database.nikonoel.fr) — high-rated OTB and online games in PGN format.

**Pipeline steps:**

```
1. position_extractor.py
   Streams PGN files, samples one position every 2–10 moves per game.
   Keeps moves 5–50 with ≥8 pieces (avoids openings and trivial endgames).
   Runs 7 parallel Stockfish workers at depth 16, MultiPV=5.
   Filters to positions with at least 5 viable moves within tight cp spread.
   Output: training_positions.jsonl

2. position_eval.py
   Re-analyzes each position at depth 16, MultiPV=10 for richer data.
   Output: training_positions_evaluated.jsonl

3. position_enrichment.py
   Adds metadata from the stored PVs (no engine needed):
   - Phase: middlegame / early endgame / endgame (by piece count)
   - Category: dominant / complex / balanced / crushing / defending (by cp spread)
   - Balance: winning / better / equal / worse / losing
   - Features: mobility, captures, checks, blocked_pawns
   - Tag: "daily" (high activity, equal/better positions) or "general"
   Output: training_positions_enriched.jsonl

4. position_filter.py
   Drops poor puzzles: losing positions, locked pawn structures, low tactical activity.
   Output: training_positions_filtered.jsonl

5. chunking.py
   Slims each position to app-required fields, shuffles both pools,
   assigns calendar dates to daily positions starting 2026-01-01,
   splits into static JSON files (daily by year, general in 500-position chunks).
   Output: positions/ directory

6. deploy_positions.py
   Copies positions/ → public/positions/
```

The dataset covers ~8 years of daily puzzles. Extraction is resumable via `progress.json`.

---

## Build & Dev

```bash
npm run dev       # Vite dev server
npm run build     # Production build → dist/
npm run preview   # Preview production build
npm run test      # Vitest unit tests
npm run lint      # ESLint
```

Stockfish WASM (`public/stockfish.js`) is committed directly to the repo — no CDN dependency.
