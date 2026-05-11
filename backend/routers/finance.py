# -*- coding: utf-8 -*-
"""Rutas financieras — lectura de Sheets + Finance Writer Agent (OpenRouter)."""
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
from backend.sheets import read_tab, append_row, update_row, delete_row, COLUMNS
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
- credito:    {COLUMNS['credito']}

Reglas de clasificación:
- mercado, supermercado, productos del hogar, aseo → basket
- compra general, tienda, gasto puntual → shops
- Netflix, arriendo, servicios fijos, suscripciones → essentials
- ahorro, consignación, retiro, inversión → ahorro
- deuda, préstamo, me deben, le debo → debts
- quiero comprar, presupuestar, wishlist → wishlist
- tarjeta de crédito, cuotas, Visa, Mastercard → credito

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
@router.get("/summary")
def get_summary(current_user = Depends(get_current_user)):
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
    """Devuelve métricas detalladas por pestaña para paneles de análisis."""
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
        if tab:
            rows = conn.execute(
                """SELECT id, action, tab, row_index, data, reason, user_email, created_at
                   FROM finance_history WHERE tab = ? ORDER BY id DESC LIMIT ?""",
                (tab, limit)
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, action, tab, row_index, data, reason, user_email, created_at
                   FROM finance_history ORDER BY id DESC LIMIT ?""",
                (limit,)
            ).fetchall()
    return {
        "count": len(rows),
        "history": [dict(r) for r in rows]
    }


# ── Finance Agent — system prompt ───────────────────────────────────────────
FINANCE_AGENT_PROMPT = f"""Eres FINANCE, el agente de gestión financiera personal de FJ. Tienes acceso directo a sus registros financieros en Google Sheets.

Tu personalidad: profesional, eficiente, directo. Hablas en español. Usas emojis ocasionalmente para hacer la conversación amigable.

PESTAÑAS DISPONIBLES Y SUS COLUMNAS:
- essentials: {COLUMNS['essentials']} — Pagos fijos mensuales (Netflix, arriendo, servicios)
- ahorro:     {COLUMNS['ahorro']} — Ahorros e inversiones
- basket:     {COLUMNS['basket']} — Canasta básica y mercado
- shops:      {COLUMNS['shops']} — Compras generales
- wishlist:   {COLUMNS['wishlist']} — Lista de deseos
- debts:      {COLUMNS['debts']}
- credito:    {COLUMNS['credito']} — Deudas y préstamos

REGLAS DE CLASIFICACIÓN:
- mercado, supermercado, productos del hogar, aseo → basket
- compra general, tienda, gasto puntual → shops
- Netflix, arriendo, servicios fijos, suscripciones → essentials
- ahorro, consignación, retiro, inversión → ahorro
- deuda, préstamo, me deben, le debo → debts
- quiero comprar, presupuestar, wishlist → wishlist
- tarjeta de crédito, cuotas, Visa, Mastercard → credito

FORMATO DE RESPUESTA:
Responde SIEMPRE en JSON con este formato exacto:
{{
  "text": "<respuesta conversacional amigable>",
  "action": {{"type": "<none|create|update|delete|switch_tab>", "tab": "<tab>", "data": {{...}}, "row_index": <n>, "confirmation": "<descripción de la acción>"}},
  "needs_confirmation": <true|false>
}}

REGLAS DE ACCIONES:
1. `type: "none"` — Solo conversación, no ejecutes ninguna acción.
2. `type: "create"` — Cuando el usuario quiere registrar un nuevo gasto/ingreso. Extrae los datos del mensaje y ponlos en `data`.
3. `type: "update"` — Cuando el usuario quiere editar un registro existente. Pide el índice o identifica por descripción. `row_index` es 0-based.
4. `type: "delete"` — Cuando el usuario quiere eliminar un registro. Pide confirmación antes de devolver esta acción.
5. `type: "switch_tab"` — Cuando el usuario quiere ver otra pestaña.

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
→ {{"text": "Registrando tu compra en Zara por $50,000 COP 👕", "action": {{"type": "create", "tab": "shops", "data": {{"PRODUCT": "Ropa", "DESCRIPTION": "Compra en Zara", "CATEGORY": "Ropa", "STORE": "Zara", "COIN": "COP", "VALUE": 50000, "DATE": "{{today}}"}}, "confirmation": "Compra en Zara por $50,000 COP"}}, "needs_confirmation": false}}

Usuario: "muéstrame mis deudas"
→ {{"text": "Aquí están tus deudas pendientes 📋", "action": {{"type": "switch_tab", "tab": "debts"}}, "needs_confirmation": false}}

Usuario: "borra el último registro"
→ {{"text": "¿Estás seguro de que quieres eliminar el último registro de {{current_tab}}? Esta acción no se puede deshacer.", "action": {{"type": "none"}}, "needs_confirmation": true}}
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
