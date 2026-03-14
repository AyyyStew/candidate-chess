import json
import chess
import chess.engine
import time
from multiprocessing import Process, Queue

INPUT_FILE = "training_positions.jsonl"
OUTPUT_FILE = "training_positions_evaluated.jsonl"

# --- Config ---
ENGINE_PATH = r"C:\Users\alexs\Desktop\stockfish\stockfish-windows-x86-64-avx2.exe"
MULTIPV = 10
DEPTH = 16
N_WORKERS = 7
THREADS_PER_WORKER = 2
HASH_PER_WORKER = 1024

# ── helpers ───────────────────────────────────────────────────────────────────


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

STOP_SIGNAL = None


def worker(task_queue, result_queue):
    try:
        with chess.engine.SimpleEngine.popen_uci(ENGINE_PATH) as engine:
            engine.configure({"Threads": THREADS_PER_WORKER, "Hash": HASH_PER_WORKER})
            while True:
                pos = task_queue.get()
                if pos is STOP_SIGNAL:
                    task_queue.put(STOP_SIGNAL)
                    break
                try:
                    board = chess.Board(pos["fen"])
                    info = engine.analyse(
                        board, chess.engine.Limit(depth=DEPTH), multipv=MULTIPV
                    )
                    pvs = parse_pvs(info)
                    if not all("cp" in pv for pv in pvs[:5]):
                        result_queue.put(("skip", None))
                    else:
                        pos["eval"] = {"depth": DEPTH, "pvs": pvs}
                        result_queue.put(("keep", pos))
                except Exception:
                    result_queue.put(("error", None))
    except Exception:
        result_queue.put(("error", None))


# ── main ──────────────────────────────────────────────────────────────────────


def run():
    with open(INPUT_FILE) as f:
        all_positions = [json.loads(line) for line in f if line.strip()]

    total = len(all_positions)
    print(f"Loaded {total} positions. Starting {N_WORKERS} workers...\n")

    task_queue = Queue()
    result_queue = Queue()

    workers = []
    for _ in range(N_WORKERS):
        p = Process(target=worker, args=(task_queue, result_queue))
        p.start()
        workers.append(p)

    for pos in all_positions:
        task_queue.put(pos)
    task_queue.put(STOP_SIGNAL)

    results = []
    skipped = 0
    processed = 0
    start = time.time()

    while processed < total:
        status, result = result_queue.get()
        processed += 1
        if status == "keep":
            results.append(result)
        else:
            skipped += 1

        elapsed = time.time() - start
        rate = processed / elapsed if elapsed > 0 else 0
        eta = (total - processed) / rate if rate > 0 else 0
        print(
            f"  {processed}/{total} | {rate:.1f} pos/s | ETA {eta:.0f}s | kept {len(results)} skipped {skipped}",
            end="\r",
        )

    for p in workers:
        p.join(timeout=5)
        if p.is_alive():
            p.terminate()

    print(f"\nDone. Kept {len(results)} | Skipped {skipped}")

    with open(OUTPUT_FILE, "w") as f:
        for pos in results:
            f.write(json.dumps(pos) + "\n")

    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    run()
