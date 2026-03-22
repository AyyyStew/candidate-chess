# Chess Position Pipeline

Extracts candidate chess positions from PGN files, evaluates them with Stockfish via a distributed Celery/Redis worker cluster, enriches them with features, and stores results in SQLite.

---

## How It Works

```
PGN files → extract.py → [Redis/Celery workers] → SQLite DB
                                                        ↓
                                                   enrich.py  (local, no workers)
                                                        ↓
                                              eval.py → [Redis/Celery workers] → SQLite DB
                                                        ↓
                                            tactics.py → [Redis/Celery workers] → SQLite DB
```

The pipeline scripts (`extract.py`, `enrich.py`, `eval.py`) run **locally on your machine**. Docker is only used for Redis and the Stockfish eval workers.

### Pipeline Steps

**1. extract** — reads PGN files, samples positions, runs a cheap Stockfish eval (depth 10, multipv 5), applies a coarse filter to reject already-decided or boring positions, saves survivors to the DB with `STATUS_EXTRACTED`.

**2. enrich** — pure local processing, no workers or Redis needed. Reads extracted positions, computes features (mobility, captures, pawn tension, phase), classifies each position (category, balance, complexity, tag), applies fine filters, saves as `fine_filter_passed` or `fine_filter_failed`.

**3. eval** — runs a deep Stockfish eval (depth 20, multipv 20) on all `fine_filter_passed` positions via the worker cluster. Merges the new eval entry into the position's evals list in the DB.

**4. tactics** — tags each position's PV lines with lichess-cook tactic themes (fork, pin, discoveredAttack, etc.) via the worker cluster. Reads `fine_filter_passed` positions and writes `tactics[]` back to the DB.

### Position Statuses

| Status               | Meaning                                                |
| -------------------- | ------------------------------------------------------ |
| `extracted`          | Passed coarse filter, cheap eval attached              |
| `fine_filter_passed` | Passed fine filter, features + classification attached |
| `fine_filter_failed` | Failed fine filter (kept in DB with discard reason)    |

Positions keep `fine_filter_passed` status after `eval` and `tactics` — there is no separate evaluated status. The evals list and tactics field are updated in-place.

### Architecture

- **Redis** — Celery broker and result backend, runs in Docker
- **Workers** — Docker containers running Stockfish (one process per concurrency slot). Can run on multiple machines on the same LAN.
- **extract.py / eval.py** — three-thread model: dispatcher sends tasks to Redis, main thread polls results via a single Redis MGET per cycle.
- **filter.py** — coarse and fine filter definitions used by extract and enrich respectively.

---

## Setup

### Main Machine

```bash
cd position_generation

# Start Redis + worker
docker-compose up -d

# Verify workers are running
docker-compose logs -f worker
```

### Other Machine on Lan

Requirements:

- Docker installed
- CPU must support AVX2
- Can reach the main machine's Redis on port 6379

```bash
cd position_generation

# Set the main machine's IP
export REDIS_HOST=X.X.X.X

docker compose -f docker-compose.worker.yml up -d
```

`docker-compose.worker.yml` extends the `worker` service from `docker-compose.yml` and adds `REDIS_HOST`.

---

## Running the Pipeline

Pipeline scripts run locally. Make sure Redis and at least one worker are up first.

```bash
cd position_generation

python extract.py
python enrich.py
python eval.py
python tactics.py
```

Steps must run in order: `extract` → `enrich` → `eval` → `tactics`. Each step is idempotent — re-running skips already-processed positions.

The DB is written to `./positions.db` by default (set in `config.toml`).

### Database

```bash
# Count positions by status
python -c "from store import db; print(db.count_by_status('./positions.db'))"

# Wipe DB and Redis for a clean run
rm positions.db
docker volume rm pipeline_redis_data
```

---

## Configuration

Two config files:

- `config.toml` — used when running scripts locally (default)
- `config.docker.toml` — used inside worker containers (paths point to `/data`, Redis host is `redis`)

Scripts pick up config via `PIPELINE_CONFIG` env var, defaulting to `config.toml`.

### Key extract settings

| Key                      | Default | Description                               |
| ------------------------ | ------- | ----------------------------------------- |
| `depth`                  | 10      | Stockfish search depth for coarse eval    |
| `multipv`                | 5       | Number of PV lines to evaluate            |
| `target_per_file`        | 200     | Max positions sampled per PGN file        |
| `game_sample_rate`       | 0.25    | Fraction of games to sample               |
| `sample_every_n_min/max` | 2/10    | Random move interval between samples      |
| `min_move_number`        | 5       | Ignore positions before this move         |
| `max_move_number`        | 50      | Ignore positions after this move          |
| `min_piece_count`        | 8       | Skip near-empty endgames                  |
| `max_position_cp`        | 900     | Reject positions that are already decided |

### Key eval settings

| Key       | Default | Description                          |
| --------- | ------- | ------------------------------------ |
| `depth`   | 20      | Stockfish search depth for deep eval |
| `multipv` | 20      | Number of PV lines                   |

### Worker settings

| Key           | Description                                          |
| ------------- | ---------------------------------------------------- |
| `concurrency` | Number of parallel Stockfish processes per container |
| `threads`     | Stockfish internal threads per process (keep at 1)   |
| `hash_mb`     | Stockfish hash table size in MB per process          |

---

## Coarse Filter (extract)

Defined in `filter.py`, applied after cheap eval. A position passes if:

- At least `multipv` PV lines returned
- No mate in the top 3 lines
- Best move score within `max_position_cp` centipawns of equal
- Score drop between consecutive moves stays within spread thresholds (`move2_cp` through `move5_cp`)

## Fine Filter (enrich)

Defined in `filter.py`, applied after feature extraction. Rejects:

- Losing positions (`balance = losing`)
- Locked pawn structures (≥6 blocked pawns, no tension)
- Low tactical activity (captures + checks < 2)
