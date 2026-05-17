# -*- coding: utf-8 -*-
"""PostgreSQL setup via psycopg2 — Supabase connection for all dashboard data."""
import json
import os
from datetime import datetime
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend/ directory so DATABASE_URL is available
load_dotenv(Path(__file__).parent / ".env", override=True)

import psycopg2
import psycopg2.extras
from psycopg2 import pool

# ── Connection pool ──────────────────────────────────────────────────────────
_DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not _DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Add it to backend/.env or environment variables.")

_pool: pool.SimpleConnectionPool | None = None


def _get_pool() -> pool.SimpleConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = pool.SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=_DATABASE_URL,
        )
    return _pool


@contextmanager
def get_conn():
    """Context manager that yields a psycopg2 connection with RealDictCursor.

    Usage stays identical to before:
        with get_conn() as conn:
            conn.execute(...)

    The connection auto-commits on success and rolls back on exception.
    It is returned to the pool when the context exits.
    """
    p = _get_pool()
    conn = p.getconn()
    conn.autocommit = True
    try:
        # Override cursor factory so .execute().fetchall() returns dicts
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        p.putconn(conn)


def log_finance_history(action: str, tab: str, row_index: int | None = None,
                        data: dict | None = None, reason: str | None = None,
                        user_email: str | None = None) -> None:
    """Registra una operacion CRUD en el historial de finanzas."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO finance_history
               (action, tab, row_index, data, reason, user_email, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (action, tab, row_index,
             json.dumps(data, ensure_ascii=False) if data else None,
             reason, user_email, datetime.now().isoformat())
        )


def init_db() -> None:
    """Create tables if they don't exist (PostgreSQL syntax)."""
    with get_conn() as conn:
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id          SERIAL PRIMARY KEY,
                agent_slug  TEXT NOT NULL,
                role        TEXT NOT NULL,
                content     TEXT NOT NULL,
                tokens_in   INTEGER DEFAULT 0,
                tokens_out  INTEGER DEFAULT 0,
                cost_usd    DOUBLE PRECISION DEFAULT 0,
                created_at  TEXT NOT NULL
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id          SERIAL PRIMARY KEY,
                level       TEXT NOT NULL,
                agent_slug  TEXT NOT NULL,
                action      TEXT NOT NULL,
                detail      TEXT NOT NULL,
                duration_ms INTEGER,
                created_at  TEXT NOT NULL
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS reset_tokens (
                id          SERIAL PRIMARY KEY,
                email       TEXT NOT NULL,
                token       TEXT NOT NULL UNIQUE,
                expires_at  TEXT NOT NULL,
                used        INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT NOW()::TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS finance_history (
                id          SERIAL PRIMARY KEY,
                action      TEXT NOT NULL,
                tab         TEXT NOT NULL,
                row_index   INTEGER,
                data        TEXT,
                reason      TEXT,
                user_email  TEXT,
                created_at  TEXT NOT NULL DEFAULT NOW()::TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS health_daily (
                id              SERIAL PRIMARY KEY,
                date            TEXT NOT NULL UNIQUE,
                steps           INTEGER,
                calories        DOUBLE PRECISION,
                heart_rate_avg  DOUBLE PRECISION,
                heart_rate_min  DOUBLE PRECISION,
                heart_rate_max  DOUBLE PRECISION,
                hrv             DOUBLE PRECISION,
                spo2            DOUBLE PRECISION,
                sleep_hours     DOUBLE PRECISION,
                sleep_deep      DOUBLE PRECISION,
                sleep_rem       DOUBLE PRECISION,
                sleep_awake     DOUBLE PRECISION,
                active_energy   DOUBLE PRECISION,
                distance_km     DOUBLE PRECISION,
                synced_at       TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS belvo_links (
                id           SERIAL PRIMARY KEY,
                belvo_id     TEXT NOT NULL UNIQUE,
                institution  TEXT NOT NULL,
                status       TEXT NOT NULL DEFAULT 'valid',
                created_at   TEXT NOT NULL DEFAULT NOW()::TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS belvo_accounts (
                id             SERIAL PRIMARY KEY,
                belvo_id       TEXT NOT NULL UNIQUE,
                link_id        TEXT NOT NULL,
                institution    TEXT NOT NULL,
                name           TEXT NOT NULL,
                type           TEXT NOT NULL,
                currency       TEXT NOT NULL DEFAULT 'COP',
                balance        DOUBLE PRECISION NOT NULL DEFAULT 0,
                credit_data    TEXT,
                synced_at      TEXT NOT NULL DEFAULT NOW()::TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS belvo_transactions (
                id                  SERIAL PRIMARY KEY,
                belvo_id            TEXT NOT NULL UNIQUE,
                account_id          TEXT NOT NULL,
                amount              DOUBLE PRECISION NOT NULL,
                currency            TEXT NOT NULL DEFAULT 'COP',
                description         TEXT,
                category            TEXT,
                type                TEXT NOT NULL,
                status              TEXT NOT NULL,
                value_date          TEXT NOT NULL,
                installment_number  INTEGER,
                installment_total   INTEGER,
                merchant            TEXT,
                created_at          TEXT NOT NULL DEFAULT NOW()::TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS webhook_events (
                id          SERIAL PRIMARY KEY,
                source      TEXT NOT NULL DEFAULT 'external',
                event_type  TEXT NOT NULL DEFAULT 'trigger',
                payload     TEXT,
                received_at TEXT NOT NULL DEFAULT NOW()::TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS backlog_tasks (
                id          SERIAL PRIMARY KEY,
                title       TEXT NOT NULL,
                description TEXT DEFAULT '',
                status      TEXT NOT NULL DEFAULT 'backlog',
                priority    TEXT NOT NULL DEFAULT 'medium',
                project     TEXT DEFAULT '',
                sprint      TEXT DEFAULT '',
                tags        TEXT DEFAULT '',
                due_date    TEXT DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT NOW()::TEXT,
                updated_at  TEXT NOT NULL DEFAULT NOW()::TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS backlog_subtasks (
                id          SERIAL PRIMARY KEY,
                task_id     INTEGER NOT NULL REFERENCES backlog_tasks(id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                done        INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT NOW()::TEXT
            )
        """)

        # ── Indexes ──────────────────────────────────────────────────────
        indexes = [
            ("idx_msg_agent",        "messages(agent_slug)"),
            ("idx_log_level",        "logs(level)"),
            ("idx_log_agent",        "logs(agent_slug)"),
            ("idx_reset_token",      "reset_tokens(token)"),
            ("idx_fin_hist_tab",     "finance_history(tab)"),
            ("idx_fin_hist_action",  "finance_history(action)"),
            ("idx_health_date",      "health_daily(date)"),
            ("idx_webhook_received", "webhook_events(received_at)"),
            ("idx_backlog_status",   "backlog_tasks(status)"),
            ("idx_backlog_priority", "backlog_tasks(priority)"),
            ("idx_subtasks_task",    "backlog_subtasks(task_id)"),
        ]
        for idx_name, idx_def in indexes:
            cur.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_def}")

    print("[DB] PostgreSQL tables and indexes verified.")
