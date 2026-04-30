# -*- coding: utf-8 -*-
"""Rutas financieras — lectura de Sheets + Finance Writer Agent (OpenRouter)."""
from __future__ import annotations
import io
import json
import re
import os
from datetime import datetime
from pathlib import Path

from openai import OpenAI
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.routers.auth import get_current_user&#10;from backend.sheets import read_tab, append_row, update_row, delete_row, COLUMNS
from backend.events import event_manager
import pytesseract
from PIL import Image

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

_OR_KEY  = os.getenv("OPENROUTER_API_KEY", "")
_ANT_KEY = os.getenv("ANTHROPIC_API_KEY",  "")

router = APIRouter(prefix="/finance", tags=["finance"])

# Modelo para tareas financieras: Haiku es suficiente y barato
_FINANCE_MODEL = "anthropic/claude-haiku-4-5"

# ── Finance Writer — system prompt ────────────────────────────────────────────
WRITER_PROMPT = f"""Eres el Finance Writer de FJ. Tu única función es interpretar mensajes en lenguaje natural
y convertirlos en registros estructurados para insertar en Google Sheets.

Pestañas disponibles y sus columnas:
- essentials: {COLUMNS['essentials']}
- ahorro:     {COLUMNS['ahorro']}
- basket:     {COLUMNS['basket']}
- shops:      {COLUMNS['shops']}
- wishlist:   {COLUMNS['wishlist']}
- debts:      {COLUMNS['debts']}

Reglas de clasificación:
- mercado, supermercado, productos del hogar, aseo → basket
- compra general, tienda, gasto puntual → shops
- Netflix, arriendo, servicios fijos, suscripciones → essentials
- ahorro, consignación, retiro, inversión → ahorro
- deuda, préstamo, me deben, le debo → debts
- quiero comprar, presupuestar, wishlist → wishlist

Reglas de formato:
- MONEDA: siempre "COP" o "USD"
- VALOR: solo número sin puntos ni comas (ej: 45000)
- FECHA: formato YYYY-MM-DD, si no se menciona usa la fecha de hoy
- ESTADO (debts): "PENDIENTE", "PAGADO" o "PARCIAL"
- MODO (essentials): "MENSUAL", "BIMENSUAL", "SEMESTRAL", "ANUAL", "ÚNICO"

Responde SIEMPRE en JSON con este formato exacto:
{{
  "tab": "<nombre_pestaña>",
  "data": {{ <columna>: <valor>, ... }},
  "confirmation": "<frase corta confirmando qué registraste>"
}}

Si el mensaje es ambiguo o falta información clave, responde:
{{
  "tab": null,
  "data": null,
  "confirmation": null,
  "question": "<pregunta para aclarar>"
}}
"""

# ── Prompts de análisis por pestaña ───────────────────────────────────────────
ANALYSIS_PROMPTS = {
    "essentials": "Eres el agente de Compromisos Esenciales de FJ. Analizas pagos fijos mensuales, alertas de vencimiento y estado de pagos. Sé conciso y directo. Responde en español.",
    "ahorro":     "Eres el agente de Ahorro de FJ. Analizas movimientos de la cuenta de ahorro, saldo disponible, ritmo de ahorro y proyecciones. Responde en español.",
    "basket":     "Eres el agente de Canasta Básica de FJ. Analizas inventario de productos, precios, qué falta comprar y comparaciones de gasto. Responde en español.",
    "shops":      "Eres el agente de Compras de FJ. Analizas historial de compras, gastos por categoría, tiendas frecuentes y tendencias. Responde en español.",
    "wishlist":   "Eres el agente de WishList de FJ. Administras la lista de deseos, prioridades de compra y presupuesto disponible. Responde en español.",
    "debts":      "Eres el agente de Deudas de FJ. Analizas deudas activas, próximos pagos, total adeudado y progreso de pago. Responde en español.",
}


def _get_client() -> OpenAI:
    if _OR_KEY:
        return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=_OR_KEY)
    if _ANT_KEY:
        return OpenAI(base_url="https://api.anthropic.com/v1", api_key=_ANT_KEY)
    raise HTTPException(503, "Configura OPENROUTER_API_KEY o ANTHROPIC_API_KEY en backend/.env")


def _extra_headers() -> dict:
    if _OR_KEY:
        return {"HTTP-Referer": "http://localhost:5175", "X-Title": "MainFJ Dashboard"}
    return {}


class WriteRequest(BaseModel):
    text: str


class AnalysisRequest(BaseModel):
    text: str
    tab:  str


class RecordCreate(BaseModel):
    tab: str
    data: dict


class RecordUpdate(BaseModel):
    tab: str
    row_index: int
    data: dict


class RecordDelete(BaseModel):
    tab: str
    row_index: int


# ── Finance Writer ─────────────────────────────────────────────────────────────
@router.post("/write")
async def finance_write(req: WriteRequest):
    """Interpreta lenguaje natural e inserta registro en el Sheet."""
    client = _get_client()
    await event_manager.agent_status("finance", "busy", "Finanzas")

    today = datetime.now().strftime("%Y-%m-%d")

    resp = client.chat.completions.create(
        model=_FINANCE_MODEL,
        max_tokens=512,
        messages=[
            {"role": "system", "content": WRITER_PROMPT},
            {"role": "user",   "content": f"Fecha de hoy: {today}\n\n{req.text}"},
        ],
        extra_headers=_extra_headers(),
    )

    raw = resp.choices[0].message.content.strip()

    # Extraer JSON si viene envuelto en markdown
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    result = json.loads(raw)

    if result.get("tab") and result.get("data"):
        append_row(result["tab"], result["data"])
        await event_manager.finance_written(result["tab"], result["confirmation"])
        await event_manager.new_log("success", "finance", "WRITE", result["confirmation"])
        await event_manager.agent_status("finance", "online", "Finanzas")
        return {
            "status":       "written",
            "tab":          result["tab"],
            "data":         result["data"],
            "confirmation": result["confirmation"],
        }

    await event_manager.agent_status("finance", "online", "Finanzas")
    return {"status": "clarification_needed", "question": result.get("question", "No entendí el registro.")}


# ── Análisis por pestaña ───────────────────────────────────────────────────────
@router.post("/analyze")
async def finance_analyze(req: AnalysisRequest):
    """Agente de análisis para una pestaña específica."""
    if req.tab not in ANALYSIS_PROMPTS:
        raise HTTPException(400, f"Tab '{req.tab}' no válido")

    client = _get_client()
    await event_manager.agent_status("finance", "busy", "Finanzas")

    try:
        records = read_tab(req.tab)
        context = f"Datos actuales ({len(records)} registros):\n{records[:50]}"
    except Exception as e:
        context = f"No se pudieron cargar los datos: {e}"

    resp = client.chat.completions.create(
        model=_FINANCE_MODEL,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": ANALYSIS_PROMPTS[req.tab]},
            {"role": "user",   "content": f"{context}\n\nPregunta: {req.text}"},
        ],
        extra_headers=_extra_headers(),
    )

    await event_manager.agent_status("finance", "online", "Finanzas")
    await event_manager.new_log("info", "finance", "ANALYZE", f"Analizó {req.tab}: {req.text[:50]}")

    records_loaded = len(records) if isinstance(records, list) else 0
    return {
        "text":           resp.choices[0].message.content,
        "tab":            req.tab,
        "records_loaded": records_loaded,
    }


# ── Resumen agregado de todas las pestañas ─────────────────────────────────────
@router.get("/summary")
def get_summary():
    """Devuelve totales y conteos por pestaña para el dashboard de finanzas."""
    tabs   = ["essentials", "ahorro", "basket", "shops", "wishlist", "debts"]
    result = {}
    for tab in tabs:
        try:
            records    = read_tab(tab)
            total_cop  = 0.0
            for r in records:
                val      = r.get("VALOR", 0)
                currency = r.get("MONEDA", "COP")
                if str(currency).upper() in ("COP", "") or tab == "ahorro":
                    try:
                        cleaned = (
                            str(val)
                            .replace("$", "")
                            .replace(".", "")
                            .replace(",", "")
                            .replace(" ", "")
                        )
                        total_cop += float(cleaned or 0)
                    except (ValueError, TypeError):
                        pass
            result[tab] = {"count": len(records), "total_cop": total_cop}
        except Exception as e:
            result[tab] = {"count": 0, "total_cop": 0.0, "error": str(e)}
    return result


# ── Lectura directa de pestañas ────────────────────────────────────────────────
@router.get("/data/{tab}")
def get_tab_data(tab: str):
    """Devuelve todos los registros de una pestaña."""
    valid_tabs = ["essentials", "ahorro", "basket", "shops", "wishlist", "debts"]
    if tab not in valid_tabs:
        raise HTTPException(400, f"Tab '{tab}' no válido")
    try:
        records = read_tab(tab)
        return {"tab": tab, "count": len(records), "records": records}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CRUD: Crear registro ─────────────────────────────────────────────────────
@router.post("/records")
def create_record(req: RecordCreate):
    """Crea un nuevo registro en una pestaña."""
    if req.tab not in COLUMNS:
        raise HTTPException(400, f"Tab '{req.tab}' no válido")
    try:
        append_row(req.tab, req.data)
        return {"status": "created", "tab": req.tab, "data": req.data}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CRUD: Actualizar registro ─────────────────────────────────────────────────
@router.put("/records")
def update_record(req: RecordUpdate):
    """Actualiza un registro existente por índice de fila."""
    if req.tab not in COLUMNS:
        raise HTTPException(400, f"Tab '{req.tab}' no válido")
    try:
        update_row(req.tab, req.row_index, req.data)
        return {"status": "updated", "tab": req.tab, "row_index": req.row_index}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CRUD: Eliminar registro ───────────────────────────────────────────────────
@router.delete("/records")
def delete_record(req: RecordDelete):
    """Elimina un registro por índice de fila."""
    if req.tab not in COLUMNS:
        raise HTTPException(400, f"Tab '{req.tab}' no válido")
    try:
        delete_row(req.tab, req.row_index)
        return {"status": "deleted", "tab": req.tab, "row_index": req.row_index}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── OCR Helper ─────────────────────────────────────────────────────────────
def _parse_invoice_text(text: str, tab: str) -> dict:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    text_upper = text.upper()

    date_match = re.search(r'(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})', text)
    if date_match:
        d, m, y = date_match.groups()
        y = ('20' + y) if len(y) == 2 else y
        date_str = f"{d.zfill(2)}/{m.zfill(2)}/{y}"
    else:
        date_str = datetime.now().strftime("%d/%m/%Y")

    total_match = re.search(
        r'(?:TOTAL|SUBTOTAL|VALOR|IMPORTE|A PAGAR)[^\d]*(\d[\d.,]+)', text_upper
    )
    if total_match:
        raw = total_match.group(1).replace('.', '').replace(',', '')
        value = str(int(float(raw)))
    else:
        amounts = re.findall(r'\b\d{3,}(?:[.,]\d{3})*\b', text)
        if amounts:
            value = max(amounts, key=lambda a: int(a.replace('.', '').replace(',', '')))
            value = value.replace('.', '').replace(',', '')
        else:
            value = ''

    store = ''
    for line in lines[:6]:
        if not re.match(r'^[\d\s.,+\-*%$#@/:NIT]+$', line, re.I) and len(line) > 2:
            store = line
            break

    mapping = {
        'shops':      {'DATE': date_str, 'VALUE': value, 'STORE': store, 'COIN': 'COP'},
        'basket':     {'VALOR': value, 'MONEDA': 'COP', 'PRODUCTO': store},
        'essentials': {'VALOR': value, 'MONEDA': 'COP', 'PRODUCTO': store},
        'debts':      {'FECHA': date_str, 'VALOR': value, 'MONEDA': 'COP', 'PRODUCTO': store},
        'wishlist':   {'VALOR': value, 'MONEDA': 'COP', 'PRODUCTO': store},
        'ahorro':     {'VALOR': value},
    }
    return mapping.get(tab, {'VALOR': value})


# ── OCR: Extraer datos de factura ──────────────────────────────────────────
@router.post("/ocr")
async def ocr_invoice(
    file: UploadFile = File(...),
    tab: str = Form(...)
):
    """Procesa imagen de factura con OCR y retorna campos pre-llenados."""
    if tab not in COLUMNS:
        raise HTTPException(400, f"Tab '{tab}' no valido")
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert('L')
        text = pytesseract.image_to_string(image, lang='spa+eng', config='--psm 6')
    except Exception as e:
        raise HTTPException(500, f"Error procesando imagen: {e}")
    extracted = _parse_invoice_text(text, tab)
    return {"extracted": extracted}
