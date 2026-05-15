# -*- coding: utf-8 -*-
"""
backend/main.py — MainFJ Dashboard API
Run: uvicorn backend.main:app --reload --port 8001
"""
from __future__ import annotations
import asyncio
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.routers import chat, agents, metrics, logs, finance, auth, health, search, webhooks, proxy, backlog
from backend.db import init_db
from backend.supabase_client import init_supabase
from backend.events import event_manager

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_supabase()
    yield

app = FastAPI(title="MainFJ Dashboard API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(chat.router)
app.include_router(metrics.router)
app.include_router(logs.router)
app.include_router(finance.router)
app.include_router(health.router)
app.include_router(search.router)
app.include_router(webhooks.router)
app.include_router(proxy.router)
app.include_router(backlog.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "MainFJ Dashboard API v0.1"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/events")
async def events(request: Request, token: str = ""):
    """SSE endpoint — streams real-time events to the client."""
    import jwt
    try:
        import os
        payload = jwt.decode(token, os.getenv("JWT_SECRET_KEY", "MainFJ-Dashboard-SecretKey-2026-FJ"), algorithms=["HS256"])
    except (jwt.PyJWTError, AttributeError):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"detail": "Token invalido"})

    queue = await event_manager.subscribe()
    try:
        async def event_stream():
            yield 'event: connected\ndata: {"status": "ok"}\n\n'
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30)
                    data = json.loads(payload)
                    event_type = data.get("event", "message")
                    yield f"event: {event_type}\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    finally:
        event_manager.unsubscribe(queue)