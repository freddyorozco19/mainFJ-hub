# -*- coding: utf-8 -*-
"""POST /chat/{slug} - envia mensaje a un agente via OpenRouter."""
from __future__ import annotations
import asyncio
import os
import time
from datetime import datetime
from pathlib import Path

from openai import OpenAI
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.db import get_conn
from backend.routers.auth import get_current_user
from backend.routers.agents import CATALOG, MODEL_RATES
from backend.events import event_manager

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

_OR_KEY  = os.getenv("OPENROUTER_API_KEY", "")   # OpenRouter (preferido)
_ANT_KEY = os.getenv("ANTHROPIC_API_KEY",  "")   # Anthropic directo (fallback)

router = APIRouter(prefix="/chat", tags=["chat"])

# ── System prompts por agente ─────────────────────────────────────────────────
PROMPTS: dict[str, str] = {
    "orchestrator": "Eres el asistente personal de Freddy J. Orozco R. (FJ), ingeniero preventa senior en WinStats. Coordinas sus agentes IA, respondes preguntas generales y ayudas con planificacion estrategica. Responde en espanol, de forma concisa y orientada a la accion.",

    "finance": "Eres el agente de Finanzas Personales de FJ. Ayudas a controlar ingresos, gastos, cuentas bancarias, presupuesto mensual y metas financieras. Puedes analizar datos financieros, sugerir estrategias de ahorro y dar seguimiento a objetivos economicos. Responde en espanol, con datos concretos y recomendaciones accionables.",

    "habits": "Eres el agente de Habitos de FJ. Registras y analizas habitos diarios (ejercicio, lectura, sueno, etc.), rastreas rachas, celebras logros y das retroalimentacion motivacional. Responde en espanol, con un tono positivo y practico.",

    "code": "Eres el agente de Codigo de FJ. Stack principal: Python, BigQuery, SQL, Pentaho ETL, Streamlit, GCP. Entrega codigo completo y funcional, listo para usar. Comenta solo lo necesario. Responde en espanol; variables y funciones en ingles/snake_case.",

    "data": "Eres el agente de Datos de FJ. Especialidad: analisis con pandas/numpy, queries BigQuery, visualizaciones, KPIs de negocio y datos deportivos Opta F24. Presenta queries listas para ejecutar y analisis ejecutivos claros. Responde en espanol.",

    "preventa": "Eres el agente de Preventa de FJ en WinStats. Redactas propuestas tecnicas, fichas SIGID, estimaciones de costo y analisis de pliegos para licitaciones colombianas (SECOP II). Usa lenguaje tecnico-formal. Responde en espanol.",

    "research": "Eres el agente de Investigacion de FJ. Analizas mercados, buscas licitaciones, sintetizas documentos e investigas competidores. Presenta hallazgos estructurados con fuentes y recomendaciones. Responde en espanol.",

    "agenda": "Eres el agente de Agenda Personal de FJ. Gestionas su calendario, priorizas tareas, planificas la semana y haces seguimiento de compromisos. Eres conciso, organizado y proactivo. Responde en espanol.",
}


class ChatRequest(BaseModel):
    text: str


class ChatResponse(BaseModel):
    text:         str
    agent_slug:   str
    model_used:   str
    input_tokens: int
    output_tokens: int
    cost_usd:     float


def _get_client() -> tuple[OpenAI, str]:
    """Retorna cliente OpenAI apuntando a OpenRouter o Anthropic directo."""
    if _OR_KEY:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=_OR_KEY,
        )
        return client, "openrouter"
    if _ANT_KEY:
        # Fallback: Anthropic directo tambien acepta formato OpenAI
        client = OpenAI(
            base_url="https://api.anthropic.com/v1",
            api_key=_ANT_KEY,
        )
        return client, "anthropic"
    raise HTTPException(503, "Configura OPENROUTER_API_KEY o ANTHROPIC_API_KEY en backend/.env")


def _cost(model: str, inp: int, out: int) -> float:
    i_rate, o_rate = MODEL_RATES.get(model, (3.00, 15.00))
    return (inp * i_rate + out * o_rate) / 1_000_000


def _load_history(slug: str, limit: int = 20) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT role, content FROM messages WHERE agent_slug=%s ORDER BY id DESC LIMIT %s",
            (slug, limit),
        )
        rows = cur.fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def _save(slug: str, role: str, content: str, ti: int = 0, to: int = 0, cost: float = 0.0):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO messages (agent_slug, role, content, tokens_in, tokens_out, cost_usd, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (slug, role, content, ti, to, cost, datetime.now().isoformat()),
        )


def _log(slug: str, action: str, detail: str, level: str = "info", ms: int | None = None):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO logs (level, agent_slug, action, detail, duration_ms, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
            (level, slug, action, detail, ms, datetime.now().isoformat()),
        )


@router.get("/{slug}/history")
def get_chat_history(slug: str, limit: int = Query(50, le=200), current_user=Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, role, content, tokens_in, tokens_out, created_at FROM messages WHERE agent_slug=%s ORDER BY id DESC LIMIT %s",
            (slug, limit),
        )
        rows = cur.fetchall()
    return [
        {
            "id": str(r["id"]),
            "role": r["role"],
            "content": r["content"],
            "tokens": r["tokens_out"] or r["tokens_in"] or 0,
            "timestamp": r["created_at"],
            "agentSlug": slug,
        }
        for r in reversed(rows)
    ]


@router.post("/{slug}", response_model=ChatResponse)
async def chat(slug: str, req: ChatRequest, current_user = Depends(get_current_user)):
    if slug not in CATALOG:
        raise HTTPException(404, f"Agente '{slug}' no registrado")

    client, provider = _get_client()
    model   = CATALOG[slug]["model"]
    history = _load_history(slug)

    # Formato OpenAI: system va como primer mensaje con role "system"
    messages = [{"role": "system", "content": PROMPTS.get(slug, "Eres un asistente util. Responde en espanol.")}]
    messages += history
    messages += [{"role": "user", "content": req.text}]

    _log(slug, "CHAT_START", req.text[:60] + ("..." if len(req.text) > 60 else ""))
    await event_manager.agent_status(slug, "busy", CATALOG[slug]["name"])
    await event_manager.chat_typing(slug, True)
    t0 = time.time()

    try:
        extra_headers = {}
        if provider == "openrouter":
            extra_headers = {
                "HTTP-Referer": "http://localhost:5175",
                "X-Title":      "MainFJ Dashboard",
            }

        resp = client.chat.completions.create(
            model=model,
            max_tokens=2048,
            messages=messages,
            extra_headers=extra_headers,
        )

        text = resp.choices[0].message.content or ""
        ti   = resp.usage.prompt_tokens     if resp.usage else 0
        to   = resp.usage.completion_tokens if resp.usage else 0
        cost = _cost(model, ti, to)
        ms   = int((time.time() - t0) * 1000)

        _save(slug, "user",      req.text, ti, 0,  0)
        _save(slug, "assistant", text,     0,  to, cost)
        _log(slug, "CHAT_OK", f"{model} · {to} tokens · {ms}ms · ${cost:.5f}", "success", ms)

        await event_manager.chat_message(slug, "assistant", text, to)
        await event_manager.chat_typing(slug, False)
        await event_manager.agent_status(slug, "online", CATALOG[slug]["name"])
        await event_manager.new_log("success", slug, "CHAT_OK", f"{model} · {to} tokens · ${cost:.5f}", ms)

        if cost > 0.01:
            await event_manager.cost_alert(slug, cost, 0.01)

        return ChatResponse(
            text=text,
            agent_slug=slug,
            model_used=model,
            input_tokens=ti,
            output_tokens=to,
            cost_usd=cost,
        )

    except Exception as e:
        _log(slug, "CHAT_ERROR", str(e)[:120], "error")
        await event_manager.chat_typing(slug, False)
        await event_manager.agent_status(slug, "error", CATALOG[slug]["name"])
        await event_manager.new_log("error", slug, "CHAT_ERROR", str(e)[:120])
        raise HTTPException(500, str(e))
