# -*- coding: utf-8 -*-
"""Módulo de conexión a Google Sheets — fuente de verdad financiera."""
from __future__ import annotations
from pathlib import Path
import os
import json
import tempfile
import gspread
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
}

# Columnas por pestaña (orden EXACTO del Google Sheet)
COLUMNS = {
    "essentials": ["PRODUCTO", "DESCRIPCIÓN", "MONEDA", "VALOR", "MEDIO PAGO", "MODO"],
    "ahorro":     ["NOMBRE", "MEDIO", "MES", "VALOR"],
    "basket":     ["PRODUCTO", "DESCRIPCIÓN", "CATEGORIA", "MONEDA", "VALOR", "CANTIDAD"],
    "shops":      ["PRODUCTO", "DESCRIPCIÓN", "CATEGORIA", "TIENDA", "TIENDA2", "VALOR", "MEDIO PAGO", "FECHA"],
    "wishlist":   ["PRODUCTO", "DESCRIPCIÓN", "MONEDA", "VALOR", "TIENDA", "MEDIO", "SOURCE"],
    "debts":      ["PRODUCTO", "DESCRIPCIÓN", "MONEDA", "VALOR", "PAGO", "ESTADO", "FECHA"],
}


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


def get_sheet(tab: str) -> gspread.Worksheet:
    gc = _client()
    sh = gc.open_by_key(SHEET_ID)
    return sh.worksheet(TABS[tab])


def read_tab(tab: str) -> list[dict]:
    """Devuelve todos los registros de una pestaña como lista de dicts."""
    ws = get_sheet(tab)
    return ws.get_all_records()


def append_row(tab: str, data: dict) -> bool:
    """Inserta una fila al final de la pestaña. data debe tener las claves del COLUMNS[tab]."""
    ws  = get_sheet(tab)
    row = [data.get(col, "") for col in COLUMNS[tab]]
    ws.append_row(row, value_input_option="USER_ENTERED")
    return True


def update_row(tab: str, row_index: int, data: dict) -> bool:
    """Actualiza una fila existente. row_index es 0-based del array de datos (fila 2 del Sheet = índice 0)."""
    ws = get_sheet(tab)
    cols = COLUMNS[tab]
    row_values = [data.get(col, "") for col in cols]
    # +2 porque get_all_records() omite la fila 1 (headers); índice 0 → fila 2
    ws.update(f"A{row_index + 2}", [row_values], value_input_option="USER_ENTERED")
    return True


def delete_row(tab: str, row_index: int) -> bool:
    """Elimina una fila. row_index es 0-based del array de datos."""
    ws = get_sheet(tab)
    # +2 porque get_all_records() omite la fila 1 (headers); índice 0 → fila 2
    ws.delete_rows(row_index + 2)
    return True
