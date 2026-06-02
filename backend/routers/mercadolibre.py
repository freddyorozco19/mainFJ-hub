# -*- coding: utf-8 -*-
"""
backend/routers/mercadolibre.py

Búsqueda de productos en Mercado Libre Colombia (MCO) via API pública oficial.
No requiere autenticación para búsquedas básicas.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mercadolibre", tags=["mercadolibre"])

ML_SEARCH_URL = "https://api.mercadolibre.com/sites/MCO/search"

HEADERS = {
    "Accept":     "application/json",
    "User-Agent": "FJHub/1.0",
}

# Atributos de ML que pueden contener el tamaño/contenido del producto
_SIZE_ATTRS = ["NET_CONTENT", "WEIGHT", "VOLUME", "PACKAGE_CONTENT", "PACKAGE_QUANTITY"]


def _get_presentation(attributes: list) -> Optional[str]:
    """Extrae tamaño/peso del producto desde los atributos de ML."""
    attr_map = {
        a["id"]: a.get("value_name")
        for a in attributes
        if isinstance(a, dict) and a.get("value_name")
    }
    for key in _SIZE_ATTRS:
        if key in attr_map:
            return attr_map[key]
    return None


@router.get("/search")
async def ml_search(
    query: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=50),
):
    params = {"q": query, "limit": limit}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(ML_SEARCH_URL, params=params, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"ML API error: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error conectando con Mercado Libre: {e}")

    items = data.get("results", [])
    products = []

    for item in items:
        raw_price    = item.get("price") or 0
        raw_original = item.get("original_price")

        price_f    = float(raw_price)
        original_f = float(raw_original) if raw_original else price_f
        actual     = min(price_f, original_f)
        original   = max(price_f, original_f)

        attributes   = item.get("attributes") or []
        presentation = _get_presentation(attributes)
        seller       = item.get("seller") or {}

        products.append({
            "id":            item.get("id"),
            "name":          item.get("title", ""),
            "price":         actual,
            "originalPrice": original,
            "hasDiscount":   actual < original,
            "pum":           None,
            "presentation":  presentation,
            "unitType":      None,
            "inStock":       (item.get("available_quantity") or 0) > 0,
            "store":         seller.get("nickname"),
            "storeId":       str(seller.get("id", "")),
            "storeType":     "mercadolibre",
            "image":         item.get("thumbnail"),
            "rappiUrl":      item.get("permalink"),   # enlace directo al producto
        })

    products.sort(key=lambda x: x["price"])

    return {
        "query":    query,
        "count":    len(products),
        "total":    (data.get("paging") or {}).get("total", len(products)),
        "products": products,
        "stores":   list({p["store"] for p in products if p["store"]}),
        "minPrice": products[0]["price"]  if products else None,
        "maxPrice": products[-1]["price"] if products else None,
        "debug":    {"source": "mercadolibre"},
    }
