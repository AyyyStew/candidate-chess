"""
Tactics step — run after eval.

Reads fine-filter-passed positions from the DB, dispatches them to Celery
workers for tactic tagging (lichess-cook), and writes results back to the DB.

Progress is safe — if interrupted, re-running reprocesses all positions.

Usage:
    python tactics.py
    python tactics.py --config /path/to/config.toml

Thread model:
    dispatcher — positions list → apply_async → future_queue
    main       — future_queue → in_flight → MGET → DB
"""

import argparse
import os
import queue
import signal
import time
import tomllib
from collections import Counter
from threading import Event, Thread

from service.tasks import tag_tactics
from store import db

WINDOW_SIZE = 128


def load_config(path: str) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def _dispatcher(positions, future_queue, cancel, done):
    """Thread 1: positions list → apply_async → future_queue."""
    for pos in positions:
        if cancel.is_set():
            break
        future = tag_tactics.apply_async(args=[pos])
        future_queue.put((pos, future, time.time()))
    done.set()


def run(config_path: str):
    cfg = load_config(config_path)
    tactics_cfg = cfg.get("tactics", {})
    db_path = cfg["store"]["db_path"]

    db.init(db_path)

    task_timeout_s = tactics_cfg.get("task_timeout_s", 300)

    _socket_timeout = tactics_cfg.get("broker_socket_timeout", 10)
    tag_tactics.app.conf.update(
        {
            "broker_transport_options": {
                "socket_timeout": _socket_timeout,
                "socket_connect_timeout": _socket_timeout,
            },
            "redis_socket_timeout": _socket_timeout,
            "redis_socket_connect_timeout": _socket_timeout,
        }
    )

    positions = db.get_by_status(db_path, db.STATUS_FINE_FILTER_PASSED)
    total = len(positions)
    print(f"Positions to tag: {total}")

    if not positions:
        print("Nothing to do.")
        return

    cancel = Event()
    dispatcher_done = Event()

    def _sigint(*_):
        print("\n\nCtrl+C — stopping...")
        cancel.set()

    signal.signal(signal.SIGINT, _sigint)

    future_queue = queue.Queue(maxsize=WINDOW_SIZE * 4)

    Thread(
        target=_dispatcher,
        args=(positions, future_queue, cancel, dispatcher_done),
        daemon=True,
    ).start()

    in_flight: list[tuple] = []
    total_done = 0
    total_failed = 0
    start_time = time.time()

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
                print(f"\n[watchdog] stuck in '{_phase[0]}' for {stuck:.1f}s", flush=True)

    Thread(target=_watchdog, daemon=True).start()

    while not cancel.is_set():
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

        _set_phase("scan")
        _t0 = time.time()
        collected = 0
        still_waiting = []
        to_write = []

        backend = tag_tactics.app.backend
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
                updated_pos = meta["result"]
            except Exception:
                total_failed += 1
                continue

            to_write.append(updated_pos)
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
    print(f"\n\nDone in {elapsed:.1f}s | tagged {total_done} | failed {total_failed}")

    if total_done > 0:
        all_positions = db.get_by_status(db_path, db.STATUS_FINE_FILTER_PASSED)
        tactics_counts = Counter(t for p in all_positions for t in p.get("tactics", []))
        print(f"Tactics: {dict(tactics_counts)}")

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
