"""
Extract step — run occasionally to pull new positions from PGNs.

Reads PGN files, samples positions, sends them to the eval service for cheap
evaluation, applies coarse filter, and writes survivors to the DB.

Usage:
    python extract.py
    python extract.py --config /path/to/config.toml
"""

import argparse
import collections
import glob
import os
import random
import signal
import time
import tomllib
from threading import Thread

from celery.exceptions import TimeoutError as CeleryTimeoutError

_interrupted = False

def _handle_sigint(sig, frame):
    global _interrupted
    _interrupted = True
    print("\n\nCtrl+C received — finishing in-flight tasks then stopping...")

signal.signal(signal.SIGINT, _handle_sigint)

import chess
import chess.pgn
import chess.polyglot

from service.tasks import evaluate
from store import db
from filter import default_coarse_filters, run_filters

# How many eval tasks to keep in flight at once
WINDOW_SIZE = 64


def load_config(path: str) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def stream_positions_from_pgn(pgn_path: str, cfg: dict, seen_ids: set):
    """Generator — streams positions one at a time without loading the full file."""
    game_sample_rate = cfg["game_sample_rate"]

    with open(pgn_path, "r", encoding="utf-8", errors="ignore") as f:
        while True:
            try:
                game = chess.pgn.read_game(f)
            except Exception:
                continue

            if game is None:
                break

            if random.random() > game_sample_rate:
                continue

            try:
                board = game.board()
                move_index = 0
                next_sample = random.randint(cfg["sample_every_n_min"], cfg["sample_every_n_max"])

                for move in game.mainline_moves():
                    board.push(move)
                    move_index += 1

                    if move_index == next_sample:
                        move_num = board.fullmove_number
                        piece_count = bin(int(board.occupied)).count("1")

                        in_range = (
                            cfg["min_move_number"] <= move_num <= cfg["max_move_number"]
                            and piece_count >= cfg["min_piece_count"]
                        )

                        if in_range:
                            pos_id = f"{chess.polyglot.zobrist_hash(board):016x}"
                            if pos_id not in seen_ids:
                                yield {
                                    "id": pos_id,
                                    "fen": board.fen(),
                                    "move_number": move_num,
                                    "piece_count": piece_count,
                                    "side_to_move": "white" if board.turn == chess.WHITE else "black",
                                    "source_game": {
                                        "white": game.headers.get("White", "?"),
                                        "black": game.headers.get("Black", "?"),
                                        "white_elo": game.headers.get("WhiteElo", "?"),
                                        "black_elo": game.headers.get("BlackElo", "?"),
                                        "opening": game.headers.get("Opening", "?"),
                                        "eco": game.headers.get("ECO", "?"),
                                        "date": game.headers.get("UTCDate", "?"),
                                    },
                                }

                        next_sample += random.randint(cfg["sample_every_n_min"], cfg["sample_every_n_max"])

            except Exception:
                continue


def _producer(pgn_files: list, cfg: dict, seen_ids: set, queue: collections.deque, stop: list):
    """Background thread: parses PGNs and appends positions to the queue."""
    for pgn_path in pgn_files:
        if stop[0]:
            break
        filename = os.path.basename(pgn_path)
        print(f"\n[producer] starting {filename} | queue={len(queue)} in_flight≈{len(queue)}")
        count = 0
        for pos in stream_positions_from_pgn(pgn_path, cfg, seen_ids):
            while len(queue) > WINDOW_SIZE * 4 and not stop[0]:
                time.sleep(0.05)
            queue.append(pos)
            count += 1
        print(f"\n[producer] done {filename} | yielded {count} candidates | queue={len(queue)}")
    stop[0] = True  # signal producer done


def run(config_path: str):
    cfg = load_config(config_path)
    extract_cfg = cfg["extract"]
    db_path = cfg["store"]["db_path"]
    pgn_dir = cfg["pgn"]["dir"]

    db.init(db_path)

    seed = extract_cfg.get("seed")
    if seed is not None:
        random.seed(seed)
        print(f"Random seed: {seed}")

    existing = db.get_by_status(db_path, db.STATUS_EXTRACTED)
    seen_ids = {p["id"] for p in existing}
    print(f"Existing extracted positions: {len(seen_ids)}")

    pgn_files = sorted(glob.glob(os.path.join(pgn_dir, "*.pgn")))
    print(f"PGN files: {len(pgn_files)}\n")

    coarse_filters = default_coarse_filters(extract_cfg)
    depth = extract_cfg["depth"]
    multipv = extract_cfg["multipv"]
    pv_line_moves = extract_cfg.get("pv_line_moves", 10)
    target_per_file = extract_cfg.get("target_per_file")

    # Shared state between main thread and producer
    candidate_queue: collections.deque = collections.deque()
    stop = [False]

    producer = Thread(target=_producer, args=(pgn_files, extract_cfg, seen_ids, candidate_queue, stop), daemon=True)
    producer.start()

    # Sliding window: keep WINDOW_SIZE tasks in flight at all times
    in_flight: collections.deque = collections.deque()  # (pos, async_result)

    total_kept = 0
    total_discarded = 0
    start = time.time()

    while not _interrupted:
        # Fill the window
        while len(in_flight) < WINDOW_SIZE and (candidate_queue or not stop[0]):
            if _interrupted:
                break
            if candidate_queue:
                pos = candidate_queue.popleft()
                future = evaluate.apply_async(args=[pos["fen"], depth, multipv, pv_line_moves])
                in_flight.append((pos, future))
            else:
                time.sleep(0.01)

        if not in_flight:
            break

        # Collect the oldest result — retry on timeout, discard on real errors
        pos, future = in_flight.popleft()
        eval_result = None
        while not _interrupted:
            try:
                eval_result = future.get(timeout=2)
                break
            except CeleryTimeoutError:
                continue  # worker busy, keep waiting — do NOT drop the task
            except Exception:
                total_discarded += 1
                break

        if eval_result is None:
            continue

        pos["eval"] = eval_result
        passed, _ = run_filters(pos, coarse_filters)

        if passed:
            pos["status"] = db.STATUS_EXTRACTED
            db.upsert(db_path, pos)
            seen_ids.add(pos["id"])
            total_kept += 1
        else:
            total_discarded += 1

        elapsed = time.time() - start
        rate = (total_kept + total_discarded) / elapsed if elapsed > 0 else 0
        print(
            f"  kept {total_kept} | discarded {total_discarded} | {rate:.2f} pos/s | in flight {len(in_flight)}",
            end="\r",
        )

    if _interrupted:
        print("\n\nInterrupted — revoking in-flight tasks...")
        stop[0] = True
        for _, future in in_flight:
            future.revoke()

    print(f"\n\nDone. Kept: {total_kept} | Discarded: {total_discarded}")
    print(db.count_by_status(db_path))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "config.toml"))
    args = parser.parse_args()
    run(args.config)
