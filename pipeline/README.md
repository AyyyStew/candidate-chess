# Chess Position Pipeline

Extracts candidate chess positions from PGN files, evaluates them with Stockfish via a distributed Celery/Redis worker cluster, enriches them with features, and stores results in SQLite.

---

## How It Works

```
PGN files → extract.py → [Redis/Celery workers] → SQLite DB
                                                        ↓
                                                   enrich.py
                                                        ↓
                                                    eval.py → [Redis/Celery workers] → SQLite DB
```

### Pipeline Steps

**1. extract** — reads PGN files, samples positions, runs a cheap Stockfish eval (depth 7, multipv 5), applies a coarse filter to reject already-decided or boring positions, saves survivors to the DB with `STATUS_EXTRACTED`.

**2. enrich** — runs locally (no workers needed). Reads extracted positions, computes features (mobility, captures, pawn tension, phase), classifies each position (category, balance, tag), applies fine filters, saves as `STATUS_ENRICHED` or `STATUS_DISCARDED`.

**3. eval** — runs a deep Stockfish eval (depth 20, multipv 20) on all enriched positions. Saves results as `STATUS_EVALUATED`.

### Position Statuses
| Status | Meaning |
|---|---|
| `extracted` | Passed coarse filter, cheap eval attached |
| `enriched` | Passed fine filter, features + classification attached |
| `discarded` | Failed fine filter (kept in DB with discard reason) |
| `evaluated` | Deep eval complete, ready for use |

### Architecture

- **Redis** — Celery broker and result backend
- **Workers** — Docker containers running Stockfish (one process per concurrency slot). Can run on multiple machines on the same LAN.
- **Runner** — Docker container used to run pipeline scripts interactively. Has access to PGN files and the SQLite DB volume.
- **extract.py / eval.py** — three-thread model: dispatcher sends tasks to Redis, main thread polls results via a single Redis MGET per cycle (not one round trip per task). Ctrl+C safe at all times.

---

## Setup

### Main Machine

```bash
cd pipeline

# Copy and edit the env file if your PGN directory is somewhere else
# Default points to ../position_generation/LichessEliteDatabase
cp .env.example .env

# Start Redis + worker
docker-compose up -d

# Verify workers are running
docker-compose logs -f worker
```

### Homelab Worker (Proxmox VM or any LAN machine)

Requirements:
- Docker installed
- CPU must support AVX2 (set CPU type to `host` in Proxmox)
- Can reach the main machine's Redis on port 6379

```bash
cd pipeline

# Set the main machine's IP
export REDIS_HOST=192.168.0.7

docker-compose -f docker-compose.worker.yml up -d
```

### Windows Firewall (main machine)

Redis must be reachable from the LAN:

```powershell
New-NetFirewallRule -DisplayName "Redis LAN" -Direction Inbound -Protocol TCP -LocalPort 6379 -Action Allow
```

---

## Running the Pipeline

All pipeline scripts run inside the **runner** container, which has the DB volume and PGN files mounted.

```bash
# Shell into the runner
docker-compose run --rm runner bash

# Or run a step directly
docker-compose run --rm runner python extract.py
docker-compose run --rm runner python enrich.py
docker-compose run --rm runner python eval.py
```

Steps must run in order: `extract` → `enrich` → `eval`. Each step is idempotent — re-running skips already-processed positions.

---

## Common Commands

### Start / Stop

```bash
# Start Redis + workers (main machine)
docker-compose up -d

# Stop everything
docker-compose down

# Start homelab worker
docker-compose -f docker-compose.worker.yml up -d
```

### Rebuild after code changes

```bash
# Main machine (worker + runner)
docker-compose build

# Homelab worker
docker-compose -f docker-compose.worker.yml build
```

### Logs

```bash
docker-compose logs -f worker
docker-compose logs -f worker --tail=50
```

### Check worker status

```bash
# How many tasks each node has processed
docker-compose run --rm runner celery -A service.app inspect stats | grep "total"

# Redis queue depth
docker-compose run --rm runner redis-cli -h redis llen eval
```

### Database

```bash
# Count positions by status
docker-compose run --rm runner python -c "from store import db; print(db.count_by_status('/data/positions.db'))"

# Copy DB to host (PowerShell)
docker run --rm -v pipeline_pipeline_db:/data -v "${PWD}:/out" alpine cp /data/positions.db /out/positions.db

# Wipe DB and Redis for a clean run
docker volume rm pipeline_pipeline_db pipeline_redis_data
```

---

## Configuration

Two config files:

- `config.toml` — local development (non-Docker)
- `config.docker.toml` — used inside containers (paths point to `/data`, Redis host is `redis`)

### Key extract settings

| Key | Default | Description |
|---|---|---|
| `depth` | 7 | Stockfish search depth for coarse eval |
| `multipv` | 5 | Number of PV lines to evaluate |
| `target_per_file` | 200 | Max positions sampled per PGN file |
| `game_sample_rate` | 0.25 | Fraction of games to sample |
| `sample_every_n_min/max` | 2/10 | Random move interval between samples |
| `min_move_number` | 5 | Ignore positions before this move |
| `max_move_number` | 50 | Ignore positions after this move |
| `min_piece_count` | 8 | Skip near-empty endgames |
| `max_position_cp` | 900 | Reject positions that are already decided |

### Key eval settings

| Key | Default | Description |
|---|---|---|
| `depth` | 20 | Stockfish search depth for deep eval |
| `multipv` | 20 | Number of PV lines |

### Worker settings

| Key | Description |
|---|---|
| `concurrency` | Number of parallel Stockfish processes per container |
| `threads` | Stockfish internal threads per process (keep at 1) |
| `hash_mb` | Stockfish hash table size in MB per process |

---

## Coarse Filter (extract)

Applied after cheap eval. A position passes if:
- At least `multipv` PV lines returned
- No mate in the top 3 lines
- Best move score within `max_position_cp` centipawns of equal
- Score drop between consecutive moves stays within spread thresholds (`move2_cp` through `move5_cp`)

## Fine Filter (enrich)

Applied after feature extraction. Rejects:
- Losing positions (`balance = losing`)
- Locked pawn structures (≥6 blocked pawns, no tension)
- Low tactical activity (captures + checks < 2)
