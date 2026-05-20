# -*- coding: utf-8 -*-
"""
backend/routers/calendar.py
Integración con Outlook Calendar vía ICS público.
Configura OUTLOOK_CALENDAR_ICS_URL en las variables de entorno de Render.
"""
from __future__ import annotations

import os
import httpx
import recurring_ical_events
from datetime import datetime, date, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query
from icalendar import Calendar

router = APIRouter(prefix="/calendar", tags=["calendar"])

ICS_URL = os.getenv("OUTLOOK_CALENDAR_ICS_URL", "")
TZ = ZoneInfo("America/Bogota")
CACHE: dict = {"data": None, "fetched_at": None}
CACHE_TTL = 900  # 15 min


def _now() -> datetime:
    return datetime.now(tz=TZ)


async def _fetch_ics() -> bytes:
    """Fetch ICS bytes, with 15-min in-memory cache."""
    now = _now()
    if CACHE["data"] and CACHE["fetched_at"]:
        age = (now - CACHE["fetched_at"]).total_seconds()
        if age < CACHE_TTL:
            return CACHE["data"]

    if not ICS_URL:
        raise HTTPException(status_code=503, detail="OUTLOOK_CALENDAR_ICS_URL no configurada")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(ICS_URL)
        resp.raise_for_status()

    CACHE["data"] = resp.content
    CACHE["fetched_at"] = now
    return resp.content


def _event_to_dict(component, start: datetime, end: datetime) -> dict:
    summary = str(component.get("SUMMARY", "Sin título"))
    location = str(component.get("LOCATION", "")) or None
    description = str(component.get("DESCRIPTION", "")) or None
    organizer = component.get("ORGANIZER")
    organizer_name = None
    if organizer:
        params = organizer.params if hasattr(organizer, "params") else {}
        organizer_name = params.get("CN") or str(organizer).replace("mailto:", "")

    attendees = component.get("ATTENDEE", [])
    if not isinstance(attendees, list):
        attendees = [attendees]
    attendee_count = len(attendees)

    all_day = not isinstance(start, datetime)
    if all_day:
        start_dt = datetime.combine(start, datetime.min.time(), tzinfo=TZ)
        end_dt = datetime.combine(end, datetime.min.time(), tzinfo=TZ)
    else:
        start_dt = start.astimezone(TZ) if start.tzinfo else start.replace(tzinfo=TZ)
        end_dt = end.astimezone(TZ) if end.tzinfo else end.replace(tzinfo=TZ)

    duration_min = int((end_dt - start_dt).total_seconds() / 60)

    return {
        "uid": str(component.get("UID", "")),
        "summary": summary,
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
        "start_date": start_dt.date().isoformat(),
        "start_time": None if all_day else start_dt.strftime("%H:%M"),
        "end_time": None if all_day else end_dt.strftime("%H:%M"),
        "all_day": all_day,
        "duration_min": duration_min,
        "location": location,
        "description": description[:200] if description else None,
        "organizer": organizer_name,
        "attendee_count": attendee_count,
    }


@router.get("/events")
async def get_events(
    days: int = Query(default=14, ge=1, le=60, description="Días hacia adelante"),
):
    """Retorna eventos de los próximos N días."""
    raw = await _fetch_ics()
    cal = Calendar.from_ical(raw)

    start_dt = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt = start_dt + timedelta(days=days)

    components = recurring_ical_events.of(cal).between(start_dt, end_dt)

    events = []
    for component in components:
        if component.name != "VEVENT":
            continue
        dtstart = component.get("DTSTART").dt
        dtend = component.get("DTEND", component.get("DTSTART")).dt
        events.append(_event_to_dict(component, dtstart, dtend))

    events.sort(key=lambda e: e["start"])
    return {"events": events, "count": len(events), "range_days": days}


@router.get("/today")
async def get_today():
    """Retorna solo los eventos de hoy."""
    raw = await _fetch_ics()
    cal = Calendar.from_ical(raw)

    today_start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    components = recurring_ical_events.of(cal).between(today_start, today_end)

    events = []
    for component in components:
        if component.name != "VEVENT":
            continue
        dtstart = component.get("DTSTART").dt
        dtend = component.get("DTEND", component.get("DTSTART")).dt
        events.append(_event_to_dict(component, dtstart, dtend))

    events.sort(key=lambda e: e["start"])
    return {
        "events": events,
        "count": len(events),
        "date": today_start.date().isoformat(),
    }


@router.get("/week")
async def get_week():
    """Retorna eventos de los próximos 7 días agrupados por día."""
    raw = await _fetch_ics()
    cal = Calendar.from_ical(raw)

    today = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = today + timedelta(days=7)

    components = recurring_ical_events.of(cal).between(today, week_end)

    by_day: dict[str, list] = {}
    for component in components:
        if component.name != "VEVENT":
            continue
        dtstart = component.get("DTSTART").dt
        dtend = component.get("DTEND", component.get("DTSTART")).dt
        ev = _event_to_dict(component, dtstart, dtend)
        day_key = ev["start_date"]
        by_day.setdefault(day_key, []).append(ev)

    # Ensure all 7 days appear even if empty
    days_list = []
    for i in range(7):
        d = (today + timedelta(days=i)).date().isoformat()
        days_list.append({"date": d, "events": by_day.get(d, [])})

    total = sum(len(d["events"]) for d in days_list)
    return {"week": days_list, "total": total}


@router.get("/stats")
async def get_stats():
    """Métricas de calendario para el dashboard."""
    raw = await _fetch_ics()
    cal = Calendar.from_ical(raw)

    today = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = today + timedelta(days=7)
    month_end = today + timedelta(days=30)

    week_comps = recurring_ical_events.of(cal).between(today, week_end)
    month_comps = recurring_ical_events.of(cal).between(today, month_end)

    week_events = [c for c in week_comps if c.name == "VEVENT"]
    month_events = [c for c in month_comps if c.name == "VEVENT"]

    today_comps = recurring_ical_events.of(cal).between(today, today + timedelta(days=1))
    today_events = [c for c in today_comps if c.name == "VEVENT"]

    def total_minutes(comps):
        total = 0
        for c in comps:
            s = c.get("DTSTART").dt
            e = c.get("DTEND", c.get("DTSTART")).dt
            if isinstance(s, datetime) and isinstance(e, datetime):
                total += int((e - s).total_seconds() / 60)
        return total

    return {
        "today_count": len(today_events),
        "week_count": len(week_events),
        "week_meeting_minutes": total_minutes(week_events),
        "month_count": len(month_events),
        "next_event": None,
    }