# -*- coding: utf-8 -*-
"""GET /search?q= — busqueda global en logs y mensajes."""
from fastapi import APIRouter, Depends, Query
from backend.db import get_conn
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
def search(q: str = Query(..., min_length=1), current_user=Depends(get_current_user)):
    like = f"%{q}%"
    results = []

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, level, agent_slug, action, detail, created_at
               FROM logs WHERE action LIKE %s OR detail LIKE %s
               ORDER BY id DESC LIMIT 15""",
            (like, like),
        )
        rows = cur.fetchall()
        for r in rows:
            results.append({
                "type": "log",
                "id": str(r["id"]),
                "title": r["action"],
                "subtitle": r["detail"][:120],
                "meta": r["agent_slug"],
                "timestamp": r["created_at"],
                "level": r["level"],
                "link": "/logs",
            })

        cur.execute(
            """SELECT id, agent_slug, role, content, created_at
               FROM messages WHERE content LIKE %s
               ORDER BY id DESC LIMIT 15""",
            (like,),
        )
        rows = cur.fetchall()
        for r in rows:
            results.append({
                "type": "message",
                "id": str(r["id"]),
                "title": r["content"][:120],
                "subtitle": f"{r['role']} · {r['agent_slug']}",
                "meta": r["agent_slug"],
                "timestamp": r["created_at"],
                "link": "/chat",
            })

    results.sort(key=lambda x: x["timestamp"], reverse=True)
    return results[:25]
