"""
Eval step — run last, after enrich.

Reads enriched positions from the DB, sends them to the eval service for deep
evaluation, and writes results back to the DB.

Progress is safe — if interrupted, re-running skips already-evaluated positions.

Usage:
    python eval.py
    python eval.py --config /path/to/config.toml

Thread model:
    dispatcher — positions list → apply_async → future_queue
    main       — future_queue → in_flight → MGET → DB

The main thread never calls any blocking C code, so Ctrl+C always fires.
"""

import argparse
import os
import queue
import signal
import time
import tomllib
from threading import Event, Thread

from service.tasks import evaluate
from store import db

WINDOW_SIZE = 64


def load_config(path: str) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def _dispatcher(positions, future_queue, depth, multipv, pv_line_moves, cancel, done):
    """Thread 1: positions list → apply_async → future_queue."""
    for pos in positions:
        if cancel.is_set():
            break
        # This may block on broker hiccups — isolated here so main thread stays responsive.
        future = evaluate.apply_async(args=[pos["fen"], depth, multipv, pv_line_moves])
        future_queue.put((pos, future, time.time()))
    done.set()


def run(config_path: str):
    cfg = load_config(config_path)
    eval_cfg = cfg["eval"]
    db_path = cfg["store"]["db_path"]

    db.init(db_path)

    depth = eval_cfg["depth"]
    multipv = eval_cfg["multipv"]
    pv_line_moves = eval_cfg.get("pv_line_moves", 10)
    task_timeout_s = eval_cfg.get("task_timeout_s", 3600)

    # Apply socket timeouts so Redis calls never block indefinitely.
    _socket_timeout = eval_cfg.get("broker_socket_timeout", 10)
    evaluate.app.conf.update(
        {
            "broker_transport_options": {
                "socket_timeout": _socket_timeout,
                "socket_connect_timeout": _socket_timeout,
            },
            "redis_socket_timeout": _socket_timeout,
            "redis_socket_connect_timeout": _socket_timeout,
        }
    )

    positions = db.get_by_status(db_path, db.STATUS_ENRICHED)
    total = len(positions)
    print(f"Enriched positions to evaluate: {total}")

    if not positions:
        print("Nothing to do.")
        return

    print(f"Depth: {depth} | MultiPV: {multipv} | Sending to eval service...\n")

    cancel = Event()
    dispatcher_done = Event()

    def _sigint(*_):
        print("\n\nCtrl+C — stopping...")
        cancel.set()

    signal.signal(signal.SIGINT, _sigint)

    future_queue = queue.Queue(maxsize=WINDOW_SIZE * 4)

    Thread(
        target=_dispatcher,
        args=(
            positions,
            future_queue,
            depth,
            multipv,
            pv_line_moves,
            cancel,
            dispatcher_done,
        ),
        daemon=True,
    ).start()

    in_flight: list[tuple] = []
    total_done = 0
    total_failed = 0
    start_time = time.time()

    # Last-cycle timing (seconds)
    _t_scan = 0.0
    _t_upsert = 0.0
    _t_fill = 0.0

    def _print_status():
        elapsed = time.time() - start_time
        rate = total_done / elapsed if elapsed > 0 else 0
        eta = (total - total_done) / rate if rate > 0 else 0
        oldest = (
            f"{max(time.time() - t for _, _, t in in_flight):.1f}s"
            if in_flight
            else "-"
        )
        print(
            f"  {total_done}/{total} | {rate:.2f} pos/s | ETA {eta:.0f}s"
            f" | in_flight {len(in_flight)} | fq {future_queue.qsize()} | oldest {oldest}"
            f" | scan {_t_scan*1000:.0f}ms upsert {_t_upsert*1000:.0f}ms fill {_t_fill*1000:.0f}ms",
            end="\r",
        )

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
                print(
                    f"\n[watchdog] stuck in '{_phase[0]}' for {stuck:.1f}s", flush=True
                )

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
                break
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
        id_to_item = {
            future.id: (pos, future, dispatch_time)
            for pos, future, dispatch_time in in_flight
        }
        try:
            keys = [backend.get_key_for_task(tid) for tid in id_to_item]
            raw_values = backend.mget(keys)
            results_map = backend._mget_to_results(raw_values, list(id_to_item.keys()))
        except Exception:
            results_map = {}

        now = time.time()
        for task_id, (pos, future, dispatch_time) in id_to_item.items():
            if task_id not in results_map:
                if now - dispatch_time > task_timeout_s:
                    future.revoke()
                    total_failed += 1
                else:
                    still_waiting.append((pos, future, dispatch_time))
                continue

            meta = results_map[task_id]
            if meta.get("status") != "SUCCESS":
                total_failed += 1
                continue

            try:
                eval_result = meta["result"]
            except Exception:
                total_failed += 1
                continue

            pos["eval"] = eval_result
            pos["status"] = db.STATUS_EVALUATED
            to_write.append(pos)
            collected += 1

        _t_scan = time.time() - _t0

        if to_write:
            _set_phase("db.upsert")
            _tu = time.time()
            db.upsert_many(db_path, to_write)
            _t_upsert = time.time() - _tu
            total_done += len(to_write)
        else:
            _t_upsert = 0.0

        in_flight = still_waiting
        _set_phase("sleep")
        if collected == 0:
            time.sleep(0.05)
        _print_status()

    if cancel.is_set():
        print("\n\nCancelled — revoking in-flight tasks...")
        for _, future, _ in in_flight:
            future.revoke()

    elapsed = time.time() - start_time
    print(
        f"\n\nDone in {elapsed:.1f}s | evaluated {total_done} | failed {total_failed}"
    )
    print(db.count_by_status(db_path))


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
