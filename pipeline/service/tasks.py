import io
from functools import lru_cache

import chess
import chess.engine
import chess.pgn

from celery.signals import worker_process_init, worker_process_shutdown
from service.app import app, config
from utils.cook import cook as cook_puzzle
from utils.model import Puzzle

_EXCLUDED_TAGS = {
    "mate", "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5",
    "oneMove", "short", "long", "veryLong",
}

_engine: chess.engine.SimpleEngine | None = None


@worker_process_init.connect
def init_engine(**kwargs):
    global _engine
    worker_cfg = config.get("worker", {})
    stockfish_path = worker_cfg.get("stockfish_path")
    if not stockfish_path:
        return  # tactics-only worker — no engine needed
    try:
        _engine = chess.engine.SimpleEngine.popen_uci(stockfish_path)
        _engine.configure({
            "Threads": worker_cfg["threads"],
            "Hash": worker_cfg["hash_mb"],
        })
    except Exception as e:
        print(f"[worker] Stockfish init failed: {e} — eval tasks will fail")


@worker_process_shutdown.connect
def shutdown_engine(**kwargs):
    global _engine
    if _engine:
        _engine.quit()
        _engine = None


def _parse_pvs(info, pv_line_moves=10):
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


@lru_cache(maxsize=256)
def _src_moves(pgn_str: str):
    """Parse a PGN once, return (initial_fen, uci_moves_tuple). Cached per unique PGN."""
    game = chess.pgn.read_game(io.StringIO(pgn_str))
    if game is None:
        return None
    return game.board().fen(), tuple(m.uci() for m in game.mainline_moves())


def _build_puzzle(pos: dict, pv: dict) -> Puzzle | None:
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
            parsed = _src_moves(pgn_str)
            if parsed is None:
                return None
            initial_fen, uci_moves = parsed
            if target_ply - 1 >= len(uci_moves):
                return None

            board = chess.Board(initial_fen)
            for uci in uci_moves[:target_ply - 1]:
                board.push(chess.Move.from_uci(uci))
            preceding_move = chess.Move.from_uci(uci_moves[target_ply - 1])

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

        if not (pgn_str and target_ply > 0):
            puzzle.pov = chess.WHITE if side == "white" else chess.BLACK
            puzzle.mainline = [new_game] + list(new_game.mainline())  # type: ignore[list-item]

        return puzzle
    except Exception:
        return None


@app.task(queue="tactics", bind=True, max_retries=2)
def tag_tactics(self, pos: dict) -> dict:
    """
    Tag a position's PV lines with lichess-cook tactic themes.
    Returns the full updated position dict.
    """
    try:
        best_eval = max(pos.get("evals", []), key=lambda e: e.get("depth", 0), default={})
        pvs = best_eval.get("pvs", [])

        all_tags: set[str] = set()
        for pv in pvs:
            puzzle = _build_puzzle(pos, pv)
            pv_tags = [t for t in cook_puzzle(puzzle) if t not in _EXCLUDED_TAGS] if puzzle else []
            pv["tactics"] = pv_tags
            all_tags.update(pv_tags)

        pos["tactics"] = sorted(all_tags)
        return pos
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2)


@app.task(queue="eval", bind=True, max_retries=2)
def evaluate(self, fen: str, depth: int, multipv: int, pv_line_moves: int = 10):
    """
    Evaluate a position with Stockfish.
    Returns {"depth": int, "pvs": [...]} or raises on failure.
    """
    try:
        board = chess.Board(fen)
        info = _engine.analyse(board, chess.engine.Limit(depth=depth), multipv=multipv)
        pvs = _parse_pvs(info, pv_line_moves)
        return {"depth": depth, "multipv": multipv, "pvs": pvs}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2)
