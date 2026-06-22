# -*- coding: utf-8 -*-
"""Rutas financieras - lectura de Sheets + Finance Writer Agent (OpenRouter)."""
from __future__ import annotations
import io
import json
import re
import os
import time
from datetime import datetime
from pathlib import Path

from openai import OpenAI
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.routers.auth import get_current_user
from backend.db import log_finance_history, get_conn
from backend.sheets import read_tab, append_row, append_rows_batch, update_row, delete_row, COLUMNS
from backend.events import event_manager
try:
    import pytesseract
    from PIL import Image
    _OCR_AVAILABLE = True
except ImportError:
    _OCR_AVAILABLE = False
    pytesseract = None  # type: ignore
    Image = None  # type: ignore

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

_OR_KEY  = os.getenv("OPENROUTER_API_KEY", "")
_ANT_KEY = os.getenv("ANTHROPIC_API_KEY",  "")

router = APIRouter(prefix="/finance", tags=["finance"])

# Modelo para tareas financieras: Haiku es suficiente y barato
_FINANCE_MODEL = "anthropic/claude-haiku-4-5"

# ── Finance Writer - system prompt ────────────────────────────────────────────
WRITER_PROMPT = f"""Eres el Finance Writer de FJ. Tu única función es interpretar mensajes en lenguaje natural
y convertirlos en registros estructurados para insertar en Google Sheets.

Pestañas disponibles y sus columnas:
- essentials: {COLUMNS['essentials']}
- ahorro:     {COLUMNS['ahorro']}
- basket:     {COLUMNS['basket']}
- shops:      {COLUMNS['shops']}
Requerido para shops con tarjeta de credito: agregar campo CUOTAS (numero de cuotas) en el JSON data.
- wishlist:   {COLUMNS['wishlist']}
- debts:      {COLUMNS['debts']}
- credito:    {COLUMNS['credito']}

Reglas de clasificación:
- mercado, supermercado, productos del hogar, aseo -> basket
- compra general, tienda, gasto puntual -> shops
- Netflix, arriendo, servicios fijos, suscripciones -> essentials
- ahorro, consignación, retiro, inversión -> ahorro
- deuda, préstamo, me deben, le debo -> debts
- quiero comprar, presupuestar, wishlist -> wishlist
- tarjeta de crédito, cuotas, Visa, Mastercard -> credito

Reglas de formato:
- MONEDA: siempre "COP" o "USD"
- VALOR: solo número sin puntos ni comas (ej: 45000)
- FECHA: formato YYYY-MM-DD, si no se menciona usa la fecha de hoy
- ESTADO (debts): "PENDIENTE", "PAGADO" o "PARCIAL"
- TIPO (credito): "INGRESO" (abono/pago) o "EGRESO" (deuda/compra)
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
    "credito":    "Eres el agente de Tarjetas de Crédito de FJ. Analizas compras a crédito, cuotas pendientes, fechas de corte y pago, y estado de cada tarjeta. Responde en español.",
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


class RecordBatchCreate(BaseModel):
    tab: str
    rows: list[dict]


class RecordUpdate(BaseModel):
    tab: str
    row_index: int
    data: dict


class RecordDelete(BaseModel):
    tab: str
    row_index: int
    reason: str | None = None


class AgentMessage(BaseModel):
    role: str
    content: str


class AgentRequest(BaseModel):
    message: str
    history: list[AgentMessage] = []
    current_tab: str = "shops"


class AgentAction(BaseModel):
    type: str
    tab: str | None = None
    data: dict | None = None
    row_index: int | None = None
    confirmation: str | None = None


class AgentResponse(BaseModel):
    text: str
    action: AgentAction | None = None
    needs_confirmation: bool = False



def _auto_link_credito(tab: str, data: dict):
    """Si un registro de shops se paga con tarjeta de credito, crea automaticamente un registro en credito."""
    if tab != "shops":
        return
    payment = str(data.get("PAYMENT", "")).lower()
    if "crédito" not in payment and "credito" not in payment:
        return

    cuotas = 1
    raw_cuotas = str(data.get("CUOTAS", "1")).strip()
    if raw_cuotas and raw_cuotas.isdigit():
        cuotas = int(raw_cuotas)

    valor = float(str(data.get("VALUE", 0)).replace("$", "").replace(",", "").replace(" ", "") or 0)
    valor_cuota = round(valor / cuotas, 2) if cuotas > 0 else valor

    credito_data = {
        "PRODUCTO":     data.get("PRODUCT", ""),
        "DESCRIPCION":  data.get("DESCRIPTION", f"Compra con tarjeta"),
        "ENTIDAD":      data.get("ACCOUNT", ""),
        "MONEDA":       data.get("COIN", "COP"),
        "VALOR_TOTAL":  valor,
        "CUOTAS":       cuotas,
        "CUOTA_ACTUAL": 1,
        "VALOR_CUOTA":  valor_cuota,
        "FECHA_CORTE":  "",
        "FECHA_PAGO":   "",
        "ESTADO":       "PENDIENTE",
        "TIPO":         "EGRESO",
    }
    try:
        append_row("credito", credito_data)
    except Exception as e:
        print(f"[CREDITO] Error creando registro automático: {e}")


# ── Finance Writer ─────────────────────────────────────────────────────────────
@router.post("/write")
async def finance_write(req: WriteRequest, current_user = Depends(get_current_user)):
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
        _auto_link_credito(result["tab"], result["data"])
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
async def finance_analyze(req: AnalysisRequest, current_user = Depends(get_current_user)):
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
_SUMMARY_CACHE = {"data": None, "timestamp": 0}
_SUMMARY_CACHE_ANALYTICS = {"data": None, "timestamp": 0}

@router.get("/summary")
def get_summary(current_user = Depends(get_current_user)):
    global _SUMMARY_CACHE
    now = time.time()
    if _SUMMARY_CACHE["data"] is not None and now - _SUMMARY_CACHE["timestamp"] < 120:
        return _SUMMARY_CACHE["data"]
    """Devuelve totales y conteos por pestaña para el dashboard de finanzas."""
    tabs   = ["essentials", "ahorro", "basket", "shops", "wishlist", "debts", "credito"]
    result = {}
    for tab in tabs:
        try:
            records    = read_tab(tab)
            total_cop  = 0.0
            for r in records:
                # shops usa columnas en inglés (VALUE / COIN)
                val      = r.get("VALUE", r.get("VALOR", 0))
                currency = r.get("COIN", r.get("MONEDA", "COP"))
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
    _SUMMARY_CACHE_ANALYTICS = {"data": result, "timestamp": now}
    return result


# ── Lectura directa de pestañas ────────────────────────────────────────────────
@router.get("/data/{tab}")
def get_tab_data(tab: str, current_user = Depends(get_current_user)):
    """Devuelve todos los registros de una pestaña."""
    valid_tabs = ["essentials", "ahorro", "basket", "shops", "wishlist", "debts", "credito"]
    if tab not in valid_tabs:
        raise HTTPException(400, f"Tab '{tab}' no válido")
    try:
        records = read_tab(tab)
        return {"tab": tab, "count": len(records), "records": records}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Analytics por pestaña ──────────────────────────────────────────────────────
@router.get("/analytics")
def get_analytics(current_user = Depends(get_current_user)):
    """Devuelve m\u00E9tricas detalladas por pesta\u00F1a para paneles de an\u00E1lisis."""
    global _SUMMARY_CACHE_ANALYTICS
    now = time.time()
    if _SUMMARY_CACHE_ANALYTICS["data"] is not None and now - _SUMMARY_CACHE_ANALYTICS["timestamp"] < 120:
        return _SUMMARY_CACHE_ANALYTICS["data"]
    tabs = ["essentials", "ahorro", "basket", "shops", "wishlist", "debts", "credito"]
    result = {}

    for tab in tabs:
        try:
            records = read_tab(tab)
            total_cop = 0.0
            values = []
            categories = {}
            stores = {}
            payments = {}
            statuses = {"PENDIENTE": 0, "PAGADO": 0, "PARCIAL": 0}
            currencies = {}

            for r in records:
                # Valor monetario
                val = r.get("VALUE", r.get("VALOR", 0))
                currency = r.get("COIN", r.get("MONEDA", "COP"))
                try:
                    cleaned = float(str(val).replace("$", "").replace(".", "").replace(",", "").replace(" ", "") or 0)
                except (ValueError, TypeError):
                    cleaned = 0.0

                if str(currency).upper() in ("COP", "") or tab == "ahorro":
                    total_cop += cleaned
                    values.append(cleaned)

                currencies[currency] = currencies.get(currency, 0) + 1

                # Categorías
                cat = r.get("CATEGORY", r.get("CATEGORIA", ""))
                if cat:
                    categories[cat] = categories.get(cat, 0) + 1

                # Tiendas
                store = r.get("STORE", r.get("TIENDA", ""))
                if store:
                    stores[store] = stores.get(store, 0) + 1

                # Métodos de pago
                payment = r.get("PAYMENT", r.get("MEDIO PAGO", r.get("MEDIO", "")))
                if payment:
                    payments[payment] = payments.get(payment, 0) + 1

                # Estados (debts)
                status = r.get("ESTADO", "")
                if status in statuses:
                    statuses[status] += 1

            # Calcular métricas
            avg = sum(values) / len(values) if values else 0
            max_val = max(values) if values else 0
            min_val = min(values) if values else 0

            result[tab] = {
                "count": len(records),
                "total_cop": total_cop,
                "average_cop": avg,
                "max_cop": max_val,
                "min_cop": min_val,
                "top_categories": sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5],
                "top_stores": sorted(stores.items(), key=lambda x: x[1], reverse=True)[:5],
                "top_payments": sorted(payments.items(), key=lambda x: x[1], reverse=True)[:5],
                "statuses": statuses,
                "currencies": currencies,
            }
        except Exception as e:
            result[tab] = {"error": str(e), "count": 0}

    _SUMMARY_CACHE_ANALYTICS = {"data": result, "timestamp": now}
    return result


# ── CRUD: Crear registro ─────────────────────────────────────────────────────
@router.post("/records")
def create_record(req: RecordCreate, current_user = Depends(get_current_user)):
    """Crea un nuevo registro en una pestaña."""
    if req.tab not in COLUMNS:
        raise HTTPException(400, f"Tab '{req.tab}' no válido")
    try:
        append_row(req.tab, req.data)
        log_finance_history(
            action="CREATE", tab=req.tab,
            data=req.data,
            user_email=getattr(current_user, 'email', None)
        )
        return {"status": "created", "tab": req.tab, "data": req.data}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CRUD: Batch create ────────────────────────────────────────────────────────
@router.post("/records/batch")
def create_records_batch(req: RecordBatchCreate, current_user = Depends(get_current_user)):
    """Crea múltiples registros de una sola vez (ej. compra con varios items)."""
    if req.tab not in COLUMNS:
        raise HTTPException(400, f"Tab '{req.tab}' no válido")
    if not req.rows:
        raise HTTPException(400, "No hay registros para crear")
    try:
        count = append_rows_batch(req.tab, req.rows)
        for row in req.rows:
            log_finance_history(
                action="CREATE", tab=req.tab,
                data=row,
                user_email=getattr(current_user, 'email', None)
            )
        return {"status": "created", "tab": req.tab, "count": count}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CRUD: Actualizar registro ─────────────────────────────────────────────────
@router.put("/records")
def update_record(req: RecordUpdate, current_user = Depends(get_current_user)):
    """Actualiza un registro existente por índice de fila."""
    if req.tab not in COLUMNS:
        raise HTTPException(400, f"Tab '{req.tab}' no válido")
    try:
        # Leer registro anterior para calcular diff
        old_records = read_tab(req.tab)
        old_record = old_records[req.row_index] if req.row_index < len(old_records) else {}

        update_row(req.tab, req.row_index, req.data)

        # Calcular diff: solo campos que cambiaron
        diff = {}
        for key, new_val in req.data.items():
            old_val = old_record.get(key)
            if str(old_val) != str(new_val):
                diff[key] = {"from": old_val, "to": new_val}

        log_finance_history(
            action="UPDATE", tab=req.tab, row_index=req.row_index,
            data={"diff": diff, "new": req.data},
            user_email=getattr(current_user, 'email', None)
        )
        return {"status": "updated", "tab": req.tab, "row_index": req.row_index, "diff": diff}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CRUD: Eliminar registro ───────────────────────────────────────────────────
@router.delete("/records")
def delete_record(req: RecordDelete, current_user = Depends(get_current_user)):
    """Elimina un registro por índice de fila."""
    if req.tab not in COLUMNS:
        raise HTTPException(400, f"Tab '{req.tab}' no válido")
    try:
        # Leer registro antes de eliminar para guardarlo en historial
        old_records = read_tab(req.tab)
        deleted_record = old_records[req.row_index] if req.row_index < len(old_records) else {}

        delete_row(req.tab, req.row_index)
        log_finance_history(
            action="DELETE", tab=req.tab, row_index=req.row_index,
            data={"deleted": deleted_record},
            reason=req.reason,
            user_email=getattr(current_user, 'email', None)
        )
        return {"status": "deleted", "tab": req.tab, "row_index": req.row_index}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── CRUD: Historial de operaciones ────────────────────────────────────────────
@router.get("/history")
def get_history(tab: str | None = None, limit: int = 100, current_user = Depends(get_current_user)):
    """Devuelve el historial de operaciones CRUD en finanzas."""
    with get_conn() as conn:
        cur = conn.cursor()
        if tab:
            cur.execute(
                """SELECT id, action, tab, row_index, data, reason, user_email, created_at
                   FROM finance_history WHERE tab = %s ORDER BY id DESC LIMIT %s""",
                (tab, limit)
            )
        else:
            cur.execute(
                """SELECT id, action, tab, row_index, data, reason, user_email, created_at
                   FROM finance_history ORDER BY id DESC LIMIT %s""",
                (limit,)
            )
        rows = cur.fetchall()
    return {
        "count": len(rows),
        "history": [dict(r) for r in rows]
    }


# ── Finance Agent - system prompt ───────────────────────────────────────────
FINANCE_AGENT_PROMPT = f"""Eres FINANCE, el agente de gestión financiera personal de FJ. Tienes acceso directo a sus registros financieros en Google Sheets.

Tu personalidad: profesional, eficiente, directo. Hablas en español. Usas emojis ocasionalmente para hacer la conversación amigable.

PESTAÑAS DISPONIBLES Y SUS COLUMNAS:
- essentials: {COLUMNS['essentials']} - Pagos fijos mensuales (Netflix, arriendo, servicios)
- ahorro:     {COLUMNS['ahorro']} - Ahorros e inversiones
- basket:     {COLUMNS['basket']} - Canasta básica y mercado
- shops:      {COLUMNS['shops']}
Requerido para shops con tarjeta de credito: agregar campo CUOTAS (numero de cuotas) en el JSON data. - Compras generales
- wishlist:   {COLUMNS['wishlist']} - Lista de deseos
- debts:      {COLUMNS['debts']}
- credito:    {COLUMNS['credito']} - Deudas y préstamos. TIPO "EGRESO" para compras/deudas, "INGRESO" para abonos/pagos.

REGLAS DE CLASIFICACIÓN:
- mercado, supermercado, productos del hogar, aseo -> basket
- compra general, tienda, gasto puntual -> shops
- Netflix, arriendo, servicios fijos, suscripciones -> essentials
- ahorro, consignación, retiro, inversión -> ahorro
- deuda, préstamo, me deben, le debo -> debts
- quiero comprar, presupuestar, wishlist -> wishlist
- tarjeta de crédito, cuotas, Visa, Mastercard -> credito
- abono, pago a tarjeta, pago de crédito -> credito con TIPO "INGRESO"

FORMATO DE RESPUESTA:
Responde SIEMPRE en JSON con este formato exacto:
{{
  "text": "<respuesta conversacional amigable>",
  "action": {{"type": "<none|create|update|delete|switch_tab>", "tab": "<tab>", "data": {{...}}, "row_index": <n>, "confirmation": "<descripción de la acción>"}},
  "needs_confirmation": <true|false>
}}

REGLAS DE ACCIONES:
1. `type: "none"` - Solo conversación, no ejecutes ninguna acción.
2. `type: "create"` - Cuando el usuario quiere registrar un nuevo gasto/ingreso. Extrae los datos del mensaje y ponlos en `data`.
3. `type: "update"` - Cuando el usuario quiere editar un registro existente. Pide el índice o identifica por descripción. `row_index` es 0-based.
4. `type: "delete"` - Cuando el usuario quiere eliminar un registro. Pide confirmación antes de devolver esta acción.
5. `type: "switch_tab"` - Cuando el usuario quiere ver otra pestaña.

REGLAS IMPORTANTES:
- Si el usuario pide crear/editar/borrar algo, DEVUELVE la acción correspondiente. No solo hables de ello.
- Si necesitas datos adicionales para una acción, responde con `action: {{"type": "none"}}` y pregunta al usuario.
- Para `delete`, SIEMPRE pide confirmación primero (`needs_confirmation: true`).
- Para `create`, si los datos son claros, ejecuta directamente (`needs_confirmation: false`). Si hay ambigüedad, pregunta.
- Los valores monetarios van sin puntos ni comas: 45000 no 45.000.
- La fecha de hoy es: {{today}}.
- Si el usuario dice "gasté 80k en el mercado", crea un registro en `basket` con VALOR: 80000, PRODUCTO: "Mercado", etc.
- Si el usuario dice "borra el registro de Netflix", busca en los datos de contexto el índice y devuelve `delete`.
- Si el usuario dice "edita la deuda de Juan", busca el registro y devuelve `update`.

EJEMPLOS:
Usuario: "gasté 50 mil en ropa en Zara"
-> {{"text": "Registrando tu compra en Zara por $50,000 COP 👕", "action": {{"type": "create", "tab": "shops", "data": {{"PRODUCT": "Ropa", "DESCRIPTION": "Compra en Zara", "CATEGORY": "Ropa", "STORE": "Zara", "COIN": "COP", "VALUE": 50000, "DATE": "{{today}}"}}, "confirmation": "Compra en Zara por $50,000 COP"}}, "needs_confirmation": false}}

Usuario: "muéstrame mis deudas"
-> {{"text": "Aquí están tus deudas pendientes 📋", "action": {{"type": "switch_tab", "tab": "debts"}}, "needs_confirmation": false}}

Usuario: "borra el último registro"
-> {{"text": "¿Estás seguro de que quieres eliminar el último registro de {{current_tab}}? Esta acción no se puede deshacer.", "action": {{"type": "none"}}, "needs_confirmation": true}}
"""


# ── Finance Agent Endpoint ──────────────────────────────────────────────────
@router.post("/agent", response_model=AgentResponse)
async def finance_agent(req: AgentRequest, current_user = Depends(get_current_user)):
    """Agente conversacional FINANCE con capacidad de ejecutar acciones CRUD."""
    client = _get_client()
    await event_manager.agent_status("finance", "busy", "Finanzas")

    today = datetime.now().strftime("%Y-%m-%d")

    # Cargar registros actuales para contexto
    context_records = []
    try:
        records = read_tab(req.current_tab)
        context_records = records[:20]  # Últimos 20 registros
    except Exception:
        pass

    context_str = f"""
Pestaña actual: {req.current_tab}
Registros actuales ({len(context_records)} mostrados):
{json.dumps(context_records, ensure_ascii=False, indent=2)}
"""

    messages = [
        {"role": "system", "content": FINANCE_AGENT_PROMPT.replace("{{today}}", today).replace("{{current_tab}}", req.current_tab)},
    ]

    for msg in req.history[-10:]:  # Últimos 10 mensajes
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": f"{context_str}\n\nMensaje del usuario: {req.message}"})

    t0 = time.time()
    try:
        resp = client.chat.completions.create(
            model=_FINANCE_MODEL,
            max_tokens=1024,
            messages=messages,
            extra_headers=_extra_headers(),
        )

        raw = resp.choices[0].message.content.strip()

        # Extraer JSON si viene envuelto en markdown
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip()

        result = json.loads(raw)

        text = result.get("text", "No entendí bien. ¿Puedes repetir?")
        action_data = result.get("action", {"type": "none"})
        action = AgentAction(**action_data) if action_data else None
        needs_confirmation = result.get("needs_confirmation", False)

        # Ejecutar acción directamente si no necesita confirmación
        if action and action.type == "create" and action.tab and action.data and not needs_confirmation:
            try:
                append_row(action.tab, action.data)
                log_finance_history(
                    action="CREATE", tab=action.tab,
                    data=action.data,
                    user_email=getattr(current_user, 'email', None)
                )
                await event_manager.finance_written(action.tab, action.confirmation or "Registro creado")
                await event_manager.new_log("success", "finance", "AGENT_CREATE", action.confirmation or "Registro creado")
            except Exception as e:
                text = f"Error al crear el registro: {e}"
                action = None

        if action and action.type == "delete" and action.tab and action.row_index is not None and not needs_confirmation:
            try:
                delete_row(action.tab, action.row_index)
                log_finance_history(
                    action="DELETE", tab=action.tab, row_index=action.row_index,
                    reason=f"Agente FINANCE: {action.confirmation or 'Eliminación automática'}",
                    user_email=getattr(current_user, 'email', None)
                )
                await event_manager.new_log("success", "finance", "AGENT_DELETE", f"Fila {action.row_index} de {action.tab}")
            except Exception as e:
                text = f"Error al eliminar el registro: {e}"
                action = None

        if action and action.type == "update" and action.tab and action.row_index is not None and action.data and not needs_confirmation:
            try:
                update_row(action.tab, action.row_index, action.data)
                log_finance_history(
                    action="UPDATE", tab=action.tab, row_index=action.row_index,
                    data=action.data,
                    user_email=getattr(current_user, 'email', None)
                )
                await event_manager.new_log("success", "finance", "AGENT_UPDATE", f"Fila {action.row_index} de {action.tab}")
            except Exception as e:
                text = f"Error al actualizar el registro: {e}"
                action = None

        ms = int((time.time() - t0) * 1000)
        await event_manager.agent_status("finance", "online", "Finanzas")
        await event_manager.new_log("info", "finance", "AGENT_CHAT", f"{req.message[:50]}...", ms)

        return AgentResponse(
            text=text,
            action=action,
            needs_confirmation=needs_confirmation,
        )

    except Exception as e:
        await event_manager.agent_status("finance", "error", "Finanzas")
        await event_manager.new_log("error", "finance", "AGENT_ERROR", str(e)[:120])
        raise HTTPException(500, str(e))



# ── Migración: Sincronizar Shops -> Crédito ───────────────────────────────────
@router.post("/migrate-credito")
def migrate_credito(current_user = Depends(get_current_user)):
    """Escanea shops y crea/actualiza registros en credito para compras con tarjeta de crédito."""
    try:
        shops_records = read_tab("shops")
    except Exception as e:
        raise HTTPException(500, f"Error leyendo shops: {e}")

    # Leer existentes en credito
    try:
        existing = read_tab("credito")
    except Exception:
        existing = []

    # Indexar existentes por (PRODUCTO, VALOR_TOTAL) para match rápido
    existing_index: dict[tuple[str, str], tuple[int, dict]] = {}
    for idx, ex in enumerate(existing):
        key = (str(ex.get("PRODUCTO", "")), str(ex.get("VALOR_TOTAL", "")))
        existing_index[key] = (idx, ex)

    created = 0
    updated = 0
    skipped = 0
    to_create: list[dict] = []

    for r in shops_records:
        payment = str(r.get("PAYMENT", "")).lower()
        if "crédito" not in payment and "credito" not in payment:
            continue

        shop_key = (str(r.get("PRODUCT", "")), str(r.get("VALUE", "")))

        try:
            valor = float(str(r.get("VALUE", 0)).replace("$", "").replace(",", "").replace(" ", "") or 0)
        except (ValueError, TypeError):
            valor = 0

        cuotas = 1
        raw_cuotas = str(r.get("CUOTAS", "1")).strip()
        if raw_cuotas and raw_cuotas.isdigit():
            cuotas = int(raw_cuotas)

        valor_cuota = round(valor / cuotas, 2) if cuotas > 0 else valor
        account = str(r.get("ACCOUNT", "")).strip()

        if shop_key in existing_index:
            row_idx, ex_record = existing_index[shop_key]
            entidad = str(ex_record.get("ENTIDAD", "")).strip()
            tipo = str(ex_record.get("TIPO", "")).strip()
            needs_update = False
            update_data = dict(ex_record)
            if entidad == "Tarjeta" or entidad == "":
                update_data["ENTIDAD"] = account or entidad
                needs_update = True
            if tipo == "":
                update_data["TIPO"] = "EGRESO"
                needs_update = True
            if needs_update:
                try:
                    update_row("credito", row_idx, update_data)
                    updated += 1
                except Exception as e:
                    print(f"[MIGRATE] Error actualizando {shop_key}: {e}")
            else:
                skipped += 1
        else:
            credito_data = {
                "PRODUCTO":     shop_key[0],
                "DESCRIPCION":  str(r.get("DESCRIPTION", "Compra con tarjeta")),
                "ENTIDAD":      account,
                "MONEDA":       str(r.get("COIN", "COP")),
                "VALOR_TOTAL":  valor,
                "CUOTAS":       cuotas,
                "CUOTA_ACTUAL": 1,
                "VALOR_CUOTA":  valor_cuota,
                "FECHA_CORTE":  "",
                "FECHA_PAGO":   "",
                "ESTADO":       "PENDIENTE",
                "TIPO":         "EGRESO",
            }
            to_create.append(credito_data)

    if to_create:
        try:
            append_rows_batch("credito", to_create)
            created = len(to_create)
        except Exception as e:
            print(f"[MIGRATE] Error batch create: {e}")

    return {"status": "ok", "created": created, "updated": updated, "skipped": skipped, "total_shops": len(shops_records)}


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
async def ocr_invoice(current_user = Depends(get_current_user), 
    file: UploadFile = File(...),
    tab: str = Form(...)
):
    """Procesa imagen de factura con OCR y retorna campos pre-llenados."""
    if not _OCR_AVAILABLE:
        raise HTTPException(503, "OCR no disponible. Instala tesseract-ocr en el servidor.")
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


# ── Extractos bancarios (PDF) ────────────────────────────────────────────────
try:
    from pypdf import PdfReader
    _PDF_AVAILABLE = True
except ImportError:
    PdfReader = None  # type: ignore
    _PDF_AVAILABLE = False


def _extract_statement_metadata(text: str, entity: str) -> dict:
    """Extrae información general del extracto (cuenta, periodo, vencimiento, cupo, etc.)."""
    meta: dict = {}
    entity_lower = entity.lower()

    if entity_lower == 'nubank':
        # Nubank: "Tarjeta de crédito terminada en •••• 5741"
        card_m = re.search(r'terminada en[^\d]*(\d{4})', text)
        if card_m:
            meta['cuenta'] = f'**** {card_m.group(1)}'
        # Periodo: "26 MAR - 25 ABR 2026"
        period_m = re.search(r'(\d{1,2}\s+\w{3})\s*-\s*(\d{1,2}\s+\w{3}\s+\d{4})', text, re.I)
        if period_m:
            meta['periodo'] = f'{period_m.group(1)} - {period_m.group(2)}'
        # Vencimiento: "Fecha limite de pago\n15\nMAY\n2026" or "Fecha de pago ... DD MMM YYYY"
        venc_m = re.search(r'[Ff]echa\s+(?:l[ií]mite\s+de\s+)?pago[:\s]*(\d{1,2})\s*(\w{3})\s*(\d{4})', text, re.I)
        if venc_m:
            meta['vencimiento'] = f'{venc_m.group(1)} {venc_m.group(2)} {venc_m.group(3)}'
        else:
            venc_lines = re.search(r'[Ff]echa\s+(?:l[ií]mite\s+de\s+)?pago\s*\n\s*(\d{1,2})\s*\n\s*(\w{3})\s*\n\s*(\d{4})', text)
            if venc_lines:
                meta['vencimiento'] = f'{venc_lines.group(1)} {venc_lines.group(2)} {venc_lines.group(3)}'
        # Cupo / Saldo
        cupo_m = re.search(r'[Ll][ií]mite.*?\$([\d.,]+)', text)
        if cupo_m:
            meta['cupo_total'] = f'${cupo_m.group(1)}'
        total_m = re.search(r'[Tt]otal\s+a\s+pagar.*?\$([\d.,]+)', text)
        if total_m:
            meta['total_pagar'] = f'${total_m.group(1)}'

    elif entity_lower == 'lulobank':
        # Lulo: periodo "Mar 22, 2026 - Abr 21, 2026"
        period_m = re.search(r'(\w{3}\s+\d{1,2},\s*\d{4})\s*-\s*(\w{3}\s+\d{1,2},\s*\d{4})', text)
        if period_m:
            meta['periodo'] = f'{period_m.group(1)} - {period_m.group(2)}'
        # Vencimiento: "Fecha de pago\nMay 4, 2026"
        venc_m = re.search(r'[Ff]echa de pago\s*\n?\s*(\w{3}\s+\d{1,2},\s*\d{4})', text)
        if venc_m:
            meta['vencimiento'] = venc_m.group(1)
        # Cupo
        cupo_m = re.search(r'Cupo\s+[Tt]otal\s*\$?([\d,.]+)', text)
        if cupo_m:
            meta['cupo_total'] = f'${cupo_m.group(1)}'
        disp_m = re.search(r'Cupo\s+disponible\s*\$?([\d,.]+)', text)
        if disp_m:
            meta['cupo_disponible'] = f'${disp_m.group(1)}'
        total_m = re.search(r'Valor\s+a\s+pagar.*?\$([\d,.]+)', text, re.DOTALL)
        if total_m:
            meta['total_pagar'] = f'${total_m.group(1)}'
        pago_min = re.search(r'Pago\s+m[ií]nimo\s*\$?([\d,.]+)', text)
        if pago_min:
            meta['pago_minimo'] = f'${pago_min.group(1)}'

    elif entity_lower == 'bancolombia':
        card_m = re.search(r'Tarjeta:\s*\*+(\d{4})', text)
        if card_m:
            meta['cuenta'] = f'**** {card_m.group(1)}'
        # Use "Moneda: PESOS" section for summary data
        pesos_idx = text.find('Moneda: PESOS')
        if pesos_idx < 0:
            pesos_idx = text.find('ESTADO DE CUENTA EN: PESOS')
        pesos_text = text[pesos_idx:] if pesos_idx >= 0 else text
        # Periodo: "15 abr - 18 may. 2026" (after "Periodo facturado\n")
        period_m = re.search(r'Periodo\s+facturado\s*\n\s*(\d{1,2}\s+\w{3}\.?)\s*-\s*(\d{1,2}\s+\w{3}\.?\s+\d{4})', pesos_text, re.I)
        if period_m:
            meta['periodo'] = f'{period_m.group(1)} - {period_m.group(2)}'
        # Vencimiento: "Pagar antes de:\njun. 02, 2026"
        venc_m = re.search(r'Pagar\s+antes\s+de:\s*\n\s*(\w{3}\.?\s+\d{2},\s*\d{4})', pesos_text, re.I)
        if venc_m:
            meta['vencimiento'] = venc_m.group(1)
        cupo_m = re.search(r'Cupo\s+total:\s*\$\s*([\d.,]+)', pesos_text, re.I)
        if cupo_m:
            meta['cupo_total'] = f'${cupo_m.group(1)}'
        disp_m = re.search(r'Disponible:\s*\$\s*([\d.,]+)', pesos_text, re.I)
        if disp_m:
            meta['cupo_disponible'] = f'${disp_m.group(1)}'
        # "Pago Total:\n$ 2.510.890,00$ 2.510.890,00..." — grab first occurrence
        total_m = re.search(r'Pago\s+Total:\s*\n\s*\$\s*([\d.,]+)', pesos_text, re.I)
        if total_m:
            meta['total_pagar'] = f'${total_m.group(1)}'
        pmin_m = re.search(r'Pago\s+m[ií]nimo:\s*\n\s*\$\s*([\d.,]+)', pesos_text, re.I)
        if pmin_m:
            meta['pago_minimo'] = f'${pmin_m.group(1)}'

    return meta


def _parse_nubank_credit(text: str) -> list[dict]:
    """Parsea extracto de tarjeta de crédito Nubank.

    PyPDF2 extrae el PDF en formatos posibles:
      DD MMM\\n
      YYYYDescripcion $VALOR X de N $CUOTA ...    (todo en una línea)
    o con descripción multilinea:
      DD MMM\\n
      YYYYDescripcion parte1\\n
      parte2 $VALOR X de N $CUOTA ...              (montos en línea siguiente)
    """
    lines = text.split('\n')
    transactions: list[dict] = []

    MONTHS = {
        'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12',
    }

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        date_match = re.match(r'^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$', line, re.I)
        if not date_match:
            i += 1
            continue

        day = date_match.group(1).zfill(2)
        month = MONTHS.get(date_match.group(2).upper(), '01')
        i += 1

        if i >= len(lines):
            break
        next_line = lines[i].strip()
        i += 1

        year_match = re.match(r'^(\d{4})(.+)$', next_line)
        if not year_match:
            continue

        year = year_match.group(1)
        rest = year_match.group(2).strip()
        fecha = f"{day}/{month}/{year}"

        # Split description from first $ sign (amounts start there)
        dollar_pos = rest.find('$')
        if dollar_pos > 0:
            descripcion = rest[:dollar_pos].strip()
            amounts_part = rest[dollar_pos:]
        else:
            # No $ found — description continues on next line(s)
            descripcion = rest
            amounts_part = ''
            while i < len(lines):
                continuation = lines[i].strip()
                # Stop if we hit another date line
                if re.match(r'^\d{1,2}\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$', continuation, re.I):
                    break
                # Stop if empty or looks like a section header
                if not continuation:
                    i += 1
                    break
                i += 1
                cdollar = continuation.find('$')
                if cdollar >= 0:
                    if cdollar > 0:
                        descripcion += ' ' + continuation[:cdollar].strip()
                    amounts_part = continuation[cdollar:]
                    break
                else:
                    descripcion += ' ' + continuation

        # Parse all $amounts and interest from amounts_part
        # Format: $VALOR 1 de N $CUOTA $CUOTA $SALDOPCT% $VALOR_INTERES
        def _parse_cop(s: str) -> float:
            try:
                return abs(float(s.replace('.', '').replace(',', '.')))
            except ValueError:
                return 0.0

        valor = 0.0
        valor_match = re.search(r'\$([\d.,]+)', amounts_part)
        if valor_match:
            valor = _parse_cop(valor_match.group(1))

        cuotas_str = ''
        cuotas_match = re.search(r'(\d+)\s+de\s+(\d+)', amounts_part)
        if cuotas_match:
            cuotas_str = f"{cuotas_match.group(1)}/{cuotas_match.group(2)}"

        valor_cuota = valor
        pct_interes = ''
        valor_interes = 0.0

        if cuotas_match:
            after_cuotas = amounts_part[cuotas_match.end():]
            # All $amounts after cuotas: $CUOTA $CUOTA $SALDO[PCT%] $VALOR_INTERES
            dollar_amounts = list(re.finditer(r'\$([\d.,]+)', after_cuotas))

            if len(dollar_amounts) >= 1:
                valor_cuota = _parse_cop(dollar_amounts[0].group(1))

            # Interest % is glued to a $amount: "$135.117,332.06%"
            pct_match = re.search(r'([\d.]+)%', after_cuotas)
            if pct_match:
                pct_interes = f"{pct_match.group(1)}%"

            # Last $amount is valor_interes
            if len(dollar_amounts) >= 3:
                valor_interes = _parse_cop(dollar_amounts[-1].group(1))

        transactions.append({
            'FECHA': fecha,
            'DESCRIPCION': descripcion,
            'VALOR': valor,
            'VALOR_CUOTA': valor_cuota,
            'PCT_INTERES': pct_interes,
            'VALOR_INTERES': valor_interes,
            'CUOTAS': cuotas_str,
            'ENTIDAD': 'Nubank',
        })

    return transactions


def _parse_lulobank_credit(text: str) -> list[dict]:
    """Parsea extracto de tarjeta de crédito Lulo Bank.

    Formato esperado (puede variar entre PyPDF2 y pdfjs):
      Abr 1, 2026 $32,200.00 RAPPI COLOMBIA*DL 0.00% 1 de 1 $00.00
    """
    import logging
    log = logging.getLogger("lulobank_parser")

    transactions: list[dict] = []

    MONTHS = {
        'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Ago': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12',
    }

    # Strategy 1: single-line regex (works with pdfjs / pdf-parse-new)
    pattern_single = re.compile(
        r'(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+'
        r'(\d{1,2}),\s*(\d{4})\s+'
        r'\$([\d,.]+)\s+'
        r'(.+?)\s+'
        r'[\d.]+%\s+'
        r'(\d+)\s+de\s+(\d+)\s+'
        r'\$([\d,.]+)'
    )

    # Strategy 2: multi-line regex (PyPDF2 may insert newlines between columns)
    pattern_multi = re.compile(
        r'(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+'
        r'(\d{1,2}),?\s*(\d{4})\s*'
        r'\$?([\d,.]+)\s+'
        r'(.+?)\s+'
        r'[\d.]+\s*%\s*'
        r'(\d+)\s+de\s+(\d+)\s+'
        r'\$?([\d,.]+)',
        re.DOTALL,
    )

    # Strategy 3: date-anchored line-by-line for PyPDF2 table extraction
    # PyPDF2 sometimes concatenates columns without proper spacing
    pattern_date = re.compile(
        r'(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+(\d{1,2}),?\s*(\d{4})'
    )

    # Try single-line first
    for match in pattern_single.finditer(text):
        tx = _build_lulo_tx(match, MONTHS)
        if tx:
            transactions.append(tx)

    if transactions:
        log.info(f"Lulo parser: {len(transactions)} tx found with single-line regex")
        return transactions

    # Try multi-line (limit description match to avoid spanning rows)
    mov_idx = text.find('Movimientos')
    search_text = text[mov_idx:] if mov_idx >= 0 else text
    log.info(f"Lulo parser: searching in text starting at 'Movimientos' (found={mov_idx >= 0}), len={len(search_text)}")

    for match in pattern_multi.finditer(search_text):
        desc = match.group(5).strip()
        if len(desc) > 80:
            continue
        tx = _build_lulo_tx(match, MONTHS)
        if tx:
            transactions.append(tx)

    if transactions:
        log.info(f"Lulo parser: {len(transactions)} tx found with multi-line regex")
        return transactions

    # Strategy 3: line-by-line parsing
    # Find each date, then extract fields from that line + next lines
    lines = search_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        date_match = pattern_date.match(line)
        if date_match:
            month_name = date_match.group(1)
            day = date_match.group(2).zfill(2)
            year = date_match.group(3)
            month = MONTHS.get(month_name, '01')
            fecha = f"{day}/{month}/{year}"

            remainder = line[date_match.end():].strip()
            # Collect next lines if remainder is short (PyPDF2 split columns)
            context = remainder
            for j in range(1, 5):
                if i + j < len(lines):
                    next_line = lines[i + j].strip()
                    if next_line and not pattern_date.match(next_line):
                        context += " " + next_line
                    else:
                        break

            valor_match = re.search(r'\$?([\d,]+\.\d{2})', context)
            cuotas_match = re.search(r'(\d+)\s+de\s+(\d+)', context)
            pct_match = re.search(r'[\d.]+\s*%', context)

            if valor_match and cuotas_match:
                try:
                    valor = int(float(valor_match.group(1).replace(',', '')))
                except ValueError:
                    valor = 0

                cuota_actual = cuotas_match.group(1)
                cuota_total = cuotas_match.group(2)

                if cuota_total == '0' and cuota_actual == '0':
                    i += 1
                    continue

                # Description is between valor and percentage
                desc_start = valor_match.end()
                desc_end = pct_match.start() if pct_match else cuotas_match.start()
                descripcion = context[desc_start:desc_end].strip().strip('%').strip()
                if not descripcion:
                    desc_end2 = cuotas_match.start()
                    descripcion = context[desc_start:desc_end2].strip()

                # Saldo pendiente: last $amount in context
                saldo = 0
                saldo_matches = list(re.finditer(r'\$?([\d,]+\.\d{2})', context))
                if len(saldo_matches) >= 2:
                    try:
                        saldo = int(float(saldo_matches[-1].group(1).replace(',', '')))
                    except ValueError:
                        saldo = 0

                cuotas_str = f"{cuota_actual}/{cuota_total}" if cuota_total != '0' else ''

                transactions.append({
                    'FECHA': fecha,
                    'DESCRIPCION': descripcion,
                    'VALOR': valor,
                    'VALOR_CUOTA': valor,
                    'PCT_INTERES': '0.00%',
        'VALOR_INTERES': 0,
                    'CUOTAS': cuotas_str,
                    'SALDO_PENDIENTE': saldo,
                    'ENTIDAD': 'Lulo Bank',
                })
        i += 1

    log.info(f"Lulo parser: {len(transactions)} tx found with line-by-line strategy")
    return transactions


def _build_lulo_tx(match: re.Match, months: dict) -> dict | None:
    """Helper to build a Lulo Bank transaction dict from a regex match."""
    month_name = match.group(1)
    day = match.group(2).zfill(2)
    year = match.group(3)
    month = months.get(month_name, '01')
    fecha = f"{day}/{month}/{year}"

    try:
        valor = int(float(match.group(4).replace(',', '')))
    except ValueError:
        valor = 0

    descripcion = match.group(5).strip()
    cuota_actual = match.group(6)
    cuota_total = match.group(7)

    if cuota_total == '0' and cuota_actual == '0':
        return None

    cuotas_str = f"{cuota_actual}/{cuota_total}" if cuota_total != '0' else ''

    saldo_raw = match.group(8).replace(',', '')
    try:
        saldo = int(float(saldo_raw))
    except ValueError:
        saldo = 0

    return {
        'FECHA': fecha,
        'DESCRIPCION': descripcion,
        'VALOR': valor,
        'VALOR_CUOTA': valor,
        'PCT_INTERES': '0.00%',
        'VALOR_INTERES': 0,
        'CUOTAS': cuotas_str,
        'SALDO_PENDIENTE': saldo,
        'ENTIDAD': 'Lulo Bank',
    }


def _parse_falabella_credit(text: str) -> list[dict]:
    """Parsea extracto de tarjeta CMR Falabella.

    Formato (pypdf extrae columnas como líneas separadas):
      04/04/2026
      CAC*DROGUERIA ESPECIAL CL 9
      T
      $6.200,00
      2 de 24
      26,74%
      $258,33  $5.683,34
    """
    # Cortar antes de la sección de cuenta de ahorros
    for marker in ('ESTADO CUENTA', 'INGRESO POR INTERESES'):
        idx = text.find(marker)
        if idx > 0:
            text = text[:idx]
            break

    date_pat   = re.compile(r'^\d{2}/\d{2}/\d{4}$')
    value_pat  = re.compile(r'^-?\$[\d.,]+$')
    cuotas_pat = re.compile(r'^(\d+)\s+de\s+(\d+)$')
    tasa_pat   = re.compile(r'^[\d,]+%$')

    SKIP_DESC = {
        'pago tarjeta cmr', 'gmf gravamen', 'pago de tarjeta de credito desde',
        'ingreso por intereses', 'saldo en mora', 'intereses mora',
    }

    lines = [l.strip() for l in text.split('\n')]
    date_idxs = [i for i, l in enumerate(lines) if date_pat.match(l)]

    transactions: list[dict] = []
    for n, pos in enumerate(date_idxs):
        end = date_idxs[n + 1] if n + 1 < len(date_idxs) else len(lines)
        block = [l for l in lines[pos:end] if l and l not in ('T', 'A')]

        if len(block) < 2:
            continue

        day, month, year = block[0].split('/')
        fecha = f"{day}/{month}/{year}"

        # Descripción: líneas antes del primer valor monetario (sin duplicados)
        desc_lines: list[str] = []
        seen: set[str] = set()
        for l in block[1:]:
            if value_pat.match(l) or cuotas_pat.match(l) or tasa_pat.match(l):
                break
            if l not in seen:
                desc_lines.append(l)
                seen.add(l)

        # Eliminar sufijo "CAMBIO CUOTAS N EN COM" que agrega el PDF
        raw_desc = ' '.join(desc_lines).strip()
        descripcion = re.sub(r'\s+CAMBIO CUOTAS\s+\d+\s+EN\s+COM', '', raw_desc, flags=re.IGNORECASE).strip()
        desc_lower = descripcion.lower()

        if any(s in desc_lower for s in SKIP_DESC):
            continue

        # Primer valor monetario → monto de la transacción
        valor_raw = next((l for l in block[1:] if value_pat.match(l)), None)
        if not valor_raw:
            continue

        is_negative = valor_raw.startswith('-')
        try:
            # Formato colombiano: $6.200,00 → eliminar no-dígitos excepto coma → 6200,00 → 6200.00
            valor = abs(float(re.sub(r'[^0-9,]', '', valor_raw).replace(',', '.')))
        except ValueError:
            continue

        if valor == 0:
            continue

        # Cuotas (ej: "2 de 24")
        cuotas_str = ''
        for l in block[1:]:
            m = cuotas_pat.match(l)
            if m:
                cuotas_str = f"{m.group(1)}/{m.group(2)}"
                break

        # Tasa efectiva anual
        tasa = next((l for l in block[1:] if tasa_pat.match(l)), '')

        transactions.append({
            'FECHA': fecha,
            'DESCRIPCION': descripcion,
            'VALOR': valor,
            'VALOR_CUOTA': valor,
            'PCT_INTERES': tasa,
            'VALOR_INTERES': 0.0,
            'CUOTAS': cuotas_str,
            'TIPO': 'INGRESO' if is_negative else 'EGRESO',
            'ENTIDAD': 'Falabella',
        })

    return transactions


def _parse_bancolombia_credit(text: str) -> list[dict]:
    """Parsea extracto de tarjeta de crédito Bancolombia (AMEX u otra).

    Formato (sección PESOS):
      AMAZON.COM776701 02/05/2026 $ 372.651,00 1/6 $ 62.108,50 1,9915 % 26,6974 % $ 310.542,50
      ABONO SUCURSAL VIRTUAL951520 05/05/2026 $ -50.000,00 $ -50.000,00 $ 0,00
    """
    transactions: list[dict] = []

    # Only parse PESOS section (skip DOLARES)
    pesos_idx = text.find('ESTADO DE CUENTA EN: PESOS')
    if pesos_idx < 0:
        pesos_idx = text.find('Moneda: PESOS')
    search_text = text[pesos_idx:] if pesos_idx >= 0 else text

    # Transaction lines: DESCRIPTION[AUTH] DATE $ AMOUNT [CUOTAS] $ CUOTA [INTERES% ANUAL%] $ SALDO
    pattern = re.compile(
        r'(.+?)\s*(\d{2}/\d{2}/\d{4})\s+'
        r'\$\s*(-?[\d.]+,\d{2})\s+'
        r'(?:(\d+/\d+)\s+)?'
        r'\$\s*(-?[\d.]+,\d{2})\s+'
        r'(?:([\d,]+)\s*%\s+[\d,]+\s*%\s+)?'
        r'\$\s*([\d.]+,\d{2})'
    )

    for match in pattern.finditer(search_text):
        raw_desc = match.group(1).strip()
        fecha_raw = match.group(2)
        valor_str = match.group(3)
        cuotas = match.group(4) or ''
        cuota_str = match.group(5)
        interes_str = match.group(6) or ''
        saldo_str = match.group(7)

        # Skip header/noise lines
        if any(kw in raw_desc.upper() for kw in [
            'CATEGORÍA', 'CATEGORIA', 'NÚMERO DE', 'NUMERO DE',
            'AUTORIZACIÓN', 'AUTORIZACION', 'MOVIMIENTOS',
        ]):
            continue

        # Skip payments (ABONO) and interest (INTERESES)
        if raw_desc.upper().startswith('ABONO') or raw_desc.upper().startswith('INTERESES'):
            continue

        # Clean description: remove trailing auth number (6 digits at end)
        desc_clean = re.sub(r'\d{6}$', '', raw_desc).strip()
        if not desc_clean:
            desc_clean = raw_desc

        # Parse Colombian format: 372.651,00 → 372651
        def parse_cop(s: str) -> int:
            try:
                return int(float(s.replace('.', '').replace(',', '.')))
            except ValueError:
                return 0

        valor = abs(parse_cop(valor_str))
        valor_cuota = abs(parse_cop(cuota_str))
        saldo = parse_cop(saldo_str)

        pct_interes = f'{interes_str}%' if interes_str else ''

        transactions.append({
            'FECHA': fecha_raw,
            'DESCRIPCION': desc_clean,
            'VALOR': valor,
            'VALOR_CUOTA': valor_cuota,
            'PCT_INTERES': pct_interes,
            'VALOR_INTERES': 0,
            'CUOTAS': cuotas,
            'SALDO_PENDIENTE': saldo,
            'ENTIDAD': 'Bancolombia',
        })

    return transactions


def _parse_nubank_cuenta(text: str) -> list[dict]:
    """Parsea extracto de cuenta Nu (ahorro/corriente Nubank).

    Formato por línea:
      DD mes DESCRIPCION [+-]$X.XXX,XX
    Siguiente línea optativa:
      Impuesto del 4x1000 -$X,XX   (se omite)
    El año se extrae del encabezado 'Período DD - DD MES YYYY'.
    """
    MONTHS = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
    }

    year = str(datetime.now().year)
    period_m = re.search(r'\d{1,2}\s*-\s*\d{1,2}\s+\w+\s+(\d{4})', text)
    if period_m:
        year = period_m.group(1)

    tx_pattern = re.compile(
        r'^(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+'
        r'(.+?)\s+([+-]?\$[\d.,]+)$',
        re.IGNORECASE,
    )

    SKIP = (
        'impuesto del 4x1000', 'rendimiento total', 'nu financiera',
        'nu colombia', 'los rendimientos', 'bogot', 'nit ',
        'puedes contactar', 'defensor del consumidor', 'correo',
        'por correo', 'por tel', 'ayuda@', '/ 8', '/ 7',
    )

    transactions: list[dict] = []
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        ll = line.lower()
        if any(kw in ll for kw in SKIP):
            continue

        m = tx_pattern.match(line)
        if not m:
            continue

        day = m.group(1).zfill(2)
        month = MONTHS.get(m.group(2).lower(), '01')
        desc = m.group(3).strip()
        amount_raw = m.group(4)

        sign = -1.0 if amount_raw.startswith('-') else 1.0
        clean = re.sub(r'[+\-$\s]', '', amount_raw).replace('.', '').replace(',', '.')
        try:
            valor = abs(float(clean))
        except ValueError:
            continue

        fecha = f"{day}/{month}/{year}"
        tipo = 'EGRESO' if sign < 0 else 'INGRESO'

        transactions.append({
            'FECHA': fecha,
            'DESCRIPCION': desc,
            'VALOR': valor,
            'VALOR_CUOTA': valor,
            'PCT_INTERES': '',
            'VALOR_INTERES': 0.0,
            'CUOTAS': '',
            'TIPO': tipo,
            'ENTIDAD': 'Nubank Cuenta',
        })

    return transactions


def _parse_generic_statement(text: str, entity: str) -> list[dict]:
    """Parseo genérico regex para extractos no soportados."""
    transactions: list[dict] = []

    pattern = re.compile(
        r'(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s+(.+?)\s+\$?([\d.,]+)\s*$',
        re.MULTILINE,
    )
    for match in pattern.finditer(text):
        fecha = match.group(1)
        desc = match.group(2).strip()
        valor_raw = match.group(3).replace('.', '').replace(',', '.')
        try:
            valor = abs(float(valor_raw))
        except ValueError:
            valor = 0
        transactions.append({
            'FECHA': fecha,
            'DESCRIPCION': desc,
            'VALOR': valor,
            'VALOR_CUOTA': valor,
            'CUOTAS': '',
            'ENTIDAD': entity,
        })

    return transactions


@router.post("/extract-statement")
async def extract_statement(
    current_user = Depends(get_current_user),
    file: UploadFile = File(...),
    password: str = Form(""),
    entity: str = Form("nubank"),
    statement_type: str = Form("credito"),
):
    """Parsea un extracto bancario PDF y devuelve transacciones estructuradas."""
    if not _PDF_AVAILABLE:
        raise HTTPException(503, "PyPDF2 no disponible. Instala PyPDF2>=3.0.0")

    try:
        pdf_bytes = await file.read()
        reader = PdfReader(io.BytesIO(pdf_bytes))

        if reader.is_encrypted:
            if not password:
                raise HTTPException(400, "El PDF está encriptado. Proporciona la contraseña.")
            reader.decrypt(password)

        full_text = ""
        for page in reader.pages:
            full_text += (page.extract_text() or "") + "\n"

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error leyendo PDF: {e}")

    entity_lower = entity.lower()
    statement_type_lower = statement_type.lower()
    try:
        if entity_lower == "nubank" and statement_type_lower == "cuenta":
            transactions = _parse_nubank_cuenta(full_text)
        elif entity_lower == "nubank":
            transactions = _parse_nubank_credit(full_text)
        elif entity_lower == "lulobank":
            transactions = _parse_lulobank_credit(full_text)
        elif entity_lower == "bancolombia":
            transactions = _parse_bancolombia_credit(full_text)
        elif entity_lower == "falabella":
            transactions = _parse_falabella_credit(full_text)
        else:
            transactions = _parse_generic_statement(full_text, entity)
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    metadata = _extract_statement_metadata(full_text, entity)

    mov_idx = full_text.find('Movimientos')
    debug_text = full_text[mov_idx:mov_idx + 2000] if mov_idx >= 0 else full_text[:2000]

    return {
        "entity": entity,
        "type": statement_type,
        "count": len(transactions),
        "transactions": transactions,
        "metadata": metadata,
        "raw_pages": len(reader.pages),
        "raw_text_preview": debug_text,
    }


# ── Google Drive - Extractos ─────────────────────────────────────────────────
try:
    from backend.drive import (
        list_pdfs, list_subfolders, download_pdf,
        get_service_account_email, DRIVE_FOLDER_ID,
    )
    _DRIVE_AVAILABLE = True
except ImportError:
    _DRIVE_AVAILABLE = False


@router.get("/drive/status")
def drive_status(current_user=Depends(get_current_user)):
    """Verifica si Drive está configurado y devuelve el email del service account."""
    if not _DRIVE_AVAILABLE:
        return {"available": False, "reason": "google-api-python-client no instalado"}
    email = get_service_account_email()
    folder_id = DRIVE_FOLDER_ID
    return {
        "available": bool(folder_id),
        "service_account_email": email,
        "folder_id": folder_id,
        "reason": "" if folder_id else "Falta DRIVE_EXTRACTOS_FOLDER_ID en .env",
    }


@router.get("/drive/folders")
def drive_folders(folder_id: str | None = None, current_user=Depends(get_current_user)):
    """Lista subcarpetas dentro de la carpeta de extractos."""
    if not _DRIVE_AVAILABLE:
        raise HTTPException(503, "Drive no disponible")
    try:
        folders = list_subfolders(folder_id)
        return {"folders": folders}
    except Exception as e:
        raise HTTPException(500, f"Error listando carpetas: {e}")


@router.get("/drive/files")
def drive_files(folder_id: str | None = None, current_user=Depends(get_current_user)):
    """Lista PDFs en una carpeta de Drive."""
    if not _DRIVE_AVAILABLE:
        raise HTTPException(503, "Drive no disponible")
    try:
        files = list_pdfs(folder_id)
        return {"files": files}
    except Exception as e:
        raise HTTPException(500, f"Error listando archivos: {e}")


@router.post("/drive/parse")
def drive_parse(
    file_id: str = Form(...),
    password: str = Form(""),
    entity: str = Form("nubank"),
    statement_type: str = Form("credito"),
    current_user=Depends(get_current_user),
):
    """Descarga un PDF de Drive y lo parsea como extracto bancario."""
    if not _DRIVE_AVAILABLE:
        raise HTTPException(503, "Drive no disponible")
    if not _PDF_AVAILABLE:
        raise HTTPException(503, "PyPDF2 no disponible")

    try:
        pdf_bytes = download_pdf(file_id)
    except Exception as e:
        raise HTTPException(500, f"Error descargando de Drive: {e}")

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        if reader.is_encrypted:
            if not password:
                raise HTTPException(400, "El PDF está encriptado. Proporciona la contraseña.")
            reader.decrypt(password)

        full_text = ""
        for page in reader.pages:
            full_text += (page.extract_text() or "") + "\n"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error leyendo PDF: {e}")

    entity_lower = entity.lower()
    statement_type_lower = statement_type.lower()
    try:
        if entity_lower == "nubank" and statement_type_lower == "cuenta":
            transactions = _parse_nubank_cuenta(full_text)
        elif entity_lower == "nubank":
            transactions = _parse_nubank_credit(full_text)
        elif entity_lower == "lulobank":
            transactions = _parse_lulobank_credit(full_text)
        elif entity_lower == "bancolombia":
            transactions = _parse_bancolombia_credit(full_text)
        elif entity_lower == "falabella":
            transactions = _parse_falabella_credit(full_text)
        else:
            transactions = _parse_generic_statement(full_text, entity)
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    metadata = _extract_statement_metadata(full_text, entity)

    return {
        "entity": entity,
        "type": statement_type,
        "count": len(transactions),
        "transactions": transactions,
        "metadata": metadata,
        "raw_pages": len(reader.pages),
        "raw_text_preview": (full_text[full_text.find('Movimientos'):full_text.find('Movimientos') + 2000]
                             if full_text.find('Movimientos') >= 0 else full_text[:2000]),
    }


# ── Extracto imports tracking ─────────────────────────────────────────────
@router.post("/extracto-imports")
def save_extracto_import(
    entity: str = Form(...),
    statement_type: str = Form("credito"),
    period: str = Form(...),
    file_name: str = Form(...),
    drive_file_id: str = Form(""),
    transactions: int = Form(0),
    total_amount: float = Form(0),
    current_user=Depends(get_current_user),
):
    """Registra un extracto importado."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO extracto_imports
               (entity, statement_type, period, file_name, drive_file_id, transactions, total_amount, user_email)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id""",
            (entity, statement_type, period, file_name, drive_file_id or None,
             transactions, total_amount,
             getattr(current_user, 'email', None)),
        )
        row = cur.fetchone()
    return {"status": "saved", "id": row["id"] if row else None}


@router.get("/extracto-imports")
def list_extracto_imports(entity: str | None = None, current_user=Depends(get_current_user)):
    """Lista extractos importados, opcionalmente filtrados por entidad."""
    with get_conn() as conn:
        cur = conn.cursor()
        if entity:
            cur.execute(
                """SELECT * FROM extracto_imports WHERE entity = %s ORDER BY created_at DESC LIMIT 200""",
                (entity,),
            )
        else:
            cur.execute(
                """SELECT * FROM extracto_imports ORDER BY created_at DESC LIMIT 200"""
            )
        rows = cur.fetchall()
    return {"imports": [dict(r) for r in rows]}


@router.get("/extracto-imports/drive-ids")
def list_imported_drive_ids(current_user=Depends(get_current_user)):
    """Devuelve los drive_file_id ya importados para marcarlos en la UI."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT drive_file_id FROM extracto_imports WHERE drive_file_id IS NOT NULL"""
        )
        rows = cur.fetchall()
    return {"imported_ids": [r["drive_file_id"] for r in rows]}
