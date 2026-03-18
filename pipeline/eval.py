"""
Eval step — run last, after enrich.

Reads enriched positions from the DB, sends them to the eval service for deep
evaluation, and writes results back to the DB.

Progress is safe — if interrupted, re-running skips already-evaluated positions.

Usage:
    python eval.py
    python eval.py --config /path/to/config.toml
"""

import argparse
import os
import time
import tomllib

from celery import group

from service.tasks import evaluate
from store import db


def load_config(path: str) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def run(config_path: str):
    cfg = load_config(config_path)
    eval_cfg = cfg["eval"]
    db_path = cfg["store"]["db_path"]

    db.init(db_path)

    depth = eval_cfg["depth"]
    multipv = eval_cfg["multipv"]
    pv_line_moves = eval_cfg.get("pv_line_moves", 10)

    # Only process enriched positions not yet evaluated
    positions = db.get_by_status(db_path, db.STATUS_ENRICHED)
    print(f"Enriched positions to evaluate: {len(positions)}")

    if not positions:
        print("Nothing to do.")
        return

    print(f"Depth: {depth} | MultiPV: {multipv} | Sending to eval service...\n")

    # Send in batches to avoid overwhelming Redis with huge result sets
    batch_size = 100
    total = len(positions)
    done = 0
    start = time.time()

    for batch_start in range(0, total, batch_size):
        batch = positions[batch_start: batch_start + batch_size]

        tasks = group(
            evaluate.s(pos["fen"], depth, multipv, pv_line_moves)
            for pos in batch
        )
        results = tasks.apply_async().get()

        to_write = []
        for pos, eval_result in zip(batch, results):
            if eval_result is None:
                continue
            pos["eval"] = eval_result
            pos["status"] = db.STATUS_EVALUATED
            to_write.append(pos)

        db.upsert_many(db_path, to_write)
        done += len(batch)

        elapsed = time.time() - start
        rate = done / elapsed if elapsed > 0 else 0
        eta = (total - done) / rate if rate > 0 else 0
        print(
            f"  {done}/{total} | {rate:.2f} pos/s | ETA {eta:.0f}s | wrote {len(to_write)}/{len(batch)}",
            end="\r",
        )

    elapsed = time.time() - start
    print(f"\n\nDone in {elapsed:.1f}s")
    print(db.count_by_status(db_path))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=os.environ.get("PIPELINE_CONFIG", os.path.join(os.path.dirname(__file__), "config.toml")))
    args = parser.parse_args()
    run(args.config)
