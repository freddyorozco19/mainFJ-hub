# -*- coding: utf-8 -*-
"""GET /metrics — consumo agregado por agente y global."""
from fastapi import APIRouter, Depends
from backend.db import get_conn
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/")
def global_metrics(current_user = Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT SUM(tokens_in+tokens_out) as tokens, SUM(cost_usd) as cost, COUNT(*)/2 as requests FROM messages"
        ).fetchone()
    return {
        "total_tokens":   row["tokens"]   or 0,
        "total_cost_usd": row["cost"]     or 0.0,
        "total_requests": row["requests"] or 0,
    }


@router.get("/by-agent")
def by_agent(current_user = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT agent_slug,
                      SUM(tokens_in+tokens_out) as tokens,
                      SUM(cost_usd) as cost,
                      COUNT(*)/2 as requests
               FROM messages GROUP BY agent_slug"""
        ).fetchall()
    return [{"slug": r["agent_slug"], "tokens": r["tokens"] or 0, "cost": r["cost"] or 0.0, "requests": r["requests"] or 0} for r in rows]
