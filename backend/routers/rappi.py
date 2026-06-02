# -*- coding: utf-8 -*-
"""
backend/routers/rappi.py

1. Búsqueda de precios via API móvil interna de Rappi.
2. CRUD de productos registrados y scans (persistidos en PostgreSQL via get_conn).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional, List
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.db import get_conn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rappi", tags=["rappi"])

RAPPI_MOBILE_API = "https://services.grability.rappi.com/api/pns-global-search-api/v1/unified-search"

DEFAULT_LAT = 4.6850868
DEFAULT_LNG = -74.0703650

HEADERS = {
    "User-Agent":     "Rappi/8.30 (Android; 30; x86_64)",
    "Accept":         "application/json",
    "Content-Type":   "application/json",
    "x-country-code": "co",
}


# ─── Modelos Pydantic ──────────────────────────────────────────────────────────

class RegisteredProductIn(BaseModel):
    id:          str
    name:        str
    brand:       Optional[str] = None
    size:        Optional[str] = None
    searchNames: List[str]     = []
    keywords:    List[str]     = []

class ScanEntryIn(BaseModel):
    date:                str
    scannedProducts:     int   = 0
    scannedStores:       int   = 0
    minPrice:            Optional[float] = None
    minPriceStore:       Optional[str]   = None
    minPriceStoreCount:  int   = 0
    maxPrice:            Optional[float] = None
    maxPriceStore:       Optional[str]   = None
    maxPriceStoreCount:  int   = 0
    promoDetected:       bool  = False


# ─── Helpers de normalización ──────────────────────────────────────────────────

def _row_to_product(row: dict) -> dict:
    return {
        "id":          row["id"],
        "name":        row["name"],
        "brand":       row.get("brand"),
        "size":        row.get("size"),
        "searchNames": row.get("search_names") or [],
        "keywords":    row.get("keywords") or [],
        "scanHistory": [],
    }

def _scan_row_to_entry(row: dict) -> dict:
    return {
        "date":                row["date"],
        "scannedProducts":     row.get("scanned_products", 0),
        "scannedStores":       row.get("scanned_stores", 0),
        "minPrice":            row.get("min_price"),
        "minPriceStore":       row.get("min_price_store"),
        "minPriceStoreCount":  row.get("min_price_store_count", 0),
        "maxPrice":            row.get("max_price"),
        "maxPriceStore":       row.get("max_price_store"),
        "maxPriceStoreCount":  row.get("max_price_store_count", 0),
        "promoDetected":       row.get("promo_detected", False),
    }


# ─── CRUD Registers ───────────────────────────────────────────────────────────

@router.get("/registers")
async def get_registers():
    """Retorna todos los productos registrados con su historial de scans."""
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM rappi_products ORDER BY created_at")
            prods = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT * FROM rappi_scans ORDER BY date")
            scans = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error DB: {e}")

    scans_by_product: dict[str, list] = {}
    for s in scans:
        pid = s["product_id"]
        scans_by_product.setdefault(pid, []).append(_scan_row_to_entry(s))

    result = []
    for p in prods:
        prod = _row_to_product(p)
        prod["scanHistory"] = scans_by_product.get(p["id"], [])
        result.append(prod)

    return result


@router.post("/registers", status_code=201)
async def create_register(body: RegisteredProductIn):
    """Crea un producto registrado."""
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO rappi_products (id, name, brand, size, search_names, keywords)
                   VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb)""",
                (
                    body.id,
                    body.name,
                    body.brand,
                    body.size,
                    json.dumps(body.searchNames),
                    json.dumps(body.keywords),
                ),
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando producto: {e}")
    return {"ok": True, "id": body.id}


@router.put("/registers/{product_id}")
async def update_register(product_id: str, body: RegisteredProductIn):
    """Actualiza un producto registrado."""
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """UPDATE rappi_products
                   SET name=%s, brand=%s, size=%s,
                       search_names=%s::jsonb, keywords=%s::jsonb,
                       updated_at=NOW()::TEXT
                   WHERE id=%s""",
                (
                    body.name,
                    body.brand,
                    body.size,
                    json.dumps(body.searchNames),
                    json.dumps(body.keywords),
                    product_id,
                ),
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error actualizando producto: {e}")
    return {"ok": True}


@router.delete("/registers/{product_id}")
async def delete_register(product_id: str):
    """Elimina un producto registrado y sus scans."""
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM rappi_products WHERE id=%s", (product_id,))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando producto: {e}")
    return {"ok": True}


@router.post("/registers/{product_id}/scans", status_code=201)
async def add_scan(product_id: str, body: ScanEntryIn):
    """Agrega una entrada de scan al historial de un producto."""
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO rappi_scans
                   (product_id, date, scanned_products, scanned_stores,
                    min_price, min_price_store, min_price_store_count,
                    max_price, max_price_store, max_price_store_count,
                    promo_detected)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    product_id,
                    body.date,
                    body.scannedProducts,
                    body.scannedStores,
                    body.minPrice,
                    body.minPriceStore,
                    body.minPriceStoreCount,
                    body.maxPrice,
                    body.maxPriceStore,
                    body.maxPriceStoreCount,
                    body.promoDetected,
                ),
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando scan: {e}")
    return {"ok": True}


# ─── Búsqueda Rappi (API móvil) ───────────────────────────────────────────────

def _products_from_stores(stores: list[dict], keyword: str, seen: set[str]) -> list[dict]:
    kw_parts = [w for w in keyword.lower().split() if len(w) > 2]

    def matches(name: str) -> bool:
        n = name.lower()
        return all(w in n for w in kw_parts)

    results: list[dict] = []

    for store in stores:
        store_name = store.get("store_name") or store.get("storeName")
        store_id   = store.get("store_id")   or store.get("storeId")
        store_type = store.get("store_type")  or store.get("storeType")

        for p in store.get("products", []):
            if not isinstance(p, dict):
                continue
            name      = p.get("name", "")
            real_price = p.get("real_price") or p.get("price")
            if not name or real_price is None:
                continue
            if not matches(name):
                continue

            dedup_key = f"{p.get('master_product_id') or name}_{store_id or store_name}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            product_id = p.get("id") or p.get("master_product_id")

            real_price_f    = float(real_price)
            balance_price_f = float(p.get("balance_price") or real_price)
            # balance_price = precio con descuento (lo que pagas)
            # real_price    = precio de lista (va tachado si hay descuento)
            actual_price   = min(real_price_f, balance_price_f)
            original_price = max(real_price_f, balance_price_f)

            results.append({
                "id":            product_id,
                "name":          name,
                "price":         actual_price,
                "originalPrice": original_price,
                "hasDiscount":   actual_price < original_price,
                "pum":           p.get("pum"),
                "presentation":  p.get("presentation"),
                "unitType":      p.get("sale_type"),
                "inStock":       not p.get("is_discontinued", False),
                "store":         store_name,
                "storeId":       store_id,
                "storeType":     store_type,
                "image":         p.get("image"),
                "rappiUrl":      None,
            })

    return results


@router.get("/search")
async def rappi_search(
    query: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    lat:   float = Query(DEFAULT_LAT),
    lng:   float = Query(DEFAULT_LNG),
):
    payload = {"query": query, "lat": lat, "lng": lng, "limit": 100}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(RAPPI_MOBILE_API, json=payload, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Rappi API error: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error conectando con Rappi: {e}")

    stores_raw = data.get("stores", [])
    seen: set[str] = set()
    products = _products_from_stores(stores_raw, query, seen)
    products.sort(key=lambda x: x["price"])

    return {
        "query":    query,
        "count":    len(products[:limit]),
        "total":    len(products),
        "products": products[:limit],
        "stores":   list({p["store"] for p in products if p["store"]}),
        "minPrice": products[0]["price"]  if products else None,
        "maxPrice": products[-1]["price"] if products else None,
        "debug":    {"stores_with_results": len(stores_raw), "source": "mobile_api"},
    }
