import chess.pgn
import chess
import chess.engine
import json
import random
import os
import glob
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing
from collections import Counter

# --- Config ---
ENGINE_PATH = r"C:\Users\alexs\Desktop\stockfish\stockfish-windows-x86-64-avx2.exe"
PGN_DIR = "./LichessEliteDatabase"
OUTPUT_FILE = "training_positions.jsonl"
PROGRESS_FILE = "progress.json"
TARGET = None
TARGET_PER_FILE = 100
DEPTH = 16
MULTIPV = 5
SAMPLE_EVERY_N_MIN = 2
SAMPLE_EVERY_N_MAX = 10

# Number of parallel workers — each gets its own Stockfish instance
# With 14 threads available, run 7 workers × 2 threads each
N_WORKERS = 7
THREADS_PER_WORKER = 2
HASH_PER_WORKER = 512  # 7 × 512 = 3.5GB total, fits in your 16GB budget

# --- Viability thresholds (loosened slightly) ---
THRESHOLDS = {
    "max_position_cp": 900,  # was 500 — blitz games play on in lost positions
    "move2_cp": 150,  # was 80
    "move3_cp": 150,  # was 80
    "move4_cp": 200,  # was 130
    "move5_cp": 300,  # was 200
}


def is_viable(pvs):
    if len(pvs) < 5:
        return False, "pvs"
    if any("mate" in pv for pv in pvs[:3]):
        return False, "mate"
    if not all("cp" in pv for pv in pvs[:5]):
        return False, "pvs"

    scores = [pv["cp"] for pv in pvs[:5]]
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
            entry["line"] = " ".join(m.uci() for m in pv_info["pv"][:6])
            entry["best_move"] = pv_info["pv"][0].uci() if pv_info["pv"] else None
        pvs.append(entry)
    return pvs


def get_move_number_range(board):
    move_num = board.fullmove_number
    piece_count = bin(int(board.occupied)).count("1")
    return 13 <= move_num <= 60 and piece_count >= 7


def extract_positions_from_file(pgn_path):
    positions = []
    with open(pgn_path, "r", encoding="utf-8", errors="ignore") as f:
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            board = game.board()
            move_index = 0
            next_sample = random.randint(SAMPLE_EVERY_N_MIN, SAMPLE_EVERY_N_MAX)

            for move in game.mainline_moves():
                board.push(move)
                move_index += 1
                if move_index == next_sample:
                    if get_move_number_range(board):
                        positions.append(
                            {
                                "fen": board.fen(),
                                "move_number": board.fullmove_number,
                                "piece_count": bin(int(board.occupied)).count("1"),
                                "side_to_move": (
                                    "white" if board.turn == chess.WHITE else "black"
                                ),
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
                        )
                    next_sample += random.randint(
                        SAMPLE_EVERY_N_MIN, SAMPLE_EVERY_N_MAX
                    )

    return positions


# --- Worker function (runs in its own process) ---


def evaluate_batch(positions_chunk):
    """
    Each worker gets a chunk of positions, spins up its own
    Stockfish instance, evaluates, returns keepers.
    """
    keepers = []
    stats = {"mate": 0, "spread": 0, "won": 0, "pvs": 0, "ok": 0}

    try:
        with chess.engine.SimpleEngine.popen_uci(ENGINE_PATH) as engine:
            engine.configure({"Threads": THREADS_PER_WORKER, "Hash": HASH_PER_WORKER})

            for pos in positions_chunk:
                try:
                    board = chess.Board(pos["fen"])
                    info = engine.analyse(
                        board, chess.engine.Limit(depth=DEPTH), multipv=MULTIPV
                    )
                    pvs = parse_pvs(info)
                    viable, reason = is_viable(pvs)
                    stats[reason] += 1

                    if viable:
                        pos["eval"] = {"depth": DEPTH, "pvs": pvs}
                        keepers.append(pos)

                except Exception:
                    pass

    except Exception as e:
        print(f"Worker engine error: {e}")

    return keepers, stats


def chunk_list(lst, n):
    """Split list into n roughly equal chunks."""
    k, m = divmod(len(lst), n)
    return [lst[i * k + min(i, m) : (i + 1) * k + min(i + 1, m)] for i in range(n)]


# --- Progress tracking ---


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


def get_stats(file=OUTPUT_FILE):
    with open(OUTPUT_FILE) as f:
        positions = [json.loads(l) for l in f]

    moves = [p["move_number"] for p in positions]
    sides = Counter(p["side_to_move"] for p in positions)
    pieces = [p["piece_count"] for p in positions]

    print(f"Total: {len(positions)}")
    print(f"Avg move number: {sum(moves)/len(moves):.1f}")
    print(f"Move range: {min(moves)}-{max(moves)}")
    print(f"Side to move: {dict(sides)}")
    print(f"Avg piece count: {sum(pieces)/len(pieces):.1f}")


# --- Main ---


def run():
    progress = load_progress()
    progress["total_kept"] = count_existing_output()

    # Only check target if one is set
    if TARGET and progress["total_kept"] >= TARGET:
        print(f"Already have {progress['total_kept']} positions. Done!")
        return

    pgn_files = sorted(glob.glob(os.path.join(PGN_DIR, "*.pgn")))
    remaining = [
        f for f in pgn_files if os.path.basename(f) not in progress["completed_files"]
    ]

    print(
        f"Target: {'all' if TARGET is None else TARGET} | Already kept: {progress['total_kept']}"
    )
    print(f"Files remaining: {len(remaining)} / {len(pgn_files)}")
    print(f"Workers: {N_WORKERS} × {THREADS_PER_WORKER} threads each\n")

    for pgn_path in remaining:
        if TARGET:
            needed = TARGET - progress["total_kept"]
            if needed <= 0:
                break
        else:
            needed = float("inf")

        # Cap per file if TARGET_PER_FILE is set
        if TARGET_PER_FILE:
            needed = min(needed, TARGET_PER_FILE)

        filename = os.path.basename(pgn_path)
        print(f"── {filename} ──")

        positions = extract_positions_from_file(pgn_path)
        print(
            f"  Extracted {len(positions)} candidates → splitting across {N_WORKERS} workers"
        )

        if not positions:
            progress["completed_files"].append(filename)
            save_progress(progress)
            continue

        chunks = chunk_list(positions, N_WORKERS)
        file_kept = 0
        file_stats = {"mate": 0, "spread": 0, "won": 0, "pvs": 0, "ok": 0}

        with ProcessPoolExecutor(max_workers=N_WORKERS) as executor:
            futures = [executor.submit(evaluate_batch, chunk) for chunk in chunks]

            with open(OUTPUT_FILE, "a") as out:
                for future in as_completed(futures):
                    keepers, stats = future.result()
                    for k in file_stats:
                        file_stats[k] += stats.get(k, 0)

                    # If no target, write everything
                    still_needed = needed - file_kept
                    to_write = (
                        keepers if needed == float("inf") else keepers[:still_needed]
                    )
                    for pos in to_write:
                        out.write(json.dumps(pos) + "\n")
                    out.flush()
                    file_kept += len(to_write)

        progress["total_kept"] += file_kept
        progress["completed_files"].append(filename)
        save_progress(progress)

        print(f"  Kept: {file_kept} | Total: {progress['total_kept']}")
        print(
            f"  Rejections → mate:{file_stats['mate']} "
            f"spread:{file_stats['spread']} "
            f"won:{file_stats['won']} "
            f"pvs:{file_stats['pvs']}\n"
        )

    print(f"Done. {count_existing_output()} positions saved to {OUTPUT_FILE}")
    get_stats()


if __name__ == "__main__":
    run()
