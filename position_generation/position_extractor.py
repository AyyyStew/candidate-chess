import chess.pgn
import chess
import chess.engine
import json
import random
import os
import glob
from multiprocessing import Process, Queue
from collections import Counter
import re

# --- Config ---
ENGINE_PATH = r"C:\Users\alexs\Desktop\stockfish\stockfish-windows-x86-64-avx2.exe"
PGN_DIR = "./LichessEliteDatabase"
OUTPUT_FILE = "training_positions.jsonl"
PROGRESS_FILE = "progress.json"

TARGET = None
TARGET_PER_FILE = 200

DEPTH = 16
MULTIPV = 5
SAMPLE_EVERY_N_MIN = 2
SAMPLE_EVERY_N_MAX = 10

N_WORKERS = 7
THREADS_PER_WORKER = 2
HASH_PER_WORKER = 512

THRESHOLDS = {
    "max_position_cp": 900,
    "move2_cp": 150,
    "move3_cp": 150,
    "move4_cp": 200,
    "move5_cp": 300,
}

MATE_CHECK_TOP_N = 3  # reject position if any of the top N moves is mate
PV_LINE_MOVES = 10  # number of moves stored per PV line
MIN_MOVE_NUMBER = 5  # earliest fullmove number considered for sampling
MAX_MOVE_NUMBER = 50  # latest fullmove number considered for sampling
MIN_PIECE_COUNT = 8  # minimum pieces on board for a position to be sampled
GAME_SAMPLE_RATE = 0.25  # fraction of games in a PGN file to consider
MIN_GAMES_TO_SAMPLE = 200  # floor on absolute number of games sampled per file
PREFETCH_QUEUE_SIZE = 2  # how many files the extraction thread stays ahead
WORKER_JOIN_TIMEOUT = 5  # seconds to wait for a worker process to exit cleanly

# ── helpers ───────────────────────────────────────────────────────────────────


def is_viable(pvs):
    if len(pvs) < MULTIPV:
        return False, "pvs"
    if any("mate" in pv for pv in pvs[:MATE_CHECK_TOP_N]):
        return False, "mate"
    if not all("cp" in pv for pv in pvs[:MULTIPV]):
        return False, "pvs"

    scores = [pv["cp"] for pv in pvs[:MULTIPV]]
    best = scores[0]

    if abs(best) > THRESHOLDS["max_position_cp"]:
        return False, "won"

    limits = [
        THRESHOLDS["move2_cp"],
        THRESHOLDS["move3_cp"],
        THRESHOLDS["move4_cp"],
        THRESHOLDS["move5_cp"],
    ]
    for i, limit in enumerate(limits):
        if abs(best - scores[i + 1]) > limit:
            return False, "spread"

    return True, "ok"


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
            entry["line"] = " ".join(m.uci() for m in pv_info["pv"][:PV_LINE_MOVES])
            entry["best_move"] = pv_info["pv"][0].uci() if pv_info["pv"] else None
        pvs.append(entry)
    return pvs


def get_move_number_range(board):
    move_num = board.fullmove_number
    piece_count = bin(int(board.occupied)).count("1")
    return (
        MIN_MOVE_NUMBER <= move_num <= MAX_MOVE_NUMBER
        and piece_count >= MIN_PIECE_COUNT
    )


# ── extraction ────────────────────────────────────────────────────────────────


from threading import Thread
from queue import Queue as ThreadQueue
import io


def extract_positions_from_file(pgn_path, seen_fens, game_sample_rate=GAME_SAMPLE_RATE):
    positions = []

    with open(pgn_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Split into individual games on [Event tag — avoids parsing every game
    raw_games = re.split(r"\n(?=\[Event )", content)

    # Sample before parsing — this is the key speedup
    k = max(MIN_GAMES_TO_SAMPLE, int(len(raw_games) * game_sample_rate))
    sampled = random.sample(raw_games, min(k, len(raw_games)))

    for raw in sampled:
        try:
            game = chess.pgn.read_game(io.StringIO(raw))
            if game is None:
                continue
            board = game.board()
            move_index = 0
            next_sample = random.randint(SAMPLE_EVERY_N_MIN, SAMPLE_EVERY_N_MAX)

            for move in game.mainline_moves():
                board.push(move)
                move_index += 1
                if move_index == next_sample:
                    if get_move_number_range(board):
                        fen = board.fen()
                        if fen not in seen_fens:
                            positions.append(
                                {
                                    "fen": fen,
                                    "move_number": board.fullmove_number,
                                    "piece_count": bin(int(board.occupied)).count("1"),
                                    "side_to_move": (
                                        "white"
                                        if board.turn == chess.WHITE
                                        else "black"
                                    ),
                                    "source_game": {
                                        "white": game.headers.get("White", "?"),
                                        "black": game.headers.get("Black", "?"),
                                        "white_elo": game.headers.get("WhiteElo", "?"),
                                        "black_elo": game.headers.get("BlackElo", "?"),
                                        "opening": game.headers.get("Opening", "?"),
                                        "eco": game.headers.get("ECO", "?"),
                                        "date": game.headers.get("UTCDate", "?"),
                                        "pgn": raw.strip(),
                                    },
                                }
                            )
                    next_sample += random.randint(
                        SAMPLE_EVERY_N_MIN, SAMPLE_EVERY_N_MAX
                    )
        except Exception:
            continue

    return positions


def extraction_thread(
    pgn_files, seen_fens, prefetch_queue, game_sample_rate=GAME_SAMPLE_RATE
):
    """Runs in background, stays 1-2 files ahead of eval workers."""
    for pgn_path in pgn_files:
        positions = extract_positions_from_file(pgn_path, seen_fens, game_sample_rate)
        random.shuffle(positions)
        prefetch_queue.put((pgn_path, positions))  # blocks if queue is full
    prefetch_queue.put(None)  # signal done


# ── worker — stays alive for entire run ───────────────────────────────────────

STOP_SIGNAL = None


def worker(task_queue, result_queue):
    """
    Spins up once, stays alive for the whole run.
    Pulls positions from task_queue until it sees STOP_SIGNAL.
    """
    try:
        with chess.engine.SimpleEngine.popen_uci(ENGINE_PATH) as engine:
            engine.configure({"Threads": THREADS_PER_WORKER, "Hash": HASH_PER_WORKER})

            while True:
                pos = task_queue.get()

                if pos is STOP_SIGNAL:
                    task_queue.put(STOP_SIGNAL)  # pass it on for other workers
                    break

                try:
                    board = chess.Board(pos["fen"])
                    info = engine.analyse(
                        board, chess.engine.Limit(depth=DEPTH), multipv=MULTIPV
                    )
                    pvs = parse_pvs(info)
                    viable, reason = is_viable(pvs)

                    if viable:
                        pos["eval"] = {"depth": DEPTH, "pvs": pvs}
                        result_queue.put(("keep", pos, reason))
                    else:
                        result_queue.put(("reject", None, reason))

                except Exception as e:
                    result_queue.put(("error", None, str(e)))

    except Exception as e:
        result_queue.put(("error", None, f"Engine failed: {e}"))


# ── utils ─────────────────────────────────────────────────────────────────────


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"completed_files": [], "total_kept": 0}


def save_progress(progress):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)


def count_existing_output():
    if not os.path.exists(OUTPUT_FILE):
        return 0
    with open(OUTPUT_FILE, "r") as f:
        return sum(1 for line in f if line.strip())


def load_existing_fens():
    seen = set()
    if not os.path.exists(OUTPUT_FILE):
        return seen
    with open(OUTPUT_FILE, "r") as f:
        for line in f:
            if line.strip():
                try:
                    seen.add(json.loads(line)["fen"])
                except json.JSONDecodeError:
                    pass
    print(f"  Loaded {len(seen)} existing FENs")
    return seen


def get_stats():
    with open(OUTPUT_FILE) as f:
        positions = [json.loads(l) for l in f]

    moves = [p["move_number"] for p in positions]
    sides = Counter(p["side_to_move"] for p in positions)
    pieces = [p["piece_count"] for p in positions]
    ecos = Counter(p["source_game"]["eco"] for p in positions)

    print(f"\n── Dataset Stats ──")
    print(f"Total:        {len(positions)}")
    print(f"Avg move:     {sum(moves)/len(moves):.1f}")
    print(f"Move range:   {min(moves)}-{max(moves)}")
    print(f"Side to move: {dict(sides)}")
    print(f"Avg pieces:   {sum(pieces)/len(pieces):.1f}")
    print(f"Top 10 ECOs:  {ecos.most_common(10)}")


# ── main ──────────────────────────────────────────────────────────────────────


def run():
    progress = load_progress()
    progress["total_kept"] = count_existing_output()
    seen_fens = load_existing_fens()

    if TARGET and progress["total_kept"] >= TARGET:
        print(f"Already have {progress['total_kept']} positions. Done!")
        return

    pgn_files = sorted(glob.glob(os.path.join(PGN_DIR, "*.pgn")))
    remaining = [
        f for f in pgn_files if os.path.basename(f) not in progress["completed_files"]
    ]

    print(f"Target:          {'all' if TARGET is None else TARGET}")
    print(f"Per file cap:    {TARGET_PER_FILE}")
    print(f"Already kept:    {progress['total_kept']}")
    print(f"Files remaining: {len(remaining)} / {len(pgn_files)}")
    print(f"Workers:         {N_WORKERS} × {THREADS_PER_WORKER} threads each\n")

    # Spin up workers ONCE for the entire run
    task_queue = Queue()
    result_queue = Queue()

    workers = []
    for _ in range(N_WORKERS):
        p = Process(target=worker, args=(task_queue, result_queue))
        p.start()
        workers.append(p)

    print(f"Workers started. Processing files...\n")

    prefetch_queue = ThreadQueue(maxsize=PREFETCH_QUEUE_SIZE)

    extractor = Thread(
        target=extraction_thread,
        args=(remaining, seen_fens, prefetch_queue, GAME_SAMPLE_RATE),
        daemon=True,
    )
    extractor.start()

    try:
        while True:
            item = prefetch_queue.get()
            if item is None:
                break

            pgn_path, positions = item
            filename = os.path.basename(pgn_path)
            print(f"── {filename} ({len(positions)} candidates) ──")

            if not positions:
                progress["completed_files"].append(filename)
                save_progress(progress)
                continue

            # rest of your existing file processing loop unchanged
            for pos in positions:
                task_queue.put(pos)

            file_kept = 0
            file_stats = {"mate": 0, "spread": 0, "won": 0, "pvs": 0, "error": 0}
            total_results = 0

            with open(OUTPUT_FILE, "a") as out:
                while total_results < len(positions):
                    status, pos, reason = result_queue.get()
                    total_results += 1
                    if status == "keep":
                        if pos["fen"] not in seen_fens:
                            out.write(json.dumps(pos) + "\n")
                            out.flush()
                            seen_fens.add(pos["fen"])
                            file_kept += 1
                            print(
                                f"  ✓ {file_kept} kept | {total_results}/{len(positions)} evaluated",
                                end="\r",
                            )
                    elif status == "error":
                        file_stats["error"] += 1
                    else:
                        file_stats[reason] = file_stats.get(reason, 0) + 1

                    if TARGET_PER_FILE and file_kept >= TARGET_PER_FILE:
                        print(
                            f"\n  Hit TARGET_PER_FILE ({TARGET_PER_FILE}), moving to next file"
                        )
                        # Drain remaining items from queue so workers
                        # don't keep processing positions from this file
                        while not task_queue.empty():
                            try:
                                task_queue.get_nowait()
                            except Exception:
                                break
                        break

            progress["total_kept"] += file_kept
            progress["completed_files"].append(filename)
            save_progress(progress)

            if TARGET and progress["total_kept"] >= TARGET:
                break

    finally:
        task_queue.put(STOP_SIGNAL)
        for p in workers:
            p.join(timeout=WORKER_JOIN_TIMEOUT)
            if p.is_alive():
                p.terminate()

    print(f"Done. {count_existing_output()} positions saved to {OUTPUT_FILE}")
    get_stats()


if __name__ == "__main__":
    run()
