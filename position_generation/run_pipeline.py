"""
Position generation pipeline runner.
Run from the position_generation/ directory.

  python run_pipeline.py              # all steps
  python run_pipeline.py --from eval  # resume from a specific step
  python run_pipeline.py --only filter # single step
"""

import argparse
import sys

from position_extractor import run as extract
from position_enrichment import run as enrich
from position_filter import run as filter_positions
from position_eval import run as eval_positions
from chunking import run as chunk
from deploy_positions import run as deploy


# ── Paths ─────────────────────────────────────────────────────────────────────

ENGINE_PATH = r"C:\Users\alexs\Desktop\stockfish\stockfish-windows-x86-64-avx2.exe"
PGN_DIR = "./LichessEliteDatabase"

EXTRACT_OUTPUT = "training_positions.jsonl"
ENRICH_OUTPUT = "training_positions_enriched.jsonl"
FILTER_OUTPUT = "training_positions_filtered.jsonl"
EVAL_OUTPUT = "training_positions_evaluated.jsonl"
CHUNK_OUTPUT_DIR = "positions"
DEPLOY_DST = "../public/positions"

# ── Engine ────────────────────────────────────────────────────────────────────

N_WORKERS = 14
THREADS_PER_WORKER = 1
EXTRACTOR_HASH = 512  # MB per worker
EVAL_HASH = 512  # MB per worker

# ── Extractor ─────────────────────────────────────────────────────────────────

TARGET = None  # set to int to cap total positions collected
TARGET_PER_FILE = 200

DEPTH = 16
EXTRACT_MULTIPV = 5
PV_LINE_MOVES = 20

SAMPLE_EVERY_N_MIN = 2
SAMPLE_EVERY_N_MAX = 10
MIN_MOVE_NUMBER = 5
MAX_MOVE_NUMBER = 50
MIN_PIECE_COUNT = 8
GAME_SAMPLE_RATE = 0.25
MIN_GAMES_TO_SAMPLE = 200
PREFETCH_QUEUE_SIZE = 2
WORKER_JOIN_TIMEOUT = 5
MATE_CHECK_TOP_N = 3

VIABILITY_THRESHOLDS = {
    "max_position_cp": 900,
    "move2_cp": 150,
    "move3_cp": 150,
    "move4_cp": 200,
    "move5_cp": 300,
}

# ── Deep eval ─────────────────────────────────────────────────────────────────

EVAL_MULTIPV = 20
DEPTH_MULTIPV = 20

# ── Filter ────────────────────────────────────────────────────────────────────

REJECT_BALANCE = {"losing"}
LOCKED_BLOCKED_MIN = 6
LOCKED_TENSION_FLOOR = 0
MIN_TACTICAL_ACTIVITY = 2

# ── Chunking ──────────────────────────────────────────────────────────────────

GENERAL_CHUNK_SIZE = 500
SEED = 42
DAILY_YEARS = 5


# ── Steps ─────────────────────────────────────────────────────────────────────


def step_extract():
    extract(
        output_file=EXTRACT_OUTPUT,
        progress_file="progress.json",
        pgn_dir=PGN_DIR,
        engine_path=ENGINE_PATH,
        target=TARGET,
        target_per_file=TARGET_PER_FILE,
        depth=DEPTH,
        multipv=EXTRACT_MULTIPV,
        sample_every_n_min=SAMPLE_EVERY_N_MIN,
        sample_every_n_max=SAMPLE_EVERY_N_MAX,
        n_workers=N_WORKERS,
        threads_per_worker=THREADS_PER_WORKER,
        hash_per_worker=EXTRACTOR_HASH,
        thresholds=VIABILITY_THRESHOLDS,
        mate_check_top_n=MATE_CHECK_TOP_N,
        pv_line_moves=PV_LINE_MOVES,
        min_move_number=MIN_MOVE_NUMBER,
        max_move_number=MAX_MOVE_NUMBER,
        min_piece_count=MIN_PIECE_COUNT,
        game_sample_rate=GAME_SAMPLE_RATE,
        min_games_to_sample=MIN_GAMES_TO_SAMPLE,
        prefetch_queue_size=PREFETCH_QUEUE_SIZE,
        worker_join_timeout=WORKER_JOIN_TIMEOUT,
    )


def step_enrich():
    enrich(
        input_file=EXTRACT_OUTPUT,
        output_file=ENRICH_OUTPUT,
    )


def step_filter():
    filter_positions(
        input_file=ENRICH_OUTPUT,
        output_file=FILTER_OUTPUT,
        reject_balance=REJECT_BALANCE,
        locked_blocked_min=LOCKED_BLOCKED_MIN,
        locked_tension_floor=LOCKED_TENSION_FLOOR,
        min_tactical_activity=MIN_TACTICAL_ACTIVITY,
    )


def step_eval():
    eval_positions(
        input_file=FILTER_OUTPUT,
        output_file=EVAL_OUTPUT,
        engine_path=ENGINE_PATH,
        multipv=EVAL_MULTIPV,
        depth=DEPTH_MULTIPV,
        n_workers=N_WORKERS,
        threads_per_worker=THREADS_PER_WORKER,
        hash_per_worker=EVAL_HASH,
    )


def step_chunk():
    chunk(
        input_file=EVAL_OUTPUT,
        output_dir=CHUNK_OUTPUT_DIR,
        general_chunk_size=GENERAL_CHUNK_SIZE,
        seed=SEED,
        daily_years=DAILY_YEARS,
    )


def step_deploy():
    deploy(
        src=CHUNK_OUTPUT_DIR,
        dst=DEPLOY_DST,
    )


STEPS = [
    ("extract", step_extract, "Extract & evaluate positions from PGNs"),
    ("enrich", step_enrich, "Enrich with metadata"),
    ("filter", step_filter, "Filter poor positions"),
    (
        "eval",
        step_eval,
        f"Deep evaluation (depth={DEPTH_MULTIPV}, MultiPV={EVAL_MULTIPV})",
    ),
    ("chunk", step_chunk, "Chunk into JSON files"),
    ("deploy", step_deploy, "Deploy to public/positions/"),
]


def main():
    parser = argparse.ArgumentParser(description="Run the position generation pipeline")
    parser.add_argument(
        "--from",
        dest="from_step",
        metavar="STEP",
        help=f"Start from this step. Options: {', '.join(k for k, _, _ in STEPS)}",
    )
    parser.add_argument(
        "--only",
        dest="only_step",
        metavar="STEP",
        help="Run only this single step.",
    )
    args = parser.parse_args()

    valid_keys = [k for k, _, _ in STEPS]

    if args.only_step:
        if args.only_step not in valid_keys:
            print(f"Unknown step '{args.only_step}'. Options: {', '.join(valid_keys)}")
            sys.exit(1)
        steps = [(k, fn, d) for k, fn, d in STEPS if k == args.only_step]
    elif args.from_step:
        if args.from_step not in valid_keys:
            print(f"Unknown step '{args.from_step}'. Options: {', '.join(valid_keys)}")
            sys.exit(1)
        idx = valid_keys.index(args.from_step)
        steps = STEPS[idx:]
    else:
        steps = STEPS

    for _, fn, description in steps:
        print(f"\n{'='*60}")
        print(f"  {description}")
        print(f"{'='*60}\n")
        fn()

    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
