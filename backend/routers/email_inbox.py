# -*- coding: utf-8 -*-
"""
backend/routers/email_inbox.py
Lectura de correos via IMAP — Gmail + Outlook personal.
Variables de entorno:
  IMAP_EMAIL            Gmail address
  IMAP_PASSWORD_GMAIL   Gmail app password
  OUTLOOK_EMAIL         Outlook/Hotmail personal address
  OUTLOOK_PASSWORD      Outlook personal password
"""
from __future__ import annotations

import os
import imaplib
import email
import email.header
import email.utils
import re
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query, Depends
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/inbox", tags=["inbox"])

TZ = ZoneInfo("America/Bogota")

CACHE: dict = {"data": None, "fetched_at": None}
CACHE_TTL = 120  # 2 min

ACCOUNTS = [
    {
        "key":      "gmail",
        "host":     "imap.gmail.com",
        "port":     993,
        "email_var":    "IMAP_EMAIL",
        "pass_var":     "IMAP_PASSWORD_GMAIL",
    },
    {
        "key":      "outlook",
        "host":     "outlook.office365.com",
        "port":     993,
        "email_var":    "OUTLOOK_EMAIL",
        "pass_var":     "OUTLOOK_PASSWORD",
    },
]


def _decode_header(raw) -> str:
    if raw is None:
        return ""
    parts = email.header.decode_header(raw)
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            result.append(str(part))
    return " ".join(result).strip()


def _get_body_snippet(msg, max_len: int = 200) -> Optional[str]:
    body = None
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                try:
                    charset = part.get_content_charset() or "utf-8"
                    body = part.get_payload(decode=True).decode(charset, errors="replace")
                    break
                except Exception:
                    continue
    else:
        try:
            charset = msg.get_content_charset() or "utf-8"
            body = msg.get_payload(decode=True).decode(charset, errors="replace")
        except Exception:
            pass

    if body:
        body = re.sub(r'\s+', ' ', body).strip()
        return body[:max_len]
    return None


def _parse_from(raw_from: str) -> tuple[Optional[str], Optional[str]]:
    name, addr = email.utils.parseaddr(raw_from)
    name = _decode_header(name) if name else None
    return name or None, addr or None


def _fetch_account(account: dict, limit: int, now: datetime) -> list[dict]:
    addr = os.getenv(account["email_var"], "")
    pwd  = os.getenv(account["pass_var"], "")
    if not addr or not pwd:
        return []

    try:
        mail = imaplib.IMAP4_SSL(account["host"], account["port"])
        mail.login(addr, pwd)
        mail.select("INBOX", readonly=True)

        _, data = mail.search(None, "ALL")
        ids = data[0].split()
        ids = ids[-limit:] if len(ids) > limit else ids
        ids = list(reversed(ids))

        emails = []
        for uid in ids:
            try:
                _, raw = mail.fetch(uid, "(RFC822 FLAGS)")
                flags_raw = str(raw[0][0]) if raw and raw[0] else ""
                is_unread = "\\Seen" not in flags_raw

                msg = email.message_from_bytes(raw[0][1])

                subject     = _decode_header(msg.get("Subject", "(sin asunto)"))
                from_raw    = msg.get("From", "")
                sender_name, sender_email = _parse_from(from_raw)
                date_raw    = msg.get("Date", "")
                snippet     = _get_body_snippet(msg)

                date_parsed = None
                date_str    = None
                date_ts     = None
                try:
                    ts = email.utils.parsedate_to_datetime(date_raw)
                    ts = ts.astimezone(TZ)
                    date_parsed = ts.isoformat()
                    date_ts     = ts
                    date_str    = ts.strftime("%H:%M") if ts.date() == now.date() else ts.strftime("%d %b")
                except Exception:
                    date_str = date_raw[:16] if date_raw else None

                emails.append({
                    "uid":          f"{account['key']}_{uid.decode()}",
                    "source":       account["key"],
                    "subject":      subject,
                    "sender_name":  sender_name,
                    "sender_email": sender_email,
                    "date":         date_parsed,
                    "date_label":   date_str,
                    "_date_ts":     date_ts,
                    "snippet":      snippet,
                    "unread":       is_unread,
                })
            except Exception:
                continue

        mail.logout()
        return emails

    except Exception:
        return []


def _fetch_emails(limit: int = 15) -> list[dict]:
    now = datetime.now(tz=TZ)
    if CACHE["data"] and CACHE["fetched_at"]:
        if (now - CACHE["fetched_at"]).total_seconds() < CACHE_TTL:
            return CACHE["data"]

    all_emails: list[dict] = []
    per_account = max(limit, 10)
    for account in ACCOUNTS:
        all_emails.extend(_fetch_account(account, per_account, now))

    # Sort by date descending, keep limit
    all_emails.sort(key=lambda e: e["_date_ts"] or datetime.min.replace(tzinfo=TZ), reverse=True)
    all_emails = all_emails[:limit]

    # Remove internal sort key
    for e in all_emails:
        e.pop("_date_ts", None)

    CACHE["data"] = all_emails
    CACHE["fetched_at"] = now
    return all_emails


@router.get("/emails")
def get_emails(
    limit: int = Query(default=15, ge=1, le=50),
    current_user=Depends(get_current_user),
):
    emails = _fetch_emails(limit=limit)
    unread = sum(1 for e in emails if e["unread"])
    return {"emails": emails, "count": len(emails), "unread": unread}


@router.get("/emails/unread-count")
def get_unread_count(current_user=Depends(get_current_user)):
    emails = _fetch_emails()
    unread = sum(1 for e in emails if e["unread"])
    return {"unread": unread, "total": len(emails)}


@router.get("/debug")
def debug_imap():
    results = {}
    for account in ACCOUNTS:
        addr = os.getenv(account["email_var"], "")
        pwd  = os.getenv(account["pass_var"], "")
        if not addr:
            results[account["key"]] = {"status": "skip", "reason": f"{account['email_var']} not set"}
            continue
        if not pwd:
            results[account["key"]] = {"status": "skip", "reason": f"{account['pass_var']} not set"}
            continue
        try:
            mail = imaplib.IMAP4_SSL(account["host"], account["port"])
            mail.login(addr, pwd)
            mail.select("INBOX", readonly=True)
            _, data = mail.search(None, "ALL")
            count = len(data[0].split()) if data[0] else 0
            mail.logout()
            results[account["key"]] = {"status": "ok", "email": addr, "total_emails": count}
        except Exception as e:
            results[account["key"]] = {"status": "error", "email": addr, "error": str(e)}
    return results
