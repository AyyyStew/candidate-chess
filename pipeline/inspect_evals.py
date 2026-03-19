"""
Quick inspection of positions that would be selected for eval at the configured depth/multipv.

Usage:
    python inspect_evals.py
    python inspect_evals.py --depth 20 --multipv 20
    python inspect_evals.py --depth 20 --multipv 20 --limit 10
"""

import argparse
import json
import os
import tomllib

from store import db


def _needs_eval(pos: dict, depth: int, multipv: int) -> bool:
    for entry in pos.get("evals", []):
        if entry.get("depth", 0) >= depth and entry.get("multipv", 0) >= multipv:
            return False
    return True


def run(config_path: str, depth: int | None, multipv: int | None, limit: int):
    with open(config_path, "rb") as f:
        cfg = tomllib.load(f)

    db_path = cfg["store"]["db_path"]
    depth   = depth   or cfg["eval"]["depth"]
    multipv = multipv or cfg["eval"]["multipv"]

    print(f"Checking: depth={depth} multipv={multipv}\n")

    positions = db.get_by_status(db_path, db.STATUS_FINE_FILTER_PASSED)
    needs = [p for p in positions if _needs_eval(p, depth, multipv)]

    print(f"fine_filter_passed total : {len(positions)}")
    print(f"would be re-evaluated    : {len(needs)}\n")

    for pos in needs[:limit]:
        evals = pos.get("evals", [])
        print(f"id: {pos['id']}")
        if not evals:
            print("  evals: (none)")
        for e in evals:
            print(f"  depth={e.get('depth')}  multipv={e.get('multipv')}  pvs={len(e.get('pvs', []))}")
        print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config",  default=os.environ.get("PIPELINE_CONFIG", os.path.join(os.path.dirname(__file__), "config.toml")))
    parser.add_argument("--depth",   type=int, default=None)
    parser.add_argument("--multipv", type=int, default=None)
    parser.add_argument("--limit",   type=int, default=20, help="max positions to print details for")
    args = parser.parse_args()
    run(args.config, args.depth, args.multipv, args.limit)
