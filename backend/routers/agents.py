# -*- coding: utf-8 -*-
"""GET /agents — catálogo de agentes disponibles."""
from fastapi import APIRouter

router = APIRouter(prefix="/agents", tags=["agents"])

CATALOG = {
    "orchestrator": {"name": "CEO / Orquestador", "icon": "🧠", "category": "Core",  "model": "claude-haiku-4-5-20251001", "description": "Coordina todos los agentes y responde preguntas generales."},
    "finance":      {"name": "Finanzas",           "icon": "💰", "category": "Life",  "model": "claude-haiku-4-5-20251001", "description": "Cuentas bancarias, gastos, presupuesto y metas financieras."},
    "habits":       {"name": "Hábitos",            "icon": "🎯", "category": "Life",  "model": "claude-haiku-4-5-20251001", "description": "Hábitos diarios, rachas, metas de bienestar y productividad."},
    "code":         {"name": "Código",             "icon": "💻", "category": "Work",  "model": "claude-haiku-4-5-20251001", "description": "Python, SQL, BigQuery, ETL Pentaho, debugging."},
    "data":         {"name": "Datos",              "icon": "📊", "category": "Work",  "model": "claude-haiku-4-5-20251001", "description": "Análisis de datos, KPIs, queries BigQuery, pandas."},
    "preventa":     {"name": "Preventa",           "icon": "📋", "category": "Work",  "model": "claude-haiku-4-5-20251001", "description": "Propuestas técnicas, licitaciones, fichas SIGID."},
    "research":     {"name": "Investigación",      "icon": "🔍", "category": "Work",  "model": "claude-haiku-4-5-20251001", "description": "Búsqueda de licitaciones, análisis competitivo."},
    "agenda":       {"name": "Agenda Personal",    "icon": "📅", "category": "Life",  "model": "claude-haiku-4-5-20251001", "description": "Agenda, recordatorios y planificación semanal."},
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
