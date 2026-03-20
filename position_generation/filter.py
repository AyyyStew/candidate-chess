"""
Composable filter functions.

Each filter takes a position dict and returns (passed: bool, reason: str).
Use run_filters() to apply a list of filters in order — stops at first failure.
"""


def run_filters(pos: dict, filters: list) -> tuple[bool, str]:
    for f in filters:
        passed, reason = f(pos)
        if not passed:
            return False, reason
    return True, "ok"


# ── coarse filters (used in extract, applied after cheap eval) ─────────────────


def coarse_viable(
    max_position_cp: int = 900,
    move2_cp: int = 150,
    move3_cp: int = 150,
    move4_cp: int = 200,
    move5_cp: int = 300,
    mate_check_top_n: int = 3,
    multipv: int = 5,
):
    def _filter(pos: dict) -> tuple[bool, str]:
        pvs = pos.get("evals", [{}])[0].get("pvs", [])

        if len(pvs) < multipv:
            return False, "pvs"
        if any("mate" in pv for pv in pvs[:mate_check_top_n]):
            return False, "mate"
        if not all("cp" in pv for pv in pvs[:multipv]):
            return False, "pvs"

        scores = [pv["cp"] for pv in pvs[:multipv]]
        best = scores[0]

        if abs(best) > max_position_cp:
            return False, "won"

        limits = [move2_cp, move3_cp, move4_cp, move5_cp]
        for i, limit in enumerate(limits):
            if abs(best - scores[i + 1]) > limit:
                return False, "spread"

        return True, "ok"

    return _filter


# ── fine filters (used after enrich) ──────────────────────────────────────────


def reject_balance(reject: set | None = None):
    if reject is None:
        reject = {"losing"}

    def _filter(pos: dict) -> tuple[bool, str]:
        if pos.get("balance") in reject:
            return False, "losing"
        return True, "ok"

    return _filter


def reject_locked_pawns(min_blocked: int = 6, max_tension: int = 0):
    def _filter(pos: dict) -> tuple[bool, str]:
        features = pos.get("features", {})
        if features.get("blocked_pawns", 0) >= min_blocked and features.get("pawn_tension", 0) <= max_tension:
            return False, "locked_pawns"
        return True, "ok"

    return _filter


def min_tactical_activity(min_activity: int = 2):
    def _filter(pos: dict) -> tuple[bool, str]:
        features = pos.get("features", {})
        activity = features.get("captures", 0) + features.get("checks", 0)
        if activity < min_activity:
            return False, "low_activity"
        return True, "ok"

    return _filter


# ── default filter sets ────────────────────────────────────────────────────────


def default_coarse_filters(cfg: dict) -> list:
    return [
        coarse_viable(
            max_position_cp=cfg.get("max_position_cp", 900),
            move2_cp=cfg.get("move2_cp", 150),
            move3_cp=cfg.get("move3_cp", 150),
            move4_cp=cfg.get("move4_cp", 200),
            move5_cp=cfg.get("move5_cp", 300),
            mate_check_top_n=cfg.get("mate_check_top_n", 3),
            multipv=cfg.get("multipv", 5),
        )
    ]


def default_fine_filters() -> list:
    return [
        reject_balance(),
        reject_locked_pawns(),
        min_tactical_activity(),
    ]
