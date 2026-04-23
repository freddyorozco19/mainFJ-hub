# -*- coding: utf-8 -*-
"""GET /agents — catálogo de agentes disponibles."""
from fastapi import APIRouter

router = APIRouter(prefix="/agents", tags=["agents"])

# ── Routing de modelos por agente ─────────────────────────────────────────────
# Estrategia:
#   - Trabajo complejo / razonamiento profundo → Claude Sonnet (mejor calidad)
#   - Trabajo técnico / código / datos         → Gemini Flash (rápido y barato)
#   - Tareas simples / alta frecuencia         → Llama 3 free (costo $0)
# ─────────────────────────────────────────────────────────────────────────────

CATALOG = {
    "orchestrator": {
        "name":        "CEO / Orquestador",
        "icon":        "🧠",
        "category":    "Core",
        "model":       "anthropic/claude-sonnet-4-5",
        "description": "Coordina todos los agentes y responde preguntas generales.",
    },
    "finance": {
        "name":        "Finanzas",
        "icon":        "💰",
        "category":    "Life",
        "model":       "anthropic/claude-haiku-4-5",
        "description": "Cuentas bancarias, gastos, presupuesto y metas financieras.",
    },
    "habits": {
        "name":        "Hábitos",
        "icon":        "🎯",
        "category":    "Life",
        "model":       "meta-llama/llama-3.3-8b-instruct:free",
        "description": "Hábitos diarios, rachas, metas de bienestar y productividad.",
    },
    "code": {
        "name":        "Código",
        "icon":        "💻",
        "category":    "Work",
        "model":       "google/gemini-2.0-flash-001",
        "description": "Python, SQL, BigQuery, ETL Pentaho, debugging.",
    },
    "data": {
        "name":        "Datos",
        "icon":        "📊",
        "category":    "Work",
        "model":       "google/gemini-2.0-flash-001",
        "description": "Análisis de datos, KPIs, queries BigQuery, pandas.",
    },
    "preventa": {
        "name":        "Preventa",
        "icon":        "📋",
        "category":    "Work",
        "model":       "anthropic/claude-sonnet-4-5",
        "description": "Propuestas técnicas, licitaciones, fichas SIGID.",
    },
    "research": {
        "name":        "Investigación",
        "icon":        "🔍",
        "category":    "Work",
        "model":       "meta-llama/llama-3.3-8b-instruct:free",
        "description": "Búsqueda de licitaciones, análisis competitivo.",
    },
    "agenda": {
        "name":        "Agenda Personal",
        "icon":        "📅",
        "category":    "Life",
        "model":       "meta-llama/llama-3.3-8b-instruct:free",
        "description": "Agenda, recordatorios y planificación semanal.",
    },
}

# ── Tabla de costos por modelo (USD por millón de tokens) ─────────────────────
MODEL_RATES: dict[str, tuple[float, float]] = {
    "anthropic/claude-haiku-4-5":                       (0.80,   4.00),
    "anthropic/claude-sonnet-4-5":                      (3.00,  15.00),
    "anthropic/claude-opus-4-5":                       (15.00,  75.00),
    "google/gemini-2.0-flash-001":                      (0.10,   0.40),
    "google/gemini-2.0-flash-exp:free":                 (0.00,   0.00),
    "meta-llama/llama-3.3-8b-instruct:free":            (0.00,   0.00),
    "meta-llama/llama-3.1-8b-instruct:free":            (0.00,   0.00),
    "mistralai/mistral-small-3.1-24b-instruct:free":    (0.00,   0.00),
}


@router.get("/")
def list_agents():
    return CATALOG


@router.get("/{slug}")
def get_agent(slug: str):
    if slug not in CATALOG:
        from fastapi import HTTPException
        raise HTTPException(404, f"Agente '{slug}' no encontrado")
    return CATALOG[slug]
