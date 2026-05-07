# -*- coding: utf-8 -*-
from __future__ import annotations
import asyncio
import os
from datetime import datetime, date, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/health", tags=["health"])

HEALTH_SYNC_KEY = "mainfj-health-2026-fj"
SUPABASE_URL    = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY    = os.environ.get("SUPABASE_KEY", "")


def _sb(prefer: str = "") -> dict:
    h = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


async def verify_auth(
    x_health_key:  Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    if x_health_key and x_health_key == HEALTH_SYNC_KEY:
        return {"method": "api_key"}
    if authorization:
        import jwt as pyjwt
        try:
            token   = authorization.replace("Bearer ", "")
            payload = pyjwt.decode(
                token, "MainFJ-Dashboard-SecretKey-2026-FJ", algorithms=["HS256"]
            )
            return {"method": "jwt", "sub": payload.get("sub")}
        except pyjwt.PyJWTError:
            pass
    raise HTTPException(status_code=401, detail="No autorizado")


class HealthSyncPayload(BaseModel):
    date:           Optional[str]   = None
    steps:          Optional[int]   = None
    calories:       Optional[float] = None
    heart_rate_avg: Optional[float] = None
    heart_rate_min: Optional[float] = None
    heart_rate_max: Optional[float] = None
    hrv:            Optional[float] = None
    spo2:           Optional[float] = None
    sleep_hours:    Optional[float] = None
    sleep_deep:     Optional[float] = None
    sleep_rem:      Optional[float] = None
    sleep_awake:    Optional[float] = None
    active_energy:  Optional[float] = None
    distance_km:    Optional[float] = None


@router.post("/sync")
async def sync_health(payload: HealthSyncPayload, auth=Depends(verify_auth)):
    record_date = payload.date or datetime.utcnow().strftime("%Y-%m-%d")
    data = {
        "date":           record_date,
        "steps":          payload.steps,
        "calories":       payload.calories,
        "heart_rate_avg": payload.heart_rate_avg,
        "heart_rate_min": payload.heart_rate_min,
        "heart_rate_max": payload.heart_rate_max,
        "hrv":            payload.hrv,
        "spo2":           payload.spo2,
        "sleep_hours":    payload.sleep_hours,
        "sleep_deep":     payload.sleep_deep,
        "sleep_rem":      payload.sleep_rem,
        "sleep_awake":    payload.sleep_awake,
        "active_energy":  payload.active_energy,
        "distance_km":    payload.distance_km,
        "synced_at":      datetime.utcnow().isoformat(),
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/health_daily",
            headers=_sb("resolution=merge-duplicates,return=representation"),
            json=data,
            timeout=15,
        )
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=r.text)
    return {"status": "ok", "date": record_date}


@router.get("/data")
async def get_health_data(
    start: Optional[str] = None,
    end:   Optional[str] = None,
    auth=Depends(verify_auth),
):
    params = [("order", "date.desc"), ("limit", "365")]
    if start:
        params.append(("date", f"gte.{start}"))
    if end:
        params.append(("date", f"lte.{end}"))

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/health_daily",
            headers=_sb(),
            params=params,
            timeout=15,
        )
    if not r.is_success:
        raise HTTPException(status_code=500, detail=r.text)
    return r.json()


def _avg(rows: list, key: str, dec: int = 1):
    vals = [r[key] for r in rows if r.get(key) is not None]
    return round(sum(vals) / len(vals), dec) if vals else None

def _sum(rows: list, key: str, dec: int = 1):
    vals = [r[key] for r in rows if r.get(key) is not None]
    return round(sum(vals), dec) if vals else None


@router.get("/summary")
async def get_health_summary(auth=Depends(verify_auth)):
    seven_days_ago = (date.today() - timedelta(days=7)).isoformat()

    async with httpx.AsyncClient() as client:
        latest_r, weekly_r, trend_r = await asyncio.gather(
            client.get(
                f"{SUPABASE_URL}/rest/v1/health_daily",
                headers=_sb(),
                params=[("order", "date.desc"), ("limit", "1")],
                timeout=15,
            ),
            client.get(
                f"{SUPABASE_URL}/rest/v1/health_daily",
                headers=_sb(),
                params=[("date", f"gte.{seven_days_ago}"), ("order", "date.desc")],
                timeout=15,
            ),
            client.get(
                f"{SUPABASE_URL}/rest/v1/health_daily",
                headers=_sb(),
                params=[
                    ("order", "date.desc"),
                    ("limit", "14"),
                    ("select", "date,steps,heart_rate_avg,sleep_hours,hrv"),
                ],
                timeout=15,
            ),
        )

    latest_rows = latest_r.json() if latest_r.is_success else []
    weekly_rows = weekly_r.json() if weekly_r.is_success else []
    trend_rows  = trend_r.json()  if trend_r.is_success  else []

    latest = latest_rows[0] if latest_rows else {}
    weekly = {
        "avg_steps":      _avg(weekly_rows, "steps", 0),
        "avg_hr":         _avg(weekly_rows, "heart_rate_avg", 0),
        "avg_sleep":      _avg(weekly_rows, "sleep_hours", 1),
        "avg_hrv":        _avg(weekly_rows, "hrv", 1),
        "total_calories": _sum(weekly_rows, "calories", 1),
        "days_tracked":   len(weekly_rows),
    }

    return {"latest": latest, "weekly": weekly, "trend": trend_rows}
