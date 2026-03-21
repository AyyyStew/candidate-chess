# Worker API

Cloudflare Worker built with [Hono](https://hono.dev). Handles all `/api/*` requests. Static assets are served directly from Cloudflare's CDN — the worker is only invoked for API routes.

---

## Setup

### Environment variables

Create a `.dev.vars` file in the project root for local dev:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
LICHESS_CLIENT_ID=...
TURNSTILE_SECRET_KEY=...
```

For production, set secrets via:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put LICHESS_CLIENT_ID
npx wrangler secret put TURNSTILE_SECRET_KEY
```

### Database

```bash
# Generate a migration after changing schema
npm run db:generate

# Apply all migrations locally
npm run db:migrate:local

# Reset local DB and reapply from scratch
npm run db:reset:local

# Apply to production
npx wrangler d1 execute candidate-chess-db --file=./drizzle/<migration>.sql

# Export production DB for backup/analysis
npx wrangler d1 export candidate-chess-db --output=./backup.sql
```

---

## Auth

OAuth via Google and Lichess (both use PKCE). After a successful login, a session token is stored in an HTTP-only cookie (`session`, 30-day expiry). Sessions are stored in D1 and cleaned up weekly via a cron job.

Lichess does not return a real email address by default — users get a placeholder `<username>@lichess.org`.

---

## API Routes

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/auth/google` | — | Redirect to Google OAuth |
| `GET` | `/api/v1/auth/google/callback` | — | Google OAuth callback |
| `GET` | `/api/v1/auth/lichess` | — | Redirect to Lichess OAuth |
| `GET` | `/api/v1/auth/lichess/callback` | — | Lichess OAuth callback |
| `GET` | `/api/v1/auth/me` | optional | Returns current user or `null` |
| `POST` | `/api/v1/auth/logout` | — | Clears session cookie |

**`GET /api/v1/auth/me`** response:
```json
{ "id": 1, "email": "user@example.com", "displayName": "Alex" }
// or null if not logged in
```

---

### Telemetry

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/telemetry/visit` | — | Record a site visit for today |

**`POST /api/v1/telemetry/visit`** — requires same-origin `Origin` header and a valid Cloudflare Turnstile token:
```json
{ "turnstileToken": "..." }
```

---

### Puzzles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/puzzles/daily` | — | Today's daily puzzle + aggregate stats |
| `POST` | `/api/v1/puzzles/:zobrist/visit` | — | Increment visitor count for a puzzle |
| `GET` | `/api/v1/puzzles/:zobrist/stats` | — | Aggregate stats for a puzzle |
| `POST` | `/api/v1/puzzles/:zobrist/solve` | — | Record an anonymous solve |

**`POST /api/v1/puzzles/:zobrist/solve`** body:
```json
{
  "strikesUsed": 2,
  "movesFound": 3,
  "totalMoves": 5,
  "guesses": "Rd1,Be4,Nf3,Qd2",
  "timeMs": 30000
}
```

**`GET /api/v1/puzzles/:zobrist/stats`** response:
```json
{
  "zobrist": "abc123",
  "visitorCount": 142,
  "solveCount": 89,
  "totalMovesFound": 312,
  "totalPossibleMoves": 445,
  "totalStrikesUsed": 134,
  "totalTimeMs": 2670000,
  "moveCounts": { "Rd1": 42, "Be4": 31, "Nf3": 17 },
  "createdAt": "..."
}
```

Daily puzzles are managed directly via `wrangler d1 execute` — there is no API endpoint to set the daily puzzle.

---

### User Solves

Requires authentication (session cookie).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/solves` | required | Record a solve for the logged-in user |
| `GET` | `/api/v1/solves` | required | Get solve history (last 50, newest first) |

**`POST /api/v1/solves`** body:
```json
{
  "zobrist": "abc123",
  "strikesAllowed": 5,
  "strikesUsed": 2,
  "movesFound": 3,
  "totalMoves": 5,
  "guesses": "Rd1,Be4,Nf3",
  "timeMs": 30000
}
```

`zobrist` is optional — omit it for custom/user-input positions that don't exist in the puzzle table.

---

## Database Schema

```
users               — id, email, display_name, created_at
oauth_accounts      — user_id, provider (google|lichess), provider_user_id
sessions            — id (token), user_id, expires_at

puzzle_stats        — zobrist (PK), visitor_count, solve_count,
                      total_moves_found, total_possible_moves,
                      total_strikes_used, total_time_ms, created_at
puzzle_move_attempts — zobrist + move (composite PK), count
daily_puzzles       — date (PK), zobrist (FK → puzzle_stats)

user_solves         — id, user_id, zobrist (nullable FK), strikes_allowed,
                      strikes_used, moves_found, total_moves,
                      guesses (comma-separated), time_ms, created_at

site_visits         — date (PK), count
```

---

## Project Structure

```
src/worker/
  index.ts              — app entry point, middleware, cron handler
  context.ts            — shared Bindings + Variables types
  routes/
    auth.ts             — OAuth + session routes
    puzzles.ts          — puzzle stats + daily puzzle
    telemetry.ts        — site visit tracking
    solves.ts           — user solve history
  middleware/
    session.ts          — reads session cookie, attaches user to context
  db/
    schema.ts           — Drizzle table definitions
    client.ts           — createDb() for production (D1)
    test-client.ts      — createTestDb() for tests (better-sqlite3)
    types.ts            — AppDb union type
```
