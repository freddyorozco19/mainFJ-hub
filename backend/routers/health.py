# -*- coding: utf-8 -*-
from __future__ import annotations
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from backend.db import get_conn
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/health", tags=["health"])

# Clave estatica para el Shortcut de iOS (sin expiracion)
HEALTH_SYNC_KEY = "mainfj-health-2026-fj"


def _auth(
    x_health_key: Optional[str] = Header(default=None),
    current_user=Depends(get_current_user, use_cache=False),
):
    """Acepta JWT normal O la clave estatica del Shortcut."""
    pass


async def verify_auth(
    x_health_key: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    if x_health_key and x_health_key == HEALTH_SYNC_KEY:
        return {"method": "api_key"}
    if authorization:
        import jwt as pyjwt
        try:
            token = authorization.replace("Bearer ", "")
            payload = pyjwt.decode(
                token, "MainFJ-Dashboard-SecretKey-2026-FJ", algorithms=["HS256"]
            )
            return {"method": "jwt", "sub": payload.get("sub")}
        except pyjwt.PyJWTError:
            pass
    raise HTTPException(status_code=401, detail="No autorizado")


class HealthSyncPayload(BaseModel):
    date: Optional[str] = None
    steps: Optional[int] = None
    calories: Optional[float] = None
    heart_rate_avg: Optional[float] = None
    heart_rate_min: Optional[float] = None
    heart_rate_max: Optional[float] = None
    hrv: Optional[float] = None
    spo2: Optional[float] = None
    sleep_hours: Optional[float] = None
    sleep_deep: Optional[float] = None
    sleep_rem: Optional[float] = None
    sleep_awake: Optional[float] = None
    active_energy: Optional[float] = None
    distance_km: Optional[float] = None


@router.post("/sync")
async def sync_health(
    payload: HealthSyncPayload,
    auth=Depends(verify_auth),
):
    date = payload.date or datetime.utcnow().strftime("%Y-%m-%d")
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO health_daily (
                date, steps, calories, heart_rate_avg, heart_rate_min, heart_rate_max,
                hrv, spo2, sleep_hours, sleep_deep, sleep_rem, sleep_awake,
                active_energy, distance_km, synced_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(date) DO UPDATE SET
                steps          = excluded.steps,
                calories       = excluded.calories,
                heart_rate_avg = excluded.heart_rate_avg,
                heart_rate_min = excluded.heart_rate_min,
                heart_rate_max = excluded.heart_rate_max,
                hrv            = excluded.hrv,
                spo2           = excluded.spo2,
                sleep_hours    = excluded.sleep_hours,
                sleep_deep     = excluded.sleep_deep,
                sleep_rem      = excluded.sleep_rem,
                sleep_awake    = excluded.sleep_awake,
                active_energy  = excluded.active_energy,
                distance_km    = excluded.distance_km,
                synced_at      = excluded.synced_at""",
            (date, payload.steps, payload.calories,
             payload.heart_rate_avg, payload.heart_rate_min, payload.heart_rate_max,
             payload.hrv, payload.spo2, payload.sleep_hours, payload.sleep_deep,
             payload.sleep_rem, payload.sleep_awake, payload.active_energy,
             payload.distance_km, datetime.utcnow().isoformat())
        )
    return {"status": "ok", "date": date}


@router.get("/data")
async def get_health_data(
    start: Optional[str] = None,
    end: Optional[str] = None,
    auth=Depends(verify_auth),
):
    with get_conn() as conn:
        if start and end:
            rows = conn.execute(
                "SELECT * FROM health_daily WHERE date BETWEEN ? AND ? ORDER BY date DESC",
                (start, end)
            ).fetchall()
        elif start:
            rows = conn.execute(
                "SELECT * FROM health_daily WHERE date >= ? ORDER BY date DESC", (start,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM health_daily ORDER BY date DESC LIMIT 30"
            ).fetchall()
    return [dict(r) for r in rows]


@router.get("/summary")
async def get_health_summary(auth=Depends(verify_auth)):
    with get_conn() as conn:
        latest = conn.execute(
            "SELECT * FROM health_daily ORDER BY date DESC LIMIT 1"
        ).fetchone()
        weekly = conn.execute("""
            SELECT
                ROUND(AVG(steps))          as avg_steps,
                ROUND(AVG(heart_rate_avg)) as avg_hr,
                ROUND(AVG(sleep_hours), 1) as avg_sleep,
                ROUND(AVG(hrv), 1)         as avg_hrv,
                ROUND(SUM(calories))       as total_calories,
                COUNT(*)                   as days_tracked
            FROM health_daily
            WHERE date >= date('now', '-7 days')
        """).fetchone()
        trend = conn.execute(
            "SELECT date, steps, heart_rate_avg, sleep_hours, hrv FROM health_daily ORDER BY date DESC LIMIT 14"
        ).fetchall()
    return {
        "latest": dict(latest) if latest else {},
        "weekly": dict(weekly) if weekly else {},
        "trend":  [dict(r) for r in trend],
    }