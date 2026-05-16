# -*- coding: utf-8 -*-
"""SQLite setup — single file for all dashboard data."""
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path

# En Render, montar el disco persistente en /var/data y set RENDER_DATA_DIR=/var/data
# En desarrollo local usa la carpeta data/ del proyecto
_DATA_DIR = Path(os.environ.get("RENDER_DATA_DIR", "")) or Path(__file__).parent.parent / "data"
DB_PATH = _DATA_DIR / "dashboard.db"


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def log_finance_history(action: str, tab: str, row_index: int | None = None,
                        data: dict | None = None, reason: str | None = None,
                        user_email: str | None = None) -> None:
    """Registra una operacion CRUD en el historial de finanzas."""
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO finance_history
               (action, tab, row_index, data, reason, user_email, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (action, tab, row_index,
             json.dumps(data, ensure_ascii=False) if data else None,
             reason, user_email, datetime.now().isoformat())
        )


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

            CREATE TABLE IF NOT EXISTS finance_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                action      TEXT NOT NULL,
                tab         TEXT NOT NULL,
                row_index   INTEGER,
                data        TEXT,
                reason      TEXT,
                user_email  TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS health_daily (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                date            TEXT NOT NULL UNIQUE,
                steps           INTEGER,
                calories        REAL,
                heart_rate_avg  REAL,
                heart_rate_min  REAL,
                heart_rate_max  REAL,
                hrv             REAL,
                spo2            REAL,
                sleep_hours     REAL,
                sleep_deep      REAL,
                sleep_rem       REAL,
                sleep_awake     REAL,
                active_energy   REAL,
                distance_km     REAL,
                synced_at       TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_msg_agent      ON messages(agent_slug);
            CREATE INDEX IF NOT EXISTS idx_log_level      ON logs(level);
            CREATE INDEX IF NOT EXISTS idx_log_agent      ON logs(agent_slug);
            CREATE INDEX IF NOT EXISTS idx_reset_token    ON reset_tokens(token);
            CREATE INDEX IF NOT EXISTS idx_fin_hist_tab   ON finance_history(tab);
            CREATE INDEX IF NOT EXISTS idx_fin_hist_action ON finance_history(action);
            CREATE INDEX IF NOT EXISTS idx_health_date    ON health_daily(date);

            CREATE TABLE IF NOT EXISTS belvo_links (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                belvo_id     TEXT NOT NULL UNIQUE,
                institution  TEXT NOT NULL,
                status       TEXT NOT NULL DEFAULT 'valid',
                created_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS belvo_accounts (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                belvo_id       TEXT NOT NULL UNIQUE,
                link_id        TEXT NOT NULL,
                institution    TEXT NOT NULL,
                name           TEXT NOT NULL,
                type           TEXT NOT NULL,
                currency       TEXT NOT NULL DEFAULT 'COP',
                balance        REAL NOT NULL DEFAULT 0,
                credit_data    TEXT,
                synced_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS belvo_transactions (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                belvo_id            TEXT NOT NULL UNIQUE,
                account_id          TEXT NOT NULL,
                amount              REAL NOT NULL,
                currency            TEXT NOT NULL DEFAULT 'COP',
                description         TEXT,
                category            TEXT,
                type                TEXT NOT NULL,
                status              TEXT NOT NULL,
                value_date          TEXT NOT NULL,
                installment_number  INTEGER,
                installment_total   INTEGER,
                merchant            TEXT,
                created_at          TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS webhook_events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                source      TEXT NOT NULL DEFAULT 'external',
                event_type  TEXT NOT NULL DEFAULT 'trigger',
                payload     TEXT,
                received_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_webhook_received ON webhook_events(received_at);
            CREATE TABLE IF NOT EXISTS backlog_tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                description TEXT DEFAULT '',
                status      TEXT NOT NULL DEFAULT 'backlog',
                priority    TEXT NOT NULL DEFAULT 'medium',
                sprint      TEXT DEFAULT '',
                tags        TEXT DEFAULT '',
                due_date    TEXT DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS backlog_subtasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id     INTEGER NOT NULL REFERENCES backlog_tasks(id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                done        INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_backlog_status ON backlog_tasks(status);
            CREATE INDEX IF NOT EXISTS idx_backlog_priority ON backlog_tasks(priority);
            CREATE INDEX IF NOT EXISTS idx_subtasks_task ON backlog_subtasks(task_id);

        """)