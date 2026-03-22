# Candidate Chess — Architecture

A chess training app that asks you to find the engine's top 5 moves, Family Feud style — no hints, no eval bar, 3 strikes. Built to train middlegame intuition through deliberate candidate move thinking.

See the [README](./README.md) for a full feature overview.

## Tech Stack

| Layer       | Choice                            |
| ----------- | --------------------------------- |
| Framework   | React 19 + TypeScript             |
| Build       | Vite                              |
| Routing     | React Router v7                   |
| Styling     | Tailwind CSS v4                   |
| Chess logic | chess.js                          |
| Board UI    | Chessground                       |
| Engine      | Stockfish 18 (WASM and Local)     |
| Persistence | localStorage (daily stats) + D1   |
| Backend     | Cloudflare Workers + Hono         |
| Database    | Cloudflare D1 (SQLite) + Drizzle  |
| Auth        | Google + Lichess OAuth via arctic |

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
  extract.py              # Extract positions from PGN files, cheap eval via Celery workers
  enrich.py               # Local enrichment: phase, category, features, fine filter
  eval.py                 # Deep re-evaluation at higher depth/MultiPV via Celery workers
  tactics.py              # Tactic tagging via lichess-cook
  filter.py               # Coarse and fine filter definitions (used by extract + enrich)
  inspect_evals.py        # Debug tool: inspect eval coverage in the DB
  service/                # Celery app and task definitions (evaluate, tag_tactics)
  store/                  # SQLite DB access layer
  utils/                  # lichess-cook helpers for tactic tagging
```

---

## Data Flow

### Game Mode (Daily / Random)

```
Page loads
  → positionService fetches position JSON
  → coordinator.advance() / advanceWithPosition(position)
      ├─ If position has pre-computed PVs → buildFromPvs() (no engine needed)
      └─ Otherwise → EngineAnalysis runs Stockfish → topMoves[]

User drags a piece
  → submitMove(from, to)
      ├─ Validated with chess.js
      ├─ If analysis not ready → queued in moveQueue[], flushed when ready
      ├─ Compared against topMoves (rank ≤ targetMoves = hit, else miss or hidden_gem)
      │     hidden_gem: not in top N but eval ≥ Nth-best — doesn't cost a strike
      ├─ Updates candidates[], strikes, hits
      └─ notify() updates cached snapshot → useSessionSnapshot triggers re-render

Game ends when: strikes === 5 OR all top moves found
  → Board reveals remaining moves
  → Daily mode saves result to localStorage
```

### Study Mode

```
User inputs a FEN
  → session.start(fen)
      └─ EngineAnalysis starts Stockfish analysis in background

User adds/removes candidate moves (min 3 required to unlock Compare)
  → addCandidate(sourceSquare, targetSquare)
  → removeCandidate(uci)

User clicks "Compare" (enabled once candidates.length >= minCandidates)
  → Engine evaluates each candidate in parallel (Promise.all)
  → Assigns quality: Best / Excellent / Good / Inaccuracy / Mistake / Blunder
  → Results rendered ranked by eval
```

---

## Engine Architecture

The most complex part of the app. Stockfish runs in Web Workers to avoid blocking the UI.

```
EngineContext (React Context)
  ├─ pool: EnginePool          ← used by Study pages directly
  │     └─ EngineInstance (active + standby)
  │           ├─ analyzeWorker   → getTopMoves() — MultiPV=10 analysis
  │           ├─ evaluateWorker  → getMoveWithLine() — post-move eval + continuation
  │           └─ positionWorker  → getPositionEval() — single position eval
  │
  └─ coordinator: EngineCoordinator   ← used by Game / Random pages
        └─ (own internal EnginePool, same structure as above)
```

**Key design: PV-first, engine as fallback.** The coordinator always checks for pre-computed PVs on the position first (`buildFromPvs()`). Live Stockfish analysis only runs when PVs are absent.

**Key design: pool rotation.** While a user plays a position, the standby engine pre-analyzes the next one (or builds from PVs if available). On advance, the active instance is **terminated**, standby becomes active, and a fresh standby is spawned.

**EngineCoordinator** is an imperative object (not React state), created once inside `EngineContext` and destroyed on unmount. It handles:

- `advance()` — rotate pool and return next random position + analysis
- `advanceWithPosition(pos)` — use a specific position (daily, filtered random)
- `preloadNext()` — background preload of an upcoming random position

Each `EngineInstance` has a queued command system (FIFO per worker) and parses raw Stockfish UCI output (`info depth ... score cp ... pv ...` lines).

---

## State Management

| Layer               | What it manages                                                     |
| ------------------- | ------------------------------------------------------------------- |
| **React Context**   | Engine pool + coordinator (expensive, shared globally)              |
| **Session objects** | Game/Study session state — imperative JS objects, external to React |
| **Component state** | Current session instance, modal visibility, settings sliders        |
| **localStorage**    | Daily stats (streaks, results history)                              |

Sessions are plain JS objects that manage all game logic internally. Pages subscribe to session state via the `useSessionSnapshot(session)` hook (`src/hooks/useSessionSnapshot.ts`), which uses `useSyncExternalStore`. Sessions expose a cached `getSnapshot()` and call `notify()` on every state change — React reads the new snapshot and re-renders.

---

## Position Data

Positions are pre-computed JSON files fetched at runtime (no API).

```typescript
// Each entry in public/positions/chunks/*.json
{
  id: string                   // Zobrist hash (hex); first char determines which chunk file
  fen: string
  move_number: number
  side_to_move: "white" | "black"
  tag: string                  // "daily" | "general"
  phase: string                // "opening" | "middlegame" | "endgame"
  category: string             // "dominant" | "complex" | "balanced" | "crushing" | "defending"
  balance: string              // "winning" | "better" | "equal" | "worse" | "losing"
  complexity: string[]         // additive tags: "sharp" | "rich" | "balanced" | "active"
  tactics: string[]            // union of tactic themes across all PV lines
  spreads: {
    spread_1_2: number         // cp drop from move 1 to 2
    spread_1_3: number
    spread_1_5: number
    spread_2_4: number
    best_cp: number
  }
  features: {
    mobility: number           // legal move count
    captures: number
    checks: number
    blocked_pawns: number
    pawn_tension: number
  }
  source_game: {
    white: string
    black: string
    white_elo: string | number
    black_elo: string | number
    opening?: string
    eco?: string
    date: string
    pgn?: string
  }
  evals: Array<{
    depth: number
    multipv: number
    pvs: Array<{
      best_move: string        // UCI notation e.g. "g5h4"
      cp: number               // centipawns (relative to side to move)
      line: string             // full PV in UCI e.g. "g5h4 e7e6 e2e3 ..."
      tactics: string[]        // lichess-cook tactic themes for this PV
    }>
  }>
}
```

Pre-computed PVs mean the engine doesn't need to run from scratch on every load. If PVs are missing, the engine falls back to live analysis.

**File layout:**

```
public/positions/
  chunks/               # 16 files named 0–9 + a–f (hex)
    0.json              # all positions whose id starts with "0"
    ...
    f.json
  daily_schedule.json   # { "YYYY-MM-DD": "<position-id>", ... }
```

Daily and general positions share the same chunk files. `daily_schedule.json` maps each calendar date to a position ID; the app fetches the schedule, looks up the ID, then loads the right chunk by the ID's first character. All 16 chunks are background-loaded on app mount so library filtering is instant.

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
- Looked up via `public/positions/daily_schedule.json` (date → position ID), then fetched from the matching chunk file
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

**Infrastructure:** Stockfish evaluation runs inside Docker containers managed by Celery + Redis. The pipeline scripts run locally; workers can run on multiple LAN machines for parallelism.

**Pipeline steps:**

```
1. extract.py
   Streams PGN files, samples one position every 2–10 moves per game.
   Keeps moves 5–50 with ≥8 pieces (avoids openings and trivial endgames).
   Dispatches FENs to Celery workers → Stockfish at depth 10, MultiPV=5.
   Applies coarse filter (spread, mate, cp limits). Survivors saved to SQLite
   with status=extracted.

2. enrich.py
   Pure local processing — no workers needed.
   Reads extracted positions, computes:
   - Phase: opening / middlegame / endgame (Lichess Divider algorithm)
   - Category: dominant / complex / balanced / crushing / defending (by cp spread)
   - Complexity tags: sharp / rich / balanced / active
   - Balance: winning / better / equal / worse / losing
   - Features: mobility, captures, checks, blocked_pawns, pawn_tension
   - Tag: "daily" (high activity, equal/better, early middlegame) or "general"
   Applies fine filter (drops losing positions, locked pawns, low activity).
   Status → fine_filter_passed or fine_filter_failed.

3. eval.py
   Deep re-evaluation of fine_filter_passed positions.
   Dispatches to Celery workers → Stockfish at depth 20, MultiPV=20.
   Merges result into the position's evals list in SQLite.

4. tactics.py
   Tags each position's PV lines with lichess-cook tactic themes
   (fork, pin, discoveredAttack, etc.) via Celery workers.
   Results stored as tactics[] on the position in SQLite.
```

Steps must run in order. Each step is idempotent — re-running skips already-processed positions. The output is a SQLite database (`positions.db`) used as the source for generating the app's static JSON files.

---

## Backend

The backend is a Cloudflare Worker (`src/worker/`) sitting in front of the static assets. Only `/api/*` requests are routed to the worker — everything else is served directly from the asset CDN.

See [src/worker/readme.md](src/worker/readme.md) for full API documentation.

**Key design decisions:**

- D1 (SQLite) for all persistent data — puzzle stats, user solves, auth sessions
- Sessions stored in D1 with a token in an HTTP-only cookie (30-day expiry)
- Weekly cron job cleans up expired sessions
- Telemetry is bot-protected via Cloudflare Turnstile + origin check
- Puzzle aggregate stats and per-user solve history are separate concerns — anonymous solves update `puzzle_stats`, logged-in solves also write to `user_solves`

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
