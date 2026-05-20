# -*- coding: utf-8 -*-
"""
backend/routers/email_inbox.py
Correos via IMAP (Gmail) + Microsoft Graph API (Outlook personal).
Variables de entorno:
  IMAP_EMAIL            Gmail address
  IMAP_PASSWORD_GMAIL   Gmail app password
  MS_CLIENT_ID          Azure app client ID
  MS_CLIENT_SECRET      Azure app client secret
  MS_REFRESH_TOKEN      OAuth refresh token para Hotmail
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

import httpx
from fastapi import APIRouter, Query, Depends
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/inbox", tags=["inbox"])

TZ       = ZoneInfo("America/Bogota")
CACHE: dict = {"data": None, "fetched_at": None}
CACHE_TTL   = 120

# Token cache para no pedir access_token en cada request
_token_cache: dict = {"access_token": None, "expires_at": None}


# ── helpers ──────────────────────────────────────────────────────────────────

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


# ── Gmail IMAP ────────────────────────────────────────────────────────────────

def _fetch_gmail(limit: int, now: datetime) -> list[dict]:
    addr = os.getenv("IMAP_EMAIL", "")
    pwd  = os.getenv("IMAP_PASSWORD_GMAIL", "")
    if not addr or not pwd:
        return []
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(addr, pwd)
        mail.select("INBOX", readonly=True)
        _, data = mail.search(None, "ALL")
        ids = data[0].split()
        ids = list(reversed(ids[-limit:] if len(ids) > limit else ids))
        emails = []
        for uid in ids:
            try:
                _, raw = mail.fetch(uid, "(RFC822 FLAGS)")
                flags_raw = str(raw[0][0]) if raw and raw[0] else ""
                is_unread = "\\Seen" not in flags_raw
                msg = email.message_from_bytes(raw[0][1])
                subject = _decode_header(msg.get("Subject", "(sin asunto)"))
                sender_name, sender_email = _parse_from(msg.get("From", ""))
                date_raw = msg.get("Date", "")
                snippet  = _get_body_snippet(msg)
                date_parsed = date_str = date_ts = None
                try:
                    ts = email.utils.parsedate_to_datetime(date_raw).astimezone(TZ)
                    date_parsed = ts.isoformat()
                    date_ts     = ts
                    date_str    = ts.strftime("%H:%M") if ts.date() == now.date() else ts.strftime("%d %b")
                except Exception:
                    date_str = date_raw[:16] if date_raw else None
                emails.append({
                    "uid": f"gmail_{uid.decode()}", "source": "gmail",
                    "subject": subject, "sender_name": sender_name,
                    "sender_email": sender_email, "date": date_parsed,
                    "date_label": date_str, "_date_ts": date_ts,
                    "snippet": snippet, "unread": is_unread,
                })
            except Exception:
                continue
        mail.logout()
        return emails
    except Exception:
        return []


# ── Outlook Graph API ─────────────────────────────────────────────────────────

def _get_ms_access_token() -> Optional[str]:
    now = datetime.now(tz=TZ)
    if _token_cache["access_token"] and _token_cache["expires_at"]:
        if (now - _token_cache["expires_at"]).total_seconds() < -60:
            return _token_cache["access_token"]

    client_id     = os.getenv("MS_CLIENT_ID", "858c20f7-d60d-4296-858f-802082ea291c")
    client_secret = os.getenv("MS_CLIENT_SECRET", "")
    refresh_token = os.getenv("MS_REFRESH_TOKEN", "")
    if not client_secret or not refresh_token:
        return None

    try:
        resp = httpx.post(
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
            data={
                "client_id":     client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type":    "refresh_token",
                "scope":         "https://graph.microsoft.com/Mail.Read offline_access",
            },
            timeout=10,
        )
        result = resp.json()
        if "access_token" in result:
            import time
            expires_in = result.get("expires_in", 3600)
            _token_cache["access_token"] = result["access_token"]
            _token_cache["expires_at"]   = datetime.fromtimestamp(time.time() + expires_in, tz=TZ)
            if "refresh_token" in result:
                os.environ["MS_REFRESH_TOKEN"] = result["refresh_token"]
            return result["access_token"]
    except Exception:
        pass
    return None


def _fetch_outlook_graph(limit: int, now: datetime) -> list[dict]:
    access_token = _get_ms_access_token()
    if not access_token:
        return []
    try:
        resp = httpx.get(
            f"https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages"
            f"?$top={limit}&$orderby=receivedDateTime desc"
            f"&$select=id,subject,from,receivedDateTime,isRead,bodyPreview",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        messages = resp.json().get("value", [])
        emails = []
        for m in messages:
            try:
                from_obj     = m.get("from", {}).get("emailAddress", {})
                sender_name  = from_obj.get("name") or None
                sender_email = from_obj.get("address") or None
                date_ts = date_str = date_parsed = None
                try:
                    from datetime import timezone
                    ts = datetime.fromisoformat(m["receivedDateTime"].replace("Z", "+00:00")).astimezone(TZ)
                    date_parsed = ts.isoformat()
                    date_ts     = ts
                    date_str    = ts.strftime("%H:%M") if ts.date() == now.date() else ts.strftime("%d %b")
                except Exception:
                    pass
                emails.append({
                    "uid":          f"outlook_{m['id']}",
                    "source":       "outlook",
                    "subject":      m.get("subject") or "(sin asunto)",
                    "sender_name":  sender_name,
                    "sender_email": sender_email,
                    "date":         date_parsed,
                    "date_label":   date_str,
                    "_date_ts":     date_ts,
                    "snippet":      m.get("bodyPreview") or None,
                    "unread":       not m.get("isRead", True),
                })
            except Exception:
                continue
        return emails
    except Exception:
        return []


# ── Merge ─────────────────────────────────────────────────────────────────────

def _fetch_emails(limit: int = 15) -> list[dict]:
    now = datetime.now(tz=TZ)
    if CACHE["data"] and CACHE["fetched_at"]:
        if (now - CACHE["fetched_at"]).total_seconds() < CACHE_TTL:
            return CACHE["data"]

    per = max(limit, 10)
    all_emails = _fetch_gmail(per, now) + _fetch_outlook_graph(per, now)
    all_emails.sort(key=lambda e: e["_date_ts"] or datetime.min.replace(tzinfo=TZ), reverse=True)
    all_emails = all_emails[:limit]
    for e in all_emails:
        e.pop("_date_ts", None)

    CACHE["data"]       = all_emails
    CACHE["fetched_at"] = now
    return all_emails


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/emails")
def get_emails(limit: int = Query(default=15, ge=1, le=50), current_user=Depends(get_current_user)):
    emails = _fetch_emails(limit=limit)
    unread = sum(1 for e in emails if e["unread"])
    return {"emails": emails, "count": len(emails), "unread": unread}


@router.get("/emails/unread-count")
def get_unread_count(current_user=Depends(get_current_user)):
    emails = _fetch_emails()
    unread = sum(1 for e in emails if e["unread"])
    return {"unread": unread, "total": len(emails)}


@router.get("/oauth-callback")
def oauth_callback(code: str = "", error: str = ""):
    """Intercambia el authorization code por refresh token — endpoint temporal."""
    if error:
        return {"error": error}
    if not code:
        return {"error": "No code received"}
    client_id     = os.getenv("MS_CLIENT_ID", "858c20f7-d60d-4296-858f-802082ea291c")
    client_secret = os.getenv("MS_CLIENT_SECRET", "")
    resp = httpx.post(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        data={
            "client_id":     client_id,
            "client_secret": client_secret,
            "code":          code,
            "redirect_uri":  "https://mainfj-hub.onrender.com/inbox/oauth-callback",
            "grant_type":    "authorization_code",
            "scope":         "https://graph.microsoft.com/Mail.Read offline_access",
        },
    )
    result = resp.json()
    if "refresh_token" in result:
        return {"status": "ok", "refresh_token": result["refresh_token"],
                "message": "Guarda este refresh_token en Render como MS_REFRESH_TOKEN"}
    return {"error": result}


@router.get("/debug")
def debug_imap():
    results: dict = {}
    # Gmail
    addr = os.getenv("IMAP_EMAIL", "")
    pwd  = os.getenv("IMAP_PASSWORD_GMAIL", "")
    if not addr:
        results["gmail"] = {"status": "skip", "reason": "IMAP_EMAIL not set"}
    else:
        try:
            mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
            mail.login(addr, pwd)
            mail.select("INBOX", readonly=True)
            _, data = mail.search(None, "ALL")
            count = len(data[0].split()) if data[0] else 0
            mail.logout()
            results["gmail"] = {"status": "ok", "email": addr, "total_emails": count}
        except Exception as e:
            results["gmail"] = {"status": "error", "email": addr, "error": str(e)}
    # Outlook Graph
    token = _get_ms_access_token()
    if not token:
        results["outlook"] = {"status": "skip", "reason": "MS_CLIENT_SECRET or MS_REFRESH_TOKEN not set"}
    else:
        try:
            resp = httpx.get(
                "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=1&$select=id",
                headers={"Authorization": f"Bearer {token}"}, timeout=10,
            )
            results["outlook"] = {"status": "ok" if resp.status_code == 200 else "error",
                                   "http_status": resp.status_code}
        except Exception as e:
            results["outlook"] = {"status": "error", "error": str(e)}
    return results
