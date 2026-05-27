# -*- coding: utf-8 -*-
"""
backend/routers/rappi.py

Busca precios en Rappi Colombia usando la API móvil interna descubierta
via ingeniería inversa del APK de Rappi.

Endpoint: POST https://services.grability.rappi.com/api/pns-global-search-api/v1/unified-search
- Retorna todas las tiendas disponibles (Éxito, Carulla, Jumbo, Olímpica, Makro, Metro, etc.)
- No requiere autenticación
- Acepta lat/lng para geolocalización
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

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


# ─── Normalizar productos desde respuesta móvil ────────────────────────────────

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


# ─── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/search")
async def rappi_search(
    query: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    lat:   float = Query(DEFAULT_LAT),
    lng:   float = Query(DEFAULT_LNG),
):
    payload = {
        "query": query,
        "lat":   lat,
        "lng":   lng,
        "limit": 100,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                RAPPI_MOBILE_API,
                json=payload,
                headers=HEADERS,
            )
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

    logger.info(
        "Query '%s': %d productos en %d tiendas",
        query, len(products), len(stores_raw),
    )

    return {
        "query":    query,
        "count":    len(products[:limit]),
        "total":    len(products),
        "products": products[:limit],
        "stores":   list({p["store"] for p in products if p["store"]}),
        "minPrice": products[0]["price"]  if products else None,
        "maxPrice": products[-1]["price"] if products else None,
        "debug": {
            "stores_with_results": len(stores_raw),
            "source": "mobile_api",
        },
    }
