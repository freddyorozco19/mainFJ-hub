# -*- coding: utf-8 -*-
"""Supabase PostgreSQL client para datos persistentes en la nube."""
import os
from supabase import create_client, Client

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise RuntimeError("Configura SUPABASE_URL y SUPABASE_SERVICE_KEY en variables de entorno")
        _client = create_client(url, key)
    return _client

def init_supabase() -> None:
    """Crea las tablas si no existen."""
    client = get_supabase()
    try:
        client.sql("""
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
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                updated_at  TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS backlog_subtasks (
                id          SERIAL PRIMARY KEY,
                task_id     INTEGER REFERENCES backlog_tasks(id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                done        BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS rappi_products (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                brand        TEXT,
                size         TEXT,
                search_names JSONB DEFAULT '[]',
                keywords     JSONB DEFAULT '[]',
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS rappi_scans (
                id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id             TEXT REFERENCES rappi_products(id) ON DELETE CASCADE,
                date                   TIMESTAMPTZ NOT NULL,
                scanned_products       INTEGER DEFAULT 0,
                scanned_stores         INTEGER DEFAULT 0,
                min_price              NUMERIC,
                min_price_store        TEXT,
                min_price_store_count  INTEGER DEFAULT 0,
                max_price              NUMERIC,
                max_price_store        TEXT,
                max_price_store_count  INTEGER DEFAULT 0,
                promo_detected         BOOLEAN DEFAULT FALSE,
                created_at             TIMESTAMPTZ DEFAULT NOW()
            );
        """).execute()
        print("[SUPABASE] Tablas creadas/verificadas")
    except Exception as e:
        print(f"[SUPABASE] Error creando tablas: {e}")