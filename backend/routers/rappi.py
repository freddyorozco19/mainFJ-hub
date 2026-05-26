# -*- coding: utf-8 -*-
"""
backend/routers/rappi.py
Busca precios de productos en Rappi Colombia extrayendo __NEXT_DATA__ del SSR de Next.js.
No requiere Playwright ni navegador — solo httpx.
"""
from __future__ import annotations
import json
import re
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/rappi", tags=["rappi"])

RAPPI_SEARCH_URL = "https://www.rappi.com.co/search?query={query}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-CO,es;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

# ─── Extraer __NEXT_DATA__ del HTML ──────────────────────────────────────────

def extract_next_data(html: str) -> dict | None:
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html, re.DOTALL
    )
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


# ─── Extraer productos del __NEXT_DATA__ ─────────────────────────────────────

def extract_products(next_data: dict, keyword: str) -> list[dict]:
    fallback = next_data.get("props", {}).get("pageProps", {}).get("fallback", {})
    if not fallback:
        return []

    kw_parts = [w for w in keyword.lower().split() if len(w) > 2]

    def matches(name: str) -> bool:
        n = name.lower()
        return all(w in n for w in kw_parts)

    results = []
    seen = set()

    for entry in fallback.values():
        for store in entry.get("stores", []):
            store_name = store.get("storeName") or store.get("store_name") or store.get("name")
            store_id   = store.get("storeId")
            store_type = store.get("storeType")
            store_path = store.get("url") or ""  # ej: "/tiendas/turbo/900103835/turbo"

            for p in store.get("products", []):
                name  = p.get("name", "")
                price = p.get("price")
                if not name or price is None:
                    continue
                if not matches(name):
                    continue

                key = f"{p.get('masterProductId')}_{store_id}"
                if key in seen:
                    continue
                seen.add(key)

                # URL directa al producto en la tienda de Rappi
                product_id = p.get("productId") or p.get("masterProductId")
                if store_path and product_id:
                    rappi_url = f"https://www.rappi.com.co{store_path}?product_id={product_id}"
                elif store_path:
                    rappi_url = f"https://www.rappi.com.co{store_path}"
                else:
                    rappi_url = None

                results.append({
                    "id":            p.get("masterProductId") or p.get("productId"),
                    "name":          name,
                    "price":         float(price),
                    "originalPrice": float(p.get("realPrice") or price),
                    "hasDiscount":   bool(p.get("hasDiscount")),
                    "pum":           p.get("pum"),
                    "unitType":      p.get("unitType"),
                    "inStock":       p.get("inStock", True),
                    "store":         store_name,
                    "storeId":       store_id,
                    "storeType":     store_type,
                    "image":         p.get("image"),
                    "rappiUrl":      rappi_url,
                })

    return sorted(results, key=lambda x: x["price"])


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/search")
async def rappi_search(
    query: str = Query(..., min_length=2, description="Término de búsqueda"),
    limit: int = Query(20, ge=1, le=100, description="Máximo de resultados"),
):
    """
    Busca productos en Rappi Colombia y retorna precios por tienda.
    No requiere autenticación — los datos son públicos.
    """
    url = RAPPI_SEARCH_URL.format(query=query)

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=HEADERS)
            resp.raise_for_status()
            html = resp.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Rappi tardó demasiado en responder")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Error de Rappi: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al conectar con Rappi: {str(e)}")

    next_data = extract_next_data(html)
    if not next_data:
        raise HTTPException(
            status_code=422,
            detail="No se pudo extraer datos de Rappi. Puede que requiera ubicación o cambió su estructura."
        )

    products = extract_products(next_data, query)

    return {
        "query":    query,
        "count":    len(products[:limit]),
        "total":    len(products),
        "products": products[:limit],
        "stores":   list({p["store"] for p in products if p["store"]}),
        "minPrice": products[0]["price"] if products else None,
        "maxPrice": products[-1]["price"] if products else None,
    }
