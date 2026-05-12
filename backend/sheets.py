# -*- coding: utf-8 -*-
"""Módulo de conexión a Google Sheets - fuente de verdad financiera."""
from __future__ import annotations
from pathlib import Path
import os
import json
import time
import gspread
import unicodedata
from google.oauth2.service_account import Credentials

SHEET_ID     = "1lVFrvgoT2N2Wdx-Vz-9qSTYQ0tM6r4JKdgAbtxU5870"
CREDS_PATH   = Path(__file__).parent / "credentials.json"
SCOPES       = ["https://www.googleapis.com/auth/spreadsheets"]

# Mapa de nombres de pestañas
TABS = {
    "essentials": "Essentials",
    "ahorro":     "Ahorro",
    "basket":     "Basket",
    "shops":      "Shops",
    "wishlist":   "Wish List",
    "debts":      "Debts",
    "credito":    "Crédito",
}

# Columnas por pestaña (orden EXACTO del Google Sheet)
COLUMNS = {
    "essentials": ["PRODUCTO", "DESCRIPCION", "MONEDA", "VALOR", "MEDIO PAGO", "MODO"],
    "ahorro":     ["NOMBRE", "MEDIO", "MES", "VALOR"],
    "basket":     ["PRODUCTO", "DESCRIPCION", "CATEGORIA", "MONEDA", "VALOR", "CANTIDAD"],
    "shops":      ["PRODUCT", "DESCRIPTION", "BRAND", "CATEGORY", "STORE", "STORE2", "COIN", "VALUE", "PAYMENT", "ACCOUNT", "DATE"],
    "wishlist":   ["PRODUCTO", "DESCRIPCION", "MONEDA", "VALOR", "TIENDA", "MEDIO", "SOURCE"],
    "debts":      ["PRODUCTO", "DESCRIPCION", "MONEDA", "VALOR", "PAGO", "ESTADO", "FECHA"],
    "credito":    ["PRODUCTO", "DESCRIPCION", "ENTIDAD", "MONEDA", "VALOR_TOTAL", "CUOTAS", "CUOTA_ACTUAL", "VALOR_CUOTA", "FECHA_CORTE", "FECHA_PAGO", "ESTADO", "TIPO"],
}

# ── Simple in-memory cache with TTL ─────────────────────────────────────────
_CACHE: dict[str, dict] = {}
_CACHE_TTL = 120  # segundos


def _client() -> gspread.Client:
    """Crea cliente de Google Sheets desde archivo o variable de entorno."""
    # Intentar desde variable de entorno primero (para producción en Render)
    creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    if creds_json:
        creds_info = json.loads(creds_json)
        creds = Credentials.from_service_account_info(creds_info, scopes=SCOPES)
        return gspread.authorize(creds)
    
    # Fallback a archivo local (para desarrollo)
    creds = Credentials.from_service_account_file(str(CREDS_PATH), scopes=SCOPES)
    return gspread.authorize(creds)


def _normalize_key(key: str) -> str:
    """Normaliza un nombre de columna: NFC + elimina tildes para compatibilidad."""
    # Normaliza a NFC primero
    normalized = unicodedata.normalize('NFC', key)
    # Reemplaza caracteres acentuados comunes por sus versiones sin tilde
    replacements = {
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Ñ': 'N', 'ñ': 'n',
    }
    for old, new in replacements.items():
        normalized = normalized.replace(old, new)
    return normalized


def _col_letter(n: int) -> str:
    """Convierte número de columna 1-based a letra (1->A, 27->AA)."""
    result = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


def _ensure_columns(ws: gspread.Worksheet, tab: str) -> None:
    """Verifica que los headers de la hoja coincidan con COLUMNS[tab].
    Agrega las columnas faltantes al final sin modificar datos existentes."""
    expected = COLUMNS[tab]
    try:
        current_headers = ws.row_values(1)
    except Exception:
        current_headers = []
    missing = [h for h in expected if h not in current_headers]
    if missing:
        start_col = len(current_headers) + 1  # 1-based
        end_col = len(current_headers) + len(missing)
        start_letter = _col_letter(start_col)
        end_letter = _col_letter(end_col)
        ws.update(f"{start_letter}1:{end_letter}1", [missing], value_input_option="USER_ENTERED")
        invalidate_cache(tab)


def get_sheet(tab: str) -> gspread.Worksheet:
    gc = _client()
    sh = gc.open_by_key(SHEET_ID)
    sheet_name = TABS[tab]
    try:
        ws = sh.worksheet(sheet_name)
        _ensure_columns(ws, tab)
        return ws
    except:
        headers = COLUMNS[tab]
        ws = sh.add_worksheet(title=sheet_name, rows=1000, cols=len(headers))
        ws.append_row(headers, value_input_option="USER_ENTERED")
        return ws


def read_tab(tab: str, use_cache: bool = True) -> list[dict]:
    """Devuelve todos los registros de una pestaña como lista de dicts con keys normalizadas.
    
    Usa cache en memoria por 45 segundos para evitar quota de Google Sheets.
    """
    now = time.time()
    
    # Check cache
    if use_cache and tab in _CACHE:
        cached = _CACHE[tab]
        if now - cached['timestamp'] < _CACHE_TTL:
            return cached['data']
    
    # Fetch from Google Sheets
    ws = get_sheet(tab)
    records = ws.get_all_records()
    
    # Normaliza las claves para evitar problemas de encoding con tildes
    normalized = []
    for row in records:
        new_row = {}
        for key, value in row.items():
            new_row[_normalize_key(key)] = value
        normalized.append(new_row)
    
    # Store in cache
    _CACHE[tab] = {
        'data': normalized,
        'timestamp': now,
    }
    
    return normalized



def append_rows_batch(tab: str, rows: list[dict]) -> int:
    """Inserta múltiples filas de una vez (una sola API call)."""
    if not rows:
        return 0
    ws  = get_sheet(tab)
    values = [[row.get(col, "") for col in COLUMNS[tab]] for row in rows]
    ws.append_rows(values, value_input_option="USER_ENTERED")
    invalidate_cache(tab)
    return len(rows)

def invalidate_cache(tab: str | None = None) -> None:
    """Invalida el cache de una pestaña (o todas si tab es None)."""
    global _CACHE
    if tab is None:
        _CACHE.clear()
    elif tab in _CACHE:
        del _CACHE[tab]


def append_row(tab: str, data: dict) -> bool:
    """Inserta una fila al final de la pestaña. data debe tener las claves del COLUMNS[tab]."""
    ws  = get_sheet(tab)
    row = [data.get(col, "") for col in COLUMNS[tab]]
    ws.append_row(row, value_input_option="USER_ENTERED")
    invalidate_cache(tab)
    return True


def update_row(tab: str, row_index: int, data: dict) -> bool:
    """Actualiza una fila existente. row_index es 0-based del array de datos (fila 2 del Sheet = índice 0)."""
    ws = get_sheet(tab)
    cols = COLUMNS[tab]
    row_values = [data.get(col, "") for col in cols]
    # +2 porque get_all_records() omite la fila 1 (headers); índice 0 -> fila 2
    ws.update(f"A{row_index + 2}", [row_values], value_input_option="USER_ENTERED")
    invalidate_cache(tab)
    return True


def delete_row(tab: str, row_index: int) -> bool:
    """Elimina una fila. row_index es 0-based del array de datos."""
    ws = get_sheet(tab)
    # +2 porque get_all_records() omite la fila 1 (headers); índice 0 -> fila 2
    ws.delete_rows(row_index + 2)
    invalidate_cache(tab)
    return True
