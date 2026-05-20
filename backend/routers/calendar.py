# -*- coding: utf-8 -*-
"""
backend/routers/calendar.py
Integración multi-calendario via ICS: Outlook + Google Calendar.
Variables de entorno requeridas en Render:
  OUTLOOK_CALENDAR_ICS_URL
  GOOGLE_CALENDAR_ICS_URL
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

from fastapi import APIRouter, Query
from icalendar import Calendar

router = APIRouter(prefix="/calendar", tags=["calendar"])

SOURCES = {
    "outlook": os.getenv("OUTLOOK_CALENDAR_ICS_URL", ""),
    "google":  os.getenv("GOOGLE_CALENDAR_ICS_URL",  ""),
}

TZ = ZoneInfo("America/Bogota")

CACHE: dict[str, dict] = {
    "outlook": {"data": None, "fetched_at": None},
    "google":  {"data": None, "fetched_at": None},
}
CACHE_TTL = 900

MEETING_PATTERNS = [
    r'https://teams\.microsoft\.com/l/meetup-join/[^\s<>\]"]+',
    r'https://teams\.live\.com/meet/[^\s<>\]"]+',
    r'https://zoom\.us/j/[^\s<>\]"]+',
    r'https://meet\.google\.com/[a-z\-]+',
    r'https://us\d+web\.zoom\.us/j/[^\s<>\]"]+',
]


def _now() -> datetime:
    return datetime.now(tz=TZ)


def _extract_meeting_url(text: str) -> Optional[str]:
    if not text:
        return None
    for pattern in MEETING_PATTERNS:
        m = re.search(pattern, text)
        if m:
            return m.group(0).rstrip('>')
    return None


async def _fetch_ics(source: str) -> Optional[bytes]:
    url = SOURCES.get(source, "")
    if not url:
        return None

    now = _now()
    cache = CACHE[source]
    if cache["data"] and cache["fetched_at"]:
        if (now - cache["fetched_at"]).total_seconds() < CACHE_TTL:
            return cache["data"]

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        cache["data"] = resp.content
        cache["fetched_at"] = now
        return resp.content
    except Exception:
        return cache.get("data")  # return stale cache on error


def _event_to_dict(component, source: str) -> dict:
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
    summary      = str(component.get("SUMMARY",  "Sin título"))
    location     = str(component.get("LOCATION", "")) or None
    description  = str(component.get("DESCRIPTION", "")) or None
    url_prop     = str(component.get("URL", "")) or None

    meeting_url = None
    for text in filter(None, [description, location, url_prop]):
        meeting_url = _extract_meeting_url(text)
        if meeting_url:
            break

    organizer = component.get("ORGANIZER")
    organizer_name = organizer_email = None
    if organizer:
        try:
            params = organizer.params if hasattr(organizer, "params") else {}
            # CN can be a vText object or plain string, strip quotes
            cn_raw = params.get("CN", "")
            organizer_name = str(cn_raw).strip('"').strip("'").strip() or None
            # Email from the value itself (mailto:email or MAILTO:email)
            raw_val = str(organizer).strip()
            email_match = re.search(r'(?i)mailto:(.+)', raw_val)
            if email_match:
                organizer_email = email_match.group(1).strip() or None
            else:
                organizer_email = raw_val or None
        except Exception:
            pass

    attendees = component.get("ATTENDEE", [])
    if not isinstance(attendees, list):
        attendees = [attendees]
    attendee_list = []
    for a in attendees[:10]:
        params = a.params if hasattr(a, "params") else {}
        attendee_list.append({
            "name":   params.get("CN") or str(a).replace("mailto:", ""),
            "status": params.get("PARTSTAT", ""),
        })

    clean_desc = None
    if description:
        clean_desc = re.sub(r'<[^>]+>', ' ', description)
        clean_desc = re.sub(r'\s{3,}', '\n', clean_desc).strip()[:500]

    return {
        "uid":             str(component.get("UID", "")),
        "source":          source,
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


async def _get_events_range(start_dt: datetime, end_dt: datetime) -> list[dict]:
    events: list[dict] = []
    for source in ("outlook", "google"):
        raw = await _fetch_ics(source)
        if not raw:
            continue
        try:
            cal = Calendar.from_ical(raw)
            components = recurring_ical_events.of(cal).between(start_dt, end_dt)
            for c in components:
                if c.name == "VEVENT":
                    events.append(_event_to_dict(c, source))
        except Exception:
            continue
    events.sort(key=lambda e: e["start"])
    return events


@router.get("/today")
async def get_today():
    today_start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end   = today_start + timedelta(days=1)
    events = await _get_events_range(today_start, today_end)
    return {"events": events, "count": len(events), "date": today_start.date().isoformat()}


@router.get("/events")
async def get_events(days: int = Query(default=14, ge=1, le=60)):
    start_dt = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    events = await _get_events_range(start_dt, start_dt + timedelta(days=days))
    return {"events": events, "count": len(events), "range_days": days}


@router.get("/week")
async def get_week():
    today    = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = today + timedelta(days=7)
    events   = await _get_events_range(today, week_end)
    by_day: dict[str, list] = {}
    for ev in events:
        by_day.setdefault(ev["start_date"], []).append(ev)
    days_list = [
        {"date": (today + timedelta(days=i)).date().isoformat(),
         "events": by_day.get((today + timedelta(days=i)).date().isoformat(), [])}
        for i in range(7)
    ]
    return {"week": days_list, "total": sum(len(d["events"]) for d in days_list)}


@router.get("/stats")
async def get_stats():
    today     = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_evs = await _get_events_range(today, today + timedelta(days=1))
    week_evs  = await _get_events_range(today, today + timedelta(days=7))
    month_evs = await _get_events_range(today, today + timedelta(days=30))

    week_minutes = sum(
        ev["duration_min"] for ev in week_evs if not ev["all_day"]
    )

    sources_active = [s for s, url in SOURCES.items() if url]

    return {
        "today_count":          len(today_evs),
        "week_count":           len(week_evs),
        "week_meeting_minutes": week_minutes,
        "month_count":          len(month_evs),
        "sources":              sources_active,
    }