# -*- coding: utf-8 -*-
"""
backend/routers/calendar.py
Integración con Outlook Calendar vía ICS público.
Configura OUTLOOK_CALENDAR_ICS_URL en las variables de entorno de Render.
"""
from __future__ import annotations

import os
import re
import httpx
import recurring_ical_events
from datetime import datetime, timedelta
from typing import Optional

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # type: ignore

from fastapi import APIRouter, HTTPException, Query
from icalendar import Calendar

router = APIRouter(prefix="/calendar", tags=["calendar"])

ICS_URL = os.getenv("OUTLOOK_CALENDAR_ICS_URL", "")
TZ = ZoneInfo("America/Bogota")
CACHE: dict = {"data": None, "fetched_at": None}
CACHE_TTL = 900  # 15 min

MEETING_PATTERNS = [
    r'https://teams\.microsoft\.com/l/meetup-join/[^\s<>\]"]+',
    r'https://teams\.live\.com/meet/[^\s<>\]"]+',
    r'https://zoom\.us/j/[^\s<>\]"]+',
    r'https://meet\.google\.com/[a-z\-]+',
    r'https://us\d+web\.zoom\.us/j/[^\s<>\]"]+',
    r'https://whereby\.com/[^\s<>\]"]+',
]


def _now() -> datetime:
    return datetime.now(tz=TZ)


def _extract_meeting_url(text: str) -> Optional[str]:
    if not text:
        return None
    for pattern in MEETING_PATTERNS:
        m = re.search(pattern, text)
        if m:
            url = m.group(0).rstrip('>')
            return url
    return None


async def _fetch_ics() -> bytes:
    now = _now()
    if CACHE["data"] and CACHE["fetched_at"]:
        age = (now - CACHE["fetched_at"]).total_seconds()
        if age < CACHE_TTL:
            return CACHE["data"]

    if not ICS_URL:
        raise HTTPException(status_code=503, detail="OUTLOOK_CALENDAR_ICS_URL no configurada")

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(ICS_URL)
        resp.raise_for_status()

    CACHE["data"] = resp.content
    CACHE["fetched_at"] = now
    return resp.content


def _event_to_dict(component) -> dict:
    dtstart = component.get("DTSTART").dt
    dtend_prop = component.get("DTEND") or component.get("DTSTART")
    dtend = dtend_prop.dt

    all_day = not isinstance(dtstart, datetime)
    if all_day:
        start_dt = datetime.combine(dtstart, datetime.min.time(), tzinfo=TZ)
        end_dt   = datetime.combine(dtend,   datetime.min.time(), tzinfo=TZ)
    else:
        start_dt = dtstart.astimezone(TZ) if dtstart.tzinfo else dtstart.replace(tzinfo=TZ)
        end_dt   = dtend.astimezone(TZ)   if dtend.tzinfo   else dtend.replace(tzinfo=TZ)

    duration_min = int((end_dt - start_dt).total_seconds() / 60)

    summary     = str(component.get("SUMMARY", "Sin título"))
    location    = str(component.get("LOCATION", "")) or None
    description = str(component.get("DESCRIPTION", "")) or None
    url_prop    = str(component.get("URL", "")) or None

    # Extract meeting join link
    meeting_url = None
    for text in filter(None, [description, location, url_prop]):
        meeting_url = _extract_meeting_url(text)
        if meeting_url:
            break

    organizer = component.get("ORGANIZER")
    organizer_name = None
    organizer_email = None
    if organizer:
        params = organizer.params if hasattr(organizer, "params") else {}
        organizer_name  = params.get("CN") or None
        organizer_email = str(organizer).replace("mailto:", "") or None

    attendees = component.get("ATTENDEE", [])
    if not isinstance(attendees, list):
        attendees = [attendees]

    attendee_list = []
    for a in attendees[:10]:
        params = a.params if hasattr(a, "params") else {}
        name   = params.get("CN") or str(a).replace("mailto:", "")
        status = params.get("PARTSTAT", "")
        attendee_list.append({"name": name, "status": status})

    # Clean description for display
    clean_desc = None
    if description:
        # Remove HTML tags and excess whitespace
        clean_desc = re.sub(r'<[^>]+>', ' ', description)
        clean_desc = re.sub(r'\s{3,}', '\n', clean_desc).strip()
        clean_desc = clean_desc[:500] if len(clean_desc) > 500 else clean_desc

    return {
        "uid":             str(component.get("UID", "")),
        "summary":         summary,
        "start":           start_dt.isoformat(),
        "end":             end_dt.isoformat(),
        "start_date":      start_dt.date().isoformat(),
        "start_time":      None if all_day else start_dt.strftime("%H:%M"),
        "end_time":        None if all_day else end_dt.strftime("%H:%M"),
        "all_day":         all_day,
        "duration_min":    duration_min,
        "location":        location,
        "description":     clean_desc,
        "meeting_url":     meeting_url,
        "organizer_name":  organizer_name,
        "organizer_email": organizer_email,
        "attendees":       attendee_list,
        "attendee_count":  len(attendees),
    }


@router.get("/events")
async def get_events(days: int = Query(default=14, ge=1, le=60)):
    raw = await _fetch_ics()
    cal = Calendar.from_ical(raw)
    start_dt = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt   = start_dt + timedelta(days=days)
    components = recurring_ical_events.of(cal).between(start_dt, end_dt)
    events = [_event_to_dict(c) for c in components if c.name == "VEVENT"]
    events.sort(key=lambda e: e["start"])
    return {"events": events, "count": len(events), "range_days": days}


@router.get("/today")
async def get_today():
    raw = await _fetch_ics()
    cal = Calendar.from_ical(raw)
    today_start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end   = today_start + timedelta(days=1)
    components  = recurring_ical_events.of(cal).between(today_start, today_end)
    events = [_event_to_dict(c) for c in components if c.name == "VEVENT"]
    events.sort(key=lambda e: e["start"])
    return {"events": events, "count": len(events), "date": today_start.date().isoformat()}


@router.get("/week")
async def get_week():
    raw = await _fetch_ics()
    cal = Calendar.from_ical(raw)
    today    = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = today + timedelta(days=7)
    components = recurring_ical_events.of(cal).between(today, week_end)
    by_day: dict[str, list] = {}
    for c in components:
        if c.name != "VEVENT":
            continue
        ev = _event_to_dict(c)
        by_day.setdefault(ev["start_date"], []).append(ev)
    days_list = [{"date": (today + timedelta(days=i)).date().isoformat(), "events": by_day.get((today + timedelta(days=i)).date().isoformat(), [])} for i in range(7)]
    return {"week": days_list, "total": sum(len(d["events"]) for d in days_list)}


@router.get("/stats")
async def get_stats():
    raw = await _fetch_ics()
    cal = Calendar.from_ical(raw)
    today     = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_end  = today + timedelta(days=7)
    month_end = today + timedelta(days=30)

    def count_events(start, end):
        return [c for c in recurring_ical_events.of(cal).between(start, end) if c.name == "VEVENT"]

    today_evs = count_events(today, today + timedelta(days=1))
    week_evs  = count_events(today, week_end)
    month_evs = count_events(today, month_end)

    week_minutes = sum(
        int((c.get("DTEND", c.get("DTSTART")).dt - c.get("DTSTART").dt).total_seconds() / 60)
        for c in week_evs
        if isinstance(c.get("DTSTART").dt, datetime)
    )

    return {
        "today_count":         len(today_evs),
        "week_count":          len(week_evs),
        "week_meeting_minutes": week_minutes,
        "month_count":         len(month_evs),
    }