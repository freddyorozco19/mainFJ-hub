# -*- coding: utf-8 -*-
"""Integración con Belvo API para datos bancarios."""
from __future__ import annotations
import os
import json
import re
import base64
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.db import get_conn
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/belvo", tags=["belvo"])

BELVO_BASE  = os.getenv("BELVO_BASE_URL", "https://sandbox.belvo.com")
BELVO_ID    = os.getenv("BELVO_SECRET_ID", "")
BELVO_PWD   = os.getenv("BELVO_SECRET_PASSWORD", "")


def _auth_header() -> str:
    token = base64.b64encode(f"{BELVO_ID}:{BELVO_PWD}".encode()).decode()
    return f"Basic {token}"


async def _belvo(method: str, path: str, body: dict | None = None) -> dict:
    if not BELVO_ID:
        raise HTTPException(503, "Belvo no configurado. Agrega BELVO_SECRET_ID y BELVO_SECRET_PASSWORD.")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.request(
            method,
            f"{BELVO_BASE}{path}",
            headers={"Authorization": _auth_header(), "Content-Type": "application/json"},
            json=body,
        )
        if r.status_code not in (200, 201):
            raise HTTPException(r.status_code, r.text[:300])
        return r.json()


def _parse_installments(description: str) -> tuple[int | None, int | None]:
    patterns = [
        r'[Cc]uota[s]?\s*(\d+)\s*[/de]+\s*(\d+)',
        r'[Cc]\s*(\d+)\s*\/\s*(\d+)',
        r'\((\d+)\/(\d+)\)',
        r'(\d+)\s*\/\s*(\d+)',
    ]
    for p in patterns:
        m = re.search(p, description)
        if m:
            return int(m.group(1)), int(m.group(2))
    return None, None


def _days_ago(n: int) -> str:
    return (datetime.utcnow() - timedelta(days=n)).strftime("%Y-%m-%d")


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


# ── Models ────────────────────────────────────────────────────────────────────

class LinkCreate(BaseModel):
    institution: str
    username:    str
    password:    str

class SyncRequest(BaseModel):
    account_id: str
    days: int = 90


# ── Institutions ─────────────────────────────────────────────────────────────

@router.get("/institutions")
async def list_institutions(current_user=Depends(get_current_user)):
    all_institutions = []
    url = "/api/institutions/?page_size=100"
    # Recorre todas las páginas
    while url:
        data = await _belvo("GET", url)
        results = data if isinstance(data, list) else data.get("results", [])
        all_institutions.extend(results)
        next_url = data.get("next") if isinstance(data, dict) else None
        if next_url:
            # Extrae solo el path relativo
            from urllib.parse import urlparse
            parsed = urlparse(next_url)
            url = parsed.path + ("?" + parsed.query if parsed.query else "")
        else:
            url = None

    return [
        {
            "id":      i["name"],
            "name":    i.get("display_name") or i["name"],
            "country": i.get("country_code", ""),
            "type":    i.get("type", ""),
        }
        for i in all_institutions
    ]


# ── Links ─────────────────────────────────────────────────────────────────────

@router.get("/links")
def list_links(current_user=Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM belvo_links ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.post("/links")
async def create_link(req: LinkCreate, current_user=Depends(get_current_user)):
    body: dict = {
        "institution": req.institution,
        "username":    req.username,
        "password":    req.password,
    }
    data = await _belvo("POST", "/api/links/", body)
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO belvo_links (belvo_id, institution, status) VALUES (?,?,?)",
            (data["id"], req.institution, data.get("status", "valid"))
        )
    return {"belvo_id": data["id"], "institution": req.institution, "status": data.get("status")}


@router.delete("/links/{link_db_id}")
async def delete_link(link_db_id: int, current_user=Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT belvo_id FROM belvo_links WHERE id=?", (link_db_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Link no encontrado")
        belvo_id = row["belvo_id"]

    async with httpx.AsyncClient(timeout=15) as client:
        await client.delete(
            f"{BELVO_BASE}/api/links/{belvo_id}/",
            headers={"Authorization": _auth_header()},
        )

    with get_conn() as conn:
        conn.execute("DELETE FROM belvo_links WHERE id=?", (link_db_id,))
    return {"ok": True}


# ── Accounts ──────────────────────────────────────────────────────────────────

@router.get("/accounts")
def list_accounts(current_user=Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT a.*, l.institution as bank
            FROM belvo_accounts a
            JOIN belvo_links l ON l.belvo_id = a.link_id
            ORDER BY a.synced_at DESC
        """).fetchall()
    return [dict(r) for r in rows]


@router.post("/accounts/{link_db_id}")
async def sync_accounts(link_db_id: int, current_user=Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT belvo_id, institution FROM belvo_links WHERE id=?", (link_db_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Link no encontrado")
        belvo_link_id = row["belvo_id"]
        institution   = row["institution"]

    data = await _belvo("POST", "/api/accounts/", {"link": belvo_link_id, "save_data": True})
    accounts = data if isinstance(data, list) else data.get("results", [])

    saved = 0
    with get_conn() as conn:
        for acc in accounts:
            balance     = acc.get("balance", {})
            bal_current = balance.get("current") or balance.get("available") or 0
            credit_data = json.dumps(acc.get("credit_data")) if acc.get("credit_data") else None
            conn.execute("""
                INSERT OR REPLACE INTO belvo_accounts
                    (belvo_id, link_id, institution, name, type, currency, balance, credit_data, synced_at)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (
                acc["id"], belvo_link_id, institution,
                acc.get("name", ""), acc.get("type", ""),
                acc.get("currency", "COP"), bal_current,
                credit_data, datetime.utcnow().isoformat()
            ))
            saved += 1

    return {"synced": saved}


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get("/transactions")
def list_transactions(
    account_id: str | None = None,
    cuotas: bool = False,
    current_user=Depends(get_current_user)
):
    with get_conn() as conn:
        where = []
        params: list = []
        if account_id:
            where.append("account_id=?")
            params.append(account_id)
        if cuotas:
            where.append("installment_total > 1")
        clause = "WHERE " + " AND ".join(where) if where else ""
        rows = conn.execute(
            f"SELECT * FROM belvo_transactions {clause} ORDER BY value_date DESC LIMIT 300",
            params
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/sync")
async def sync_transactions(req: SyncRequest, current_user=Depends(get_current_user)):
    with get_conn() as conn:
        acc = conn.execute(
            "SELECT a.*, l.belvo_id as link_belvo_id FROM belvo_accounts a JOIN belvo_links l ON l.belvo_id=a.link_id WHERE a.belvo_id=?",
            (req.account_id,)
        ).fetchone()
        if not acc:
            raise HTTPException(404, "Cuenta no encontrada")

    date_from = _days_ago(req.days)
    date_to   = _today()

    data = await _belvo("POST", "/api/transactions/", {
        "link":      dict(acc)["link_belvo_id"],
        "account":   req.account_id,
        "date_from": date_from,
        "date_to":   date_to,
        "save_data": True,
    })
    txs = data if isinstance(data, list) else data.get("results", [])

    created = 0
    with get_conn() as conn:
        for tx in txs:
            desc = tx.get("description") or ""
            inst_num, inst_total = _parse_installments(desc)
            merchant = (tx.get("merchant") or {}).get("name")
            try:
                conn.execute("""
                    INSERT OR IGNORE INTO belvo_transactions
                        (belvo_id, account_id, amount, currency, description, category,
                         type, status, value_date, installment_number, installment_total, merchant)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    tx["id"], req.account_id,
                    abs(tx.get("amount") or 0),
                    tx.get("currency", "COP"),
                    desc, tx.get("category"),
                    tx.get("type", "OUTFLOW"),
                    tx.get("status", "PROCESSED"),
                    tx.get("value_date") or tx.get("accounting_date") or date_to,
                    inst_num, inst_total, merchant
                ))
                created += 1
            except Exception:
                pass

    return {"synced": created, "date_from": date_from, "date_to": date_to}
