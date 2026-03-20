"""
Tactics step — run after eval.

Reads fine-filter-passed positions from the DB, tags each PV line with
lichess-cook tactic themes, aggregates to position level, and writes back.

Re-running is safe — positions are overwritten in place.

Usage:
    python tactics.py
    python tactics.py --config /path/to/config.toml
"""

import argparse
import io
import os
import time
import tomllib
from collections import Counter
from concurrent.futures import ProcessPoolExecutor

import chess
import chess.pgn
from tqdm import tqdm

from store import db
from utils.cook import cook as cook_puzzle
from utils.model import Puzzle


_EXCLUDED_TAGS = {
    "mate", "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5",
    "oneMove", "short", "long", "veryLong",
}


def load_config(path: str) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def build_puzzle(pos: dict, pv: dict) -> Puzzle | None:
    """
    Build a lichess-compatible Puzzle from a position + single PV.

    Prepends the move that led TO this position so the game tree matches
    the lichess convention: opponent move first, pov moves at mainline[1::2].
    Falls back to a direct build with field override when no prior move exists.
    """
    line = pv.get("line", "")
    cp = pv.get("cp", 0)
    if not line:
        return None

    pgn_str = pos.get("source_game", {}).get("pgn", "")
    move_number = pos["move_number"]
    side = pos["side_to_move"]
    target_ply = (move_number - 1) * 2 + (0 if side == "white" else 1)

    try:
        if pgn_str and target_ply > 0:
            src_game = chess.pgn.read_game(io.StringIO(pgn_str))
            if src_game is None:
                return None
            src_moves = list(src_game.mainline_moves())
            if target_ply - 1 >= len(src_moves):
                return None

            board = src_game.board()
            for m in src_moves[:target_ply - 1]:
                board.push(m)
            preceding_move = src_moves[target_ply - 1]

            # Snapshot as clean FEN — from_board() replays the move stack,
            # so passing the original board would include all historical moves.
            new_game = chess.pgn.Game.from_board(chess.Board(board.fen()))
            node = new_game.add_main_variation(preceding_move)
            board.push(preceding_move)
        else:
            board = chess.Board(pos["fen"])
            new_game = chess.pgn.Game.from_board(board)
            node = new_game

        for uci in line.split():
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                break
            node = node.add_main_variation(move)
            board.push(move)

        puzzle = Puzzle(id=pos["id"], game=new_game, cp=cp)

        # Fallback: no prior move means pov is inverted by __post_init__ — fix it
        if not (pgn_str and target_ply > 0):
            puzzle.pov = chess.WHITE if side == "white" else chess.BLACK
            puzzle.mainline = [new_game] + list(new_game.mainline())  # type: ignore[list-item]

        return puzzle
    except Exception:
        return None


def tag_tactics(pos: dict) -> dict:
    best_eval = max(pos.get("evals", []), key=lambda e: e.get("depth", 0), default={})
    pvs = best_eval.get("pvs", [])

    t0 = time.perf_counter()
    all_tags: set[str] = set()
    for pv in pvs:
        puzzle = build_puzzle(pos, pv)
        pv_tags = [t for t in cook_puzzle(puzzle) if t not in _EXCLUDED_TAGS] if puzzle else []
        pv["tactics"] = pv_tags
        all_tags.update(pv_tags)

    pos["tactics"] = sorted(all_tags)
    pos["_timings"] = {"tactics": time.perf_counter() - t0}
    return pos


# ── main ───────────────────────────────────────────────────────────────────────


def run(config_path: str):
    cfg = load_config(config_path)
    db_path = cfg["store"]["db_path"]

    db.init(db_path)

    positions = db.get_by_status(db_path, db.STATUS_FINE_FILTER_PASSED)
    print(f"Positions to tag: {len(positions)}")

    workers = cfg.get("tactics", {}).get("workers", os.cpu_count())
    print(f"Workers: {workers}")

    results_out = []
    timing_totals: Counter = Counter()

    with ProcessPoolExecutor(max_workers=workers) as executor:
        for result in tqdm(
            executor.map(tag_tactics, positions),
            total=len(positions),
            desc="Tagging tactics",
            unit="pos",
        ):
            timings = result.pop("_timings", {})
            for k, v in timings.items():
                timing_totals[k] += v
            results_out.append(result)

    db.upsert_many(db_path, results_out)

    total = len(results_out)
    if total > 0 and timing_totals:
        t_total = sum(timing_totals.values())
        print("\n── Timing breakdown (total wall, all workers) ──")
        for step, t in sorted(timing_totals.items(), key=lambda x: -x[1]):
            avg_ms = 1000 * t / total
            print(f"  {step:<12} {t:6.1f}s  avg {avg_ms:.1f}ms/pos")

    tactics_counts = Counter(t for p in results_out for t in p.get("tactics", []))
    print(f"\nTactics: {dict(tactics_counts)}")
    print(f"\n{db.count_by_status(db_path)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PIPELINE_CONFIG", os.path.join(os.path.dirname(__file__), "config.toml")
        ),
    )
    args = parser.parse_args()
    run(args.config)
