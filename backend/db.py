# -*- coding: utf-8 -*-
"""SQLite setup — single file for all dashboard data."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "dashboard.db"


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS messages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_slug  TEXT NOT NULL,
                role        TEXT NOT NULL,
                content     TEXT NOT NULL,
                tokens_in   INTEGER DEFAULT 0,
                tokens_out  INTEGER DEFAULT 0,
                cost_usd    REAL    DEFAULT 0,
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                level       TEXT NOT NULL,
                agent_slug  TEXT NOT NULL,
                action      TEXT NOT NULL,
                detail      TEXT NOT NULL,
                duration_ms INTEGER,
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reset_tokens (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                email       TEXT NOT NULL,
                token       TEXT NOT NULL UNIQUE,
                expires_at  TEXT NOT NULL,
                used        INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_msg_agent  ON messages(agent_slug);
            CREATE INDEX IF NOT EXISTS idx_log_level  ON logs(level);
            CREATE INDEX IF NOT EXISTS idx_log_agent  ON logs(agent_slug);
            CREATE INDEX IF NOT EXISTS idx_reset_token ON reset_tokens(token);
        """)
