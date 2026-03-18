import json
import os
import chess
import chess.engine
import time
from multiprocessing import Process, Queue

STOP_SIGNAL = None


def parse_pvs(info):
    pvs = []
    for pv_info in info:
        entry = {}
        score = pv_info["score"].relative
        if score.is_mate():
            entry["mate"] = score.mate()
        else:
            entry["cp"] = score.score()
        if "pv" in pv_info:
            entry["line"] = " ".join(m.uci() for m in pv_info["pv"])
            entry["best_move"] = pv_info["pv"][0].uci() if pv_info["pv"] else None
        pvs.append(entry)
    return pvs


# ── worker ────────────────────────────────────────────────────────────────────


def worker(task_queue, result_queue, engine_path, depth, multipv, threads_per_worker, hash_per_worker):
    try:
        with chess.engine.SimpleEngine.popen_uci(engine_path) as engine:
            engine.configure({"Threads": threads_per_worker, "Hash": hash_per_worker})
            while True:
                pos = task_queue.get()
                if pos is STOP_SIGNAL:
                    task_queue.put(STOP_SIGNAL)
                    break
                try:
                    board = chess.Board(pos["fen"])
                    info = engine.analyse(
                        board, chess.engine.Limit(depth=depth), multipv=multipv
                    )
                    pvs = parse_pvs(info)
                    if not all("cp" in pv for pv in pvs[:5]):
                        result_queue.put(("skip", None))
                    else:
                        pos["eval"] = {"depth": depth, "pvs": pvs}
                        result_queue.put(("keep", pos))
                except Exception:
                    result_queue.put(("error", None))
    except Exception:
        result_queue.put(("error", None))


# ── cache helpers ─────────────────────────────────────────────────────────────


def load_eval_cache(output_file):
    """Returns {id: position} for all previously evaluated positions."""
    cache = {}
    files_to_load = [output_file, output_file + ".progress"]
    for path in files_to_load:
        if not os.path.exists(path):
            continue
        with open(path, "r") as f:
            for line in f:
                if line.strip():
                    try:
                        pos = json.loads(line)
                        cache[pos["id"]] = pos
                    except (json.JSONDecodeError, KeyError):
                        pass
    return cache


# ── main ──────────────────────────────────────────────────────────────────────


def run(
    input_file="training_positions_filtered.jsonl",
    output_file="training_positions_evaluated.jsonl",
    engine_path=r"C:\Users\alexs\Desktop\stockfish\stockfish-windows-x86-64-avx2.exe",
    multipv=10,
    depth=16,
    n_workers=7,
    threads_per_worker=2,
    hash_per_worker=1024,
):
    raw_cache = load_eval_cache(output_file)
    cache = {
        id: pos for id, pos in raw_cache.items()
        if pos.get("eval", {}).get("depth") == depth
        and len(pos.get("eval", {}).get("pvs", [])) >= multipv
    }

    with open(input_file) as f:
        all_positions = [json.loads(line) for line in f if line.strip()]

    remaining = [p for p in all_positions if p["id"] not in cache]
    total = len(remaining)

    print(f"Input:        {len(all_positions)} positions")
    print(f"Cached:       {len(cache)} (skipping)")
    print(f"Remaining:    {total}. Starting {n_workers} workers...\n")

    if total == 0:
        print("All positions cached — rebuilding output file.")
        with open(output_file, "w") as out:
            for pos in all_positions:
                if pos["id"] in cache:
                    out.write(json.dumps(cache[pos["id"]]) + "\n")
        print(f"Written: {len(all_positions)} positions.")
        return

    task_queue = Queue()
    result_queue = Queue()

    workers = []
    for _ in range(n_workers):
        p = Process(
            target=worker,
            args=(task_queue, result_queue, engine_path, depth, multipv, threads_per_worker, hash_per_worker),
        )
        p.start()
        workers.append(p)

    for pos in remaining:
        task_queue.put(pos)
    task_queue.put(STOP_SIGNAL)

    kept = 0
    skipped = 0
    processed = 0
    start = time.time()

    progress_file = output_file + ".progress"
    with open(progress_file, "a") as progress_out:
        while processed < total:
            status, result = result_queue.get()
            processed += 1
            if status == "keep":
                cache[result["id"]] = result
                progress_out.write(json.dumps(result) + "\n")
                progress_out.flush()
                kept += 1
            else:
                skipped += 1

            elapsed = time.time() - start
            rate = processed / elapsed if elapsed > 0 else 0
            eta = (total - processed) / rate if rate > 0 else 0
            print(
                f"  {processed}/{total} | {rate:.1f} pos/s | ETA {eta:.0f}s | kept {kept} skipped {skipped}",
                end="\r",
            )

    for p in workers:
        p.join(timeout=5)
        if p.is_alive():
            p.terminate()

    # Rebuild output from current filter input — only positions that still pass
    # the filter are written, pulling eval results from cache.
    with open(output_file, "w") as out:
        written = 0
        for pos in all_positions:
            if pos["id"] in cache:
                out.write(json.dumps(cache[pos["id"]]) + "\n")
                written += 1

    if os.path.exists(progress_file):
        os.remove(progress_file)

    print(f"\nDone. New: {kept} | Skipped: {skipped} | Written: {written}")
    print(f"Saved to {output_file}")


if __name__ == "__main__":
    run()
