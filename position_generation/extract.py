"""
Extract step — run occasionally to pull new positions from PGNs.

Reads PGN files, samples positions, sends them to the eval service for cheap
evaluation, applies coarse filter, and writes survivors to the DB.

Usage:
    python extract.py
    python extract.py --config /path/to/config.toml

Thread model:
    producer   — PGN → pos_queue
    dispatcher — pos_queue → apply_async → future_queue
    main       — future_queue → in_flight → MGET → DB

The main thread never calls any blocking C code, so Ctrl+C always fires.
"""

import argparse
import glob
import os
import queue
import random
import signal
import time
import tomllib
from threading import Event, Lock, Thread

import chess
import chess.pgn
import chess.polyglot

from service.tasks import evaluate
from store import db
from filter import default_coarse_filters, run_filters

WINDOW_SIZE    = 512
TASK_TIMEOUT_S = 60  # revoke a task if it hasn't returned within this many seconds


def load_config(path: str) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def stream_positions(pgn_path: str, cfg: dict, seen_ids: set, seen_lock: Lock):
    """Yield candidate position dicts from a single PGN file."""
    with open(pgn_path, "r", encoding="utf-8", errors="ignore") as f:
        while True:
            try:
                game = chess.pgn.read_game(f)
            except Exception:
                break  # cursor undefined after a parse error — stop reading this file

            if game is None:
                break

            if random.random() > cfg["game_sample_rate"]:
                continue

            try:
                board = game.board()
                move_index = 0
                next_sample = random.randint(cfg["sample_every_n_min"], cfg["sample_every_n_max"])

                for move in game.mainline_moves():
                    board.push(move)
                    move_index += 1

                    if move_index != next_sample:
                        continue

                    next_sample += random.randint(cfg["sample_every_n_min"], cfg["sample_every_n_max"])

                    move_num = board.fullmove_number
                    piece_count = bin(int(board.occupied)).count("1")

                    if not (
                        cfg["min_move_number"] <= move_num <= cfg["max_move_number"]
                        and piece_count >= cfg["min_piece_count"]
                    ):
                        continue

                    pos_id = f"{chess.polyglot.zobrist_hash(board):016x}"
                    with seen_lock:
                        if pos_id in seen_ids:
                            continue

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
                            "pgn": str(game),
                        },
                    }
            except Exception:
                continue


def _producer(pgn_files, cfg, seen_ids, seen_lock, pos_queue, cancel, done):
    """Thread 1: parse PGNs → pos_queue."""
    for pgn_path in pgn_files:
        if cancel.is_set():
            break
        filename = os.path.basename(pgn_path)
        print(f"\n[producer] {filename}")
        count = 0
        target = cfg.get("target_per_file")
        for pos in stream_positions(pgn_path, cfg, seen_ids, seen_lock):
            if cancel.is_set():
                break
            pos_queue.put(pos)  # blocks on backpressure — fine, this is a daemon thread
            count += 1
            if target and count >= target:
                break
        print(f"\n[producer] {filename} done — {count} candidates")
    done.set()


def _dispatcher(pos_queue, future_queue, depth, multipv, pv_line_moves,
                cancel, producer_done, done):
    """Thread 2: pos_queue → apply_async → future_queue.

    apply_async can block indefinitely on broker hiccups. Keeping it here means
    the main thread is never stuck and Ctrl+C always works.
    """
    while not cancel.is_set():
        try:
            pos = pos_queue.get(timeout=0.1)
        except queue.Empty:
            if producer_done.is_set():
                break
            continue
        # This may block — that is intentional; it's isolated to this thread.
        future = evaluate.apply_async(args=[pos["fen"], depth, multipv, pv_line_moves])
        future_queue.put((pos, future, time.time()))
    done.set()


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

    existing = db.query(db_path, "SELECT id FROM positions")
    seen_ids = {row["id"] for row in existing}
    seen_lock = Lock()
    print(f"Existing positions: {len(seen_ids)}")

    pgn_files = sorted(glob.glob(os.path.join(pgn_dir, "*.pgn")))
    print(f"PGN files: {len(pgn_files)}\n")

    # Apply socket timeouts to the Celery app so that broker and result-backend
    # Redis calls never block indefinitely.  Without this, apply_async and
    # future.ready() can hang for minutes on a flaky connection.
    _socket_timeout = extract_cfg.get("broker_socket_timeout", 10)
    evaluate.app.conf.update({
        "broker_transport_options": {
            "socket_timeout": _socket_timeout,
            "socket_connect_timeout": _socket_timeout,
        },
        "redis_socket_timeout": _socket_timeout,
        "redis_socket_connect_timeout": _socket_timeout,
    })

    coarse_filters = default_coarse_filters(extract_cfg)
    depth        = extract_cfg["depth"]
    multipv      = extract_cfg["multipv"]
    pv_line_moves = extract_cfg.get("pv_line_moves", 10)  # moves per PV line; default 10

    cancel          = Event()
    producer_done   = Event()
    dispatcher_done = Event()

    def _sigint(*_):
        print("\n\nCtrl+C — stopping...")
        cancel.set()

    signal.signal(signal.SIGINT, _sigint)

    pos_queue    = queue.Queue(maxsize=WINDOW_SIZE * 4)
    future_queue = queue.Queue(maxsize=WINDOW_SIZE * 4)

    Thread(
        target=_producer,
        args=(pgn_files, extract_cfg, seen_ids, seen_lock, pos_queue, cancel, producer_done),
        daemon=True,
    ).start()

    Thread(
        target=_dispatcher,
        args=(pos_queue, future_queue, depth, multipv, pv_line_moves,
              cancel, producer_done, dispatcher_done),
        daemon=True,
    ).start()

    # in_flight: list of (pos, future, dispatch_time)
    in_flight: list[tuple] = []
    total_kept = 0
    total_discarded = 0
    start_time = time.time()

    # Last-cycle timing (seconds)
    _t_scan   = 0.0
    _t_upsert = 0.0
    _t_fill   = 0.0

    def _print_status(note: str = ""):
        elapsed = time.time() - start_time
        rate = (total_kept + total_discarded) / elapsed if elapsed > 0 else 0
        oldest = f"{max(time.time() - t for _, _, t in in_flight):.1f}s" if in_flight else "-"
        scan_ms   = f"{_t_scan*1000:.0f}"
        upsert_ms = f"{_t_upsert*1000:.0f}"
        fill_ms   = f"{_t_fill*1000:.0f}"
        print(
            f"  kept {total_kept} | discarded {total_discarded} | {rate:.2f} pos/s"
            f" | in_flight {len(in_flight)} | fq {future_queue.qsize()} | pq {pos_queue.qsize()} | oldest {oldest}"
            f" | scan {scan_ms}ms upsert {upsert_ms}ms fill {fill_ms}ms"
            + (f" | {note}" if note else ""),
            end="\r",
        )

    # Watchdog: reports if the main loop stops advancing (shouldn't happen now,
    # but kept for peace of mind)
    _phase = ["init"]
    _phase_since = [time.time()]

    def _set_phase(name: str):
        _phase[0] = name
        _phase_since[0] = time.time()

    def _watchdog():
        while not cancel.is_set():
            time.sleep(1)
            stuck = time.time() - _phase_since[0]
            if stuck > 5:
                print(f"\n[watchdog] stuck in '{_phase[0]}' for {stuck:.1f}s", flush=True)

    Thread(target=_watchdog, daemon=True).start()

    while not cancel.is_set():
        # Fill in_flight from the future_queue
        _set_phase("fill")
        _t0 = time.time()
        while len(in_flight) < WINDOW_SIZE and not cancel.is_set():
            try:
                item = future_queue.get_nowait()
                in_flight.append(item)
            except queue.Empty:
                break
        _t_fill = time.time() - _t0

        if not in_flight:
            if dispatcher_done.is_set() and future_queue.empty():
                break  # all done
            _set_phase("sleep/wait")
            time.sleep(0.05)
            continue

        # Bulk-check all in-flight tasks with one Redis MGET call.
        _set_phase("scan")
        _t0 = time.time()
        collected = 0
        still_waiting = []
        to_write = []

        backend = evaluate.app.backend
        id_to_item = {future.id: (pos, future, dispatch_time) for pos, future, dispatch_time in in_flight}
        try:
            keys = [backend.get_key_for_task(tid) for tid in id_to_item]
            raw_values = backend.mget(keys)
            results_map = backend._mget_to_results(raw_values, list(id_to_item.keys()))
        except Exception:
            results_map = {}

        now = time.time()
        for task_id, (pos, future, dispatch_time) in id_to_item.items():
            if task_id not in results_map:
                if now - dispatch_time > TASK_TIMEOUT_S:
                    future.revoke()
                    total_discarded += 1
                else:
                    still_waiting.append((pos, future, dispatch_time))
                continue

            meta = results_map[task_id]
            if meta.get("status") != "SUCCESS":
                total_discarded += 1
                continue

            try:
                eval_result = meta["result"]
            except Exception:
                total_discarded += 1
                continue

            pos["evals"] = [eval_result]
            passed, _ = run_filters(pos, coarse_filters)
            if passed:
                pos["status"] = db.STATUS_EXTRACTED
                to_write.append(pos)
                total_kept += 1
            else:
                total_discarded += 1
            collected += 1

        _t_scan = time.time() - _t0

        if to_write:
            _set_phase("db.upsert")
            _tu = time.time()
            db.upsert_many(db_path, to_write)
            _t_upsert = time.time() - _tu
            with seen_lock:
                for pos in to_write:
                    seen_ids.add(pos["id"])
        else:
            _t_upsert = 0.0

        in_flight = still_waiting
        _set_phase("sleep")
        if collected == 0:
            time.sleep(0.05)  # nothing ready — yield so Ctrl+C fires
        _print_status()

    if cancel.is_set():
        print("\n\nCancelled — revoking in-flight tasks...")
        for _, future, _ in in_flight:
            future.revoke()

    print(f"\n\nDone. Kept: {total_kept} | Discarded: {total_discarded}")
    print(db.count_by_status(db_path))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=os.environ.get("PIPELINE_CONFIG", os.path.join(os.path.dirname(__file__), "config.toml")))
    args = parser.parse_args()
    run(args.config)
