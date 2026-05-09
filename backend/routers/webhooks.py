# -*- coding: utf-8 -*-
"""POST /webhooks/trigger — recibe eventos externos y los emite por SSE."""
from __future__ import annotations
import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from backend.db import get_conn
from backend.events import event_manager
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "wh-secret-mainfj-2026")


@router.post("/trigger")
async def trigger(request: Request, x_webhook_secret: str = Header(None)):
    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Webhook secret inválido")

    try:
        body = await request.json()
    except Exception:
        body = {}

    event_type = str(body.get("event", "trigger"))
    source = str(body.get("source", "external"))
    message = str(body.get("message", f"Evento '{event_type}' recibido desde {source}"))
    payload_str = json.dumps(body, ensure_ascii=False)

    with get_conn() as conn:
        conn.execute(
            "INSERT INTO webhook_events (source, event_type, payload, received_at) VALUES (?, ?, ?, ?)",
            (source, event_type, payload_str, datetime.now().isoformat()),
        )

    await event_manager.system(message, "info")

    return {"received": True, "event": event_type, "source": source}


@router.get("/events")
def get_webhook_events(limit: int = 50, current_user=Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, source, event_type, payload, received_at FROM webhook_events ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/config")
def get_config(current_user=Depends(get_current_user)):
    render_url = os.getenv("RENDER_EXTERNAL_URL", "https://mainfj-hub.onrender.com")
    return {
        "webhook_url": f"{render_url}/webhooks/trigger",
        "header_name": "X-Webhook-Secret",
        "secret_hint": "Configura WEBHOOK_SECRET en Render env vars",
        "example_body": {"event": "mi-evento", "source": "mi-sistema", "message": "Descripción del evento"},
    }
