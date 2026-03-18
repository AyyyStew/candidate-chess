import chess
import chess.engine

from celery.signals import worker_process_init, worker_process_shutdown
from service.app import app, config

_engine: chess.engine.SimpleEngine | None = None


@worker_process_init.connect
def init_engine(**kwargs):
    global _engine
    worker_cfg = config["worker"]
    _engine = chess.engine.SimpleEngine.popen_uci(worker_cfg["stockfish_path"])
    _engine.configure({
        "Threads": worker_cfg["threads"],
        "Hash": worker_cfg["hash_mb"],
    })


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
        return {"depth": depth, "pvs": pvs}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2)
