# -*- coding: utf-8 -*-
"""
backend/main.py — MainFJ Dashboard API
Run: uvicorn backend.main:app --reload --port 8001
"""
from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import chat, agents, metrics, logs
from backend.db import init_db

app = FastAPI(title="MainFJ Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5175", "http://localhost:4175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(chat.router)
app.include_router(metrics.router)
app.include_router(logs.router)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
def root():
    return {"status": "ok", "service": "MainFJ Dashboard API v0.1"}
