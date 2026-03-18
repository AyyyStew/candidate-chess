import chess.pgn
import chess
import chess.engine
import json
import random
import os
import glob
from multiprocessing import Process, Queue
from collections import Counter
from threading import Thread
from queue import Queue as ThreadQueue
import re
import io

STOP_SIGNAL = None


# ── helpers ───────────────────────────────────────────────────────────────────


def is_viable(pvs, multipv, thresholds, mate_check_top_n):
    if len(pvs) < multipv:
        return False, "pvs"
    if any("mate" in pv for pv in pvs[:mate_check_top_n]):
        return False, "mate"
    if not all("cp" in pv for pv in pvs[:multipv]):
        return False, "pvs"

    scores = [pv["cp"] for pv in pvs[:multipv]]
    best = scores[0]

    if abs(best) > thresholds["max_position_cp"]:
        return False, "won"

    limits = [
        thresholds["move2_cp"],
        thresholds["move3_cp"],
        thresholds["move4_cp"],
        thresholds["move5_cp"],
    ]
    for i, limit in enumerate(limits):
        if abs(best - scores[i + 1]) > limit:
            return False, "spread"

    return True, "ok"


def parse_pvs(info, pv_line_moves):
    pvs = []
    for pv_info in info:
        entry = {}
        score = pv_info["score"].relative
        if score.is_mate():
            entry["mate"] = score.mate()
        else:
            entry["cp"] = score.score()
        if "pv" in pv_info:
            entry["line"] = " ".join(m.uci() for m in pv_info["pv"][:pv_line_moves])
            entry["best_move"] = pv_info["pv"][0].uci() if pv_info["pv"] else None
        pvs.append(entry)
    return pvs


def get_move_number_range(board, min_move_number, max_move_number, min_piece_count):
    move_num = board.fullmove_number
    piece_count = bin(int(board.occupied)).count("1")
    return (
        min_move_number <= move_num <= max_move_number
        and piece_count >= min_piece_count
    )


# ── extraction ────────────────────────────────────────────────────────────────


def extract_positions_from_file(
    pgn_path,
    seen_fens,
    pv_line_moves,
    sample_every_n_min,
    sample_every_n_max,
    min_move_number,
    max_move_number,
    min_piece_count,
    game_sample_rate,
    min_games_to_sample,
):
    positions = []

    with open(pgn_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    raw_games = re.split(r"\n(?=\[Event )", content)

    k = max(min_games_to_sample, int(len(raw_games) * game_sample_rate))
    sampled = random.sample(raw_games, min(k, len(raw_games)))

    for raw in sampled:
        try:
            game = chess.pgn.read_game(io.StringIO(raw))
            if game is None:
                continue
            board = game.board()
            move_index = 0
            next_sample = random.randint(sample_every_n_min, sample_every_n_max)

            for move in game.mainline_moves():
                board.push(move)
                move_index += 1
                if move_index == next_sample:
                    if get_move_number_range(board, min_move_number, max_move_number, min_piece_count):
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
                    next_sample += random.randint(sample_every_n_min, sample_every_n_max)
        except Exception:
            continue

    return positions


def extraction_thread(
    pgn_files,
    seen_fens,
    prefetch_queue,
    pv_line_moves,
    sample_every_n_min,
    sample_every_n_max,
    min_move_number,
    max_move_number,
    min_piece_count,
    game_sample_rate,
    min_games_to_sample,
):
    for pgn_path in pgn_files:
        positions = extract_positions_from_file(
            pgn_path, seen_fens, pv_line_moves,
            sample_every_n_min, sample_every_n_max,
            min_move_number, max_move_number, min_piece_count,
            game_sample_rate, min_games_to_sample,
        )
        random.shuffle(positions)
        prefetch_queue.put((pgn_path, positions))
    prefetch_queue.put(None)


# ── worker ────────────────────────────────────────────────────────────────────


def worker(
    task_queue,
    result_queue,
    engine_path,
    depth,
    multipv,
    threads_per_worker,
    hash_per_worker,
    thresholds,
    mate_check_top_n,
    pv_line_moves,
):
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
                    pvs = parse_pvs(info, pv_line_moves)
                    viable, reason = is_viable(pvs, multipv, thresholds, mate_check_top_n)

                    if viable:
                        pos["eval"] = {"depth": depth, "pvs": pvs}
                        result_queue.put(("keep", pos, reason))
                    else:
                        result_queue.put(("reject", None, reason))

                except Exception as e:
                    result_queue.put(("error", None, str(e)))

    except Exception as e:
        result_queue.put(("error", None, f"Engine failed: {e}"))


# ── utils ─────────────────────────────────────────────────────────────────────


def load_progress(progress_file):
    if os.path.exists(progress_file):
        with open(progress_file, "r") as f:
            return json.load(f)
    return {"completed_files": [], "total_kept": 0}


def save_progress(progress, progress_file):
    with open(progress_file, "w") as f:
        json.dump(progress, f, indent=2)


def count_existing_output(output_file):
    if not os.path.exists(output_file):
        return 0
    with open(output_file, "r") as f:
        return sum(1 for line in f if line.strip())


def load_existing_fens(output_file):
    seen = set()
    if not os.path.exists(output_file):
        return seen
    with open(output_file, "r") as f:
        for line in f:
            if line.strip():
                try:
                    seen.add(json.loads(line)["fen"])
                except json.JSONDecodeError:
                    pass
    print(f"  Loaded {len(seen)} existing FENs")
    return seen


def get_stats(output_file):
    with open(output_file) as f:
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


def run(
    output_file="training_positions.jsonl",
    progress_file="progress.json",
    pgn_dir="./LichessEliteDatabase",
    engine_path=r"C:\Users\alexs\Desktop\stockfish\stockfish-windows-x86-64-avx2.exe",
    target=None,
    target_per_file=200,
    depth=16,
    multipv=5,
    sample_every_n_min=2,
    sample_every_n_max=10,
    n_workers=7,
    threads_per_worker=2,
    hash_per_worker=512,
    thresholds=None,
    mate_check_top_n=3,
    pv_line_moves=10,
    min_move_number=5,
    max_move_number=50,
    min_piece_count=8,
    game_sample_rate=0.25,
    min_games_to_sample=200,
    prefetch_queue_size=2,
    worker_join_timeout=5,
):
    if thresholds is None:
        thresholds = {
            "max_position_cp": 900,
            "move2_cp": 150,
            "move3_cp": 150,
            "move4_cp": 200,
            "move5_cp": 300,
        }

    progress = load_progress(progress_file)
    progress["total_kept"] = count_existing_output(output_file)
    seen_fens = load_existing_fens(output_file)

    if target and progress["total_kept"] >= target:
        print(f"Already have {progress['total_kept']} positions. Done!")
        return

    pgn_files = sorted(glob.glob(os.path.join(pgn_dir, "*.pgn")))
    remaining = [
        f for f in pgn_files if os.path.basename(f) not in progress["completed_files"]
    ]

    print(f"Target:          {'all' if target is None else target}")
    print(f"Per file cap:    {target_per_file}")
    print(f"Already kept:    {progress['total_kept']}")
    print(f"Files remaining: {len(remaining)} / {len(pgn_files)}")
    print(f"Workers:         {n_workers} × {threads_per_worker} threads each\n")

    task_queue = Queue()
    result_queue = Queue()

    workers = []
    for _ in range(n_workers):
        p = Process(
            target=worker,
            args=(
                task_queue, result_queue, engine_path, depth, multipv,
                threads_per_worker, hash_per_worker, thresholds, mate_check_top_n, pv_line_moves,
            ),
        )
        p.start()
        workers.append(p)

    print(f"Workers started. Processing files...\n")

    prefetch_queue = ThreadQueue(maxsize=prefetch_queue_size)

    extractor = Thread(
        target=extraction_thread,
        args=(
            remaining, seen_fens, prefetch_queue,
            pv_line_moves, sample_every_n_min, sample_every_n_max,
            min_move_number, max_move_number, min_piece_count,
            game_sample_rate, min_games_to_sample,
        ),
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
                save_progress(progress, progress_file)
                continue

            for pos in positions:
                task_queue.put(pos)

            file_kept = 0
            file_stats = {"mate": 0, "spread": 0, "won": 0, "pvs": 0, "error": 0}
            total_results = 0

            with open(output_file, "a") as out:
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

                    if target_per_file and file_kept >= target_per_file:
                        print(
                            f"\n  Hit TARGET_PER_FILE ({target_per_file}), moving to next file"
                        )
                        while not task_queue.empty():
                            try:
                                task_queue.get_nowait()
                            except Exception:
                                break
                        break

            progress["total_kept"] += file_kept
            progress["completed_files"].append(filename)
            save_progress(progress, progress_file)

            if target and progress["total_kept"] >= target:
                break

    finally:
        task_queue.put(STOP_SIGNAL)
        for p in workers:
            p.join(timeout=worker_join_timeout)
            if p.is_alive():
                p.terminate()

    print(f"Done. {count_existing_output(output_file)} positions saved to {output_file}")
    get_stats(output_file)


if __name__ == "__main__":
    run()
