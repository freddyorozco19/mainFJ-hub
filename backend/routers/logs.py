# -*- coding: utf-8 -*-
"""GET /logs — historial de actividad del sistema."""
from fastapi import APIRouter, Depends, Query
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/")
def get_logs(current_user = Depends(get_current_user), limit: int = Query(100, le=500), level: str | None = None, agent: str | None = None):
    query  = "SELECT * FROM logs WHERE 1=1"
    params: list = []
    if level: query += " AND level=?";       params.append(level)
    if agent: query += " AND agent_slug=?";  params.append(agent)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()

    return [dict(r) for r in rows]


@router.delete("/")
def clear_logs(current_user = Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM logs")
    return {"deleted": True}
