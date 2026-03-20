import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

# Possible status values
STATUS_EXTRACTED          = "extracted"           # saved from extract, not yet enriched
STATUS_FINE_FILTER_PASSED = "fine_filter_passed"  # passed enrich fine filter
STATUS_FINE_FILTER_FAILED = "fine_filter_failed"  # failed enrich fine filter


def init(db_path: str):
    with _connect(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS positions (
                id         TEXT PRIMARY KEY,
                status     TEXT NOT NULL,
                data       TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON positions(status)")


@contextmanager
def _connect(db_path: str):
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def upsert(db_path: str, position: dict):
    """Insert or update a position by id."""
    now = datetime.now(timezone.utc).isoformat()
    with _connect(db_path) as conn:
        conn.execute("""
            INSERT INTO positions (id, status, data, updated_at)
            VALUES (:id, :status, :data, :now)
            ON CONFLICT(id) DO UPDATE SET
                status     = excluded.status,
                data       = excluded.data,
                updated_at = excluded.updated_at
        """, {
            "id": position["id"],
            "status": position["status"],
            "data": json.dumps(position),
            "now": now,
        })


def upsert_many(db_path: str, positions: list[dict]):
    """Bulk upsert for efficiency."""
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        (p["id"], p["status"], json.dumps(p), now)
        for p in positions
    ]
    with _connect(db_path) as conn:
        conn.executemany("""
            INSERT INTO positions (id, status, data, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status     = excluded.status,
                data       = excluded.data,
                updated_at = excluded.updated_at
        """, rows)


def get_all(db_path: str) -> list[dict]:
    """Return all positions regardless of status."""
    with _connect(db_path) as conn:
        rows = conn.execute("SELECT data FROM positions").fetchall()
    return [json.loads(row["data"]) for row in rows]


def get_by_status(db_path: str, status: str) -> list[dict]:
    """Return all positions with the given status."""
    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT data FROM positions WHERE status = ?", (status,)
        ).fetchall()
    return [json.loads(row["data"]) for row in rows]


def count_by_status(db_path: str) -> dict[str, int]:
    """Return counts grouped by status."""
    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) as n FROM positions GROUP BY status"
        ).fetchall()
    return {row["status"]: row["n"] for row in rows}


def query(db_path: str, sql: str, params: tuple = ()) -> list[dict]:
    """
    Run an arbitrary SELECT against the positions table.
    json_extract(data, '$.field') is available for querying JSON fields.

    Example:
        query(db, "SELECT data FROM positions WHERE json_extract(data, '$.eval.depth') = ?", (20,))
    """
    with _connect(db_path) as conn:
        rows = conn.execute(sql, params).fetchall()
    results = []
    for row in rows:
        try:
            results.append(json.loads(row[0]))
        except (json.JSONDecodeError, IndexError):
            results.append(dict(row))
    return results
