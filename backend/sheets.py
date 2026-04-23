# -*- coding: utf-8 -*-
"""Módulo de conexión a Google Sheets — fuente de verdad financiera."""
from __future__ import annotations
from pathlib import Path
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

# Columnas por pestaña (orden exacto del Sheet)
COLUMNS = {
    "essentials": ["PRODUCTO", "DESCRIPCIÓN", "MONEDA", "VALOR", "MEDIO PAGO", "MODO"],
    "ahorro":     ["NOMBRE", "MEDIO PAGO", "FECHA", "VALOR"],
    "basket":     ["PRODUCTO", "DESCRIPCIÓN", "CATEGORÍA", "MONEDA", "VALOR", "CANTIDAD"],
    "shops":      ["PRODUCTO", "DESCRIPCIÓN", "CATEGORÍA", "MEDIO PAGO", "TIENDA", "VALOR", "FECHA"],
    "wishlist":   ["PRODUCTO", "DESCRIPCIÓN", "MONEDA", "VALOR", "TIENDA", "MEDIO", "SOURCE"],
    "debts":      ["PRODUCTO", "DESCRIPCIÓN", "MONEDA", "VALOR", "RESPONSABLE", "ESTADO", "FECHA"],
}


def _client() -> gspread.Client:
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
    """Actualiza una fila existente (1-based index, fila 1 = headers)."""
    ws = get_sheet(tab)
    cols = COLUMNS[tab]
    row_values = [data.get(col, "") for col in cols]
    ws.update(f"A{row_index + 1}", [row_values], value_input_option="USER_ENTERED")
    return True


def delete_row(tab: str, row_index: int) -> bool:
    """Elimina una fila (1-based index, fila 1 = headers)."""
    ws = get_sheet(tab)
    ws.delete_rows(row_index + 1)
    return True
