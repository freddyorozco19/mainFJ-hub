# -*- coding: utf-8 -*-
"""POST /chat/{slug} — envía mensaje a un agente y devuelve respuesta."""
from __future__ import annotations
import os
import time
from datetime import datetime

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.db import get_conn
from backend.routers.agents import CATALOG

load_dotenv(Path("../.env") if (Path := __import__("pathlib").Path)("../.env").exists() else Path(".env"))
_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

router = APIRouter(prefix="/chat", tags=["chat"])

# ── System prompts por agente ─────────────────────────────────────────────────
PROMPTS: dict[str, str] = {
    "orchestrator": "Eres el asistente personal de Freddy J. Orozco R. (FJ), ingeniero preventa senior en WinStats. Coordinas sus agentes IA, respondes preguntas generales y ayudas con planificación estratégica. Responde en español, de forma concisa y orientada a la acción.",

    "finance": "Eres el agente de Finanzas Personales de FJ. Ayudas a controlar ingresos, gastos, cuentas bancarias, presupuesto mensual y metas financieras. Puedes analizar datos financieros, sugerir estrategias de ahorro y dar seguimiento a objetivos económicos. Responde en español, con datos concretos y recomendaciones accionables.",

    "habits": "Eres el agente de Hábitos de FJ. Registras y analizas hábitos diarios (ejercicio, lectura, sueño, etc.), rastreás rachas, celebrás logros y das retroalimentación motivacional. Responde en español, con un tono positivo y práctico.",

    "code": "Eres el agente de Código de FJ. Stack principal: Python, BigQuery, SQL, Pentaho ETL, Streamlit, GCP. Entrega código completo y funcional, listo para usar. Comenta solo lo necesario. Responde en español; variables y funciones en inglés/snake_case.",

    "data": "Eres el agente de Datos de FJ. Especialidad: análisis con pandas/numpy, queries BigQuery, visualizaciones, KPIs de negocio y datos deportivos Opta F24. Presenta queries listas para ejecutar y análisis ejecutivos claros. Responde en español.",

    "preventa": "Eres el agente de Preventa de FJ en WinStats. Redactas propuestas técnicas, fichas SIGID, estimaciones de costo y análisis de pliegos para licitaciones colombianas (SECOP II). Usa lenguaje técnico-formal. Responde en español.",

    "research": "Eres el agente de Investigación de FJ. Analizas mercados, buscas licitaciones, sintetizas documentos e investigas competidores. Presenta hallazgos estructurados con fuentes y recomendaciones. Responde en español.",

    "agenda": "Eres el agente de Agenda Personal de FJ. Gestionas su calendario, priorizas tareas, planificas la semana y haces seguimiento de compromisos. Eres conciso, organizado y proactivo. Responde en español.",
}


class ChatRequest(BaseModel):
    text: str


class ChatResponse(BaseModel):
    text: str
    agent_slug: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


def _cost(model: str, inp: int, out: int) -> float:
    rates = {"claude-haiku-4-5-20251001": (0.80, 4.00), "claude-sonnet-4-6": (3.00, 15.00)}
    i, o = rates.get(model, (3.00, 15.00))
    return (inp * i + out * o) / 1_000_000


def _load_history(slug: str, limit: int = 20) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE agent_slug=? ORDER BY id DESC LIMIT ?",
            (slug, limit),
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def _save(slug: str, role: str, content: str, ti: int = 0, to: int = 0, cost: float = 0.0):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO messages (agent_slug, role, content, tokens_in, tokens_out, cost_usd, created_at) VALUES (?,?,?,?,?,?,?)",
            (slug, role, content, ti, to, cost, datetime.now().isoformat()),
        )


def _log(slug: str, action: str, detail: str, level: str = "info", ms: int | None = None):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO logs (level, agent_slug, action, detail, duration_ms, created_at) VALUES (?,?,?,?,?,?)",
            (level, slug, action, detail, ms, datetime.now().isoformat()),
        )


@router.post("/{slug}", response_model=ChatResponse)
def chat(slug: str, req: ChatRequest):
    if slug not in CATALOG:
        raise HTTPException(404, f"Agente '{slug}' no registrado")
    if not _API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY no configurada en .env")

    model   = CATALOG[slug]["model"]
    history = _load_history(slug)
    messages = history + [{"role": "user", "content": req.text}]

    _log(slug, "CHAT_START", req.text[:60] + ("…" if len(req.text) > 60 else ""))
    t0 = time.time()

    try:
        client = anthropic.Anthropic(api_key=_API_KEY)
        resp = client.messages.create(
            model=model,
            max_tokens=2048,
            system=PROMPTS.get(slug, "Eres un asistente útil. Responde en español."),
            messages=messages,
        )
        text = resp.content[0].text if resp.content else ""
        ti, to = resp.usage.input_tokens, resp.usage.output_tokens
        cost   = _cost(model, ti, to)
        ms     = int((time.time() - t0) * 1000)

        _save(slug, "user",      req.text, ti, 0,  0)
        _save(slug, "assistant", text,     0,  to, cost)
        _log(slug, "CHAT_OK", f"{to} tokens · {ms}ms · ${cost:.5f}", "success", ms)

        return ChatResponse(text=text, agent_slug=slug, input_tokens=ti, output_tokens=to, cost_usd=cost)

    except Exception as e:
        _log(slug, "CHAT_ERROR", str(e)[:120], "error")
        raise HTTPException(500, str(e))
