# -*- coding: utf-8 -*-
"""
backend/routers/rappi.py

1. Búsqueda de precios via API móvil interna de Rappi.
2. CRUD de productos registrados y scans (persistidos en Supabase).
"""
from __future__ import annotations

import logging
from typing import Any, Optional, List
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.supabase_client import get_supabase

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
    sb = get_supabase()
    try:
        prods = sb.table("rappi_products").select("*").order("created_at").execute().data or []
        scans = sb.table("rappi_scans").select("*").order("date").execute().data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error Supabase: {e}")

    # Agrupar scans por product_id
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
    sb = get_supabase()
    try:
        sb.table("rappi_products").insert({
            "id":           body.id,
            "name":         body.name,
            "brand":        body.brand,
            "size":         body.size,
            "search_names": body.searchNames,
            "keywords":     body.keywords,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando producto: {e}")
    return {"ok": True, "id": body.id}


@router.put("/registers/{product_id}")
async def update_register(product_id: str, body: RegisteredProductIn):
    """Actualiza un producto registrado."""
    sb = get_supabase()
    try:
        sb.table("rappi_products").update({
            "name":         body.name,
            "brand":        body.brand,
            "size":         body.size,
            "search_names": body.searchNames,
            "keywords":     body.keywords,
            "updated_at":   datetime.utcnow().isoformat(),
        }).eq("id", product_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error actualizando producto: {e}")
    return {"ok": True}


@router.delete("/registers/{product_id}")
async def delete_register(product_id: str):
    """Elimina un producto registrado y sus scans."""
    sb = get_supabase()
    try:
        sb.table("rappi_products").delete().eq("id", product_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando producto: {e}")
    return {"ok": True}


@router.post("/registers/{product_id}/scans", status_code=201)
async def add_scan(product_id: str, body: ScanEntryIn):
    """Agrega una entrada de scan al historial de un producto."""
    sb = get_supabase()
    try:
        sb.table("rappi_scans").insert({
            "product_id":            product_id,
            "date":                  body.date,
            "scanned_products":      body.scannedProducts,
            "scanned_stores":        body.scannedStores,
            "min_price":             body.minPrice,
            "min_price_store":       body.minPriceStore,
            "min_price_store_count": body.minPriceStoreCount,
            "max_price":             body.maxPrice,
            "max_price_store":       body.maxPriceStore,
            "max_price_store_count": body.maxPriceStoreCount,
            "promo_detected":        body.promoDetected,
        }).execute()
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
            name  = p.get("name", "")
            price = p.get("real_price") or p.get("price")
            if not name or price is None:
                continue
            if not matches(name):
                continue

            dedup_key = f"{p.get('master_product_id') or name}_{store_id or store_name}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            product_id = p.get("id") or p.get("master_product_id")

            results.append({
                "id":            product_id,
                "name":          name,
                "price":         float(price),
                "originalPrice": float(p.get("balance_price") or price),
                "hasDiscount":   float(p.get("balance_price") or price) < float(price),
                "pum":           p.get("pum"),
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
