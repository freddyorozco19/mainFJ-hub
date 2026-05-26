# -*- coding: utf-8 -*-
"""
backend/routers/rappi.py

Busca precios en Rappi Colombia.
Estrategia principal : Playwright (renderiza JS completo + geolocalización real)
Fallback             : httpx  (extrae __NEXT_DATA__ del SSR sin JS)

La diferencia clave frente a httpx puro es que Rappi carga las tiendas
adicionales (Éxito, Carulla, Jumbo, etc.) vía llamadas dinámicas *después*
del SSR. Playwright espera a que esas llamadas terminen (networkidle) y
además proporciona coordenadas GPS reales al navegador.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rappi", tags=["rappi"])

RAPPI_HOME       = "https://www.rappi.com.co"
RAPPI_SEARCH_URL = "https://www.rappi.com.co/search?query={query}"

DEFAULT_LAT = 4.6850868
DEFAULT_LNG = -74.0703650

_CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-setuid-sandbox",
    "--lang=es-CO",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-CO,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


# ─── Extraer __NEXT_DATA__ del HTML ──────────────────────────────────────────

def extract_next_data(html: str) -> dict | None:
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html, re.DOTALL,
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

    results: list[dict] = []
    seen: set[str] = set()

    for entry in fallback.values():
        for store in entry.get("stores", []):
            store_name = store.get("storeName") or store.get("store_name") or store.get("name")
            store_id   = store.get("storeId")
            store_type = store.get("storeType")
            store_path = store.get("url") or ""

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

                product_id = p.get("productId") or p.get("masterProductId")
                if store_path and product_id:
                    rappi_url = f"{RAPPI_HOME}{store_path}?product_id={product_id}"
                elif store_path:
                    rappi_url = f"{RAPPI_HOME}{store_path}"
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


# ─── Playwright: fetch con JS completo + geolocalización ─────────────────────

async def _fetch_playwright(url: str, lat: float, lng: float) -> dict | None:
    """
    Navega con Playwright (Chromium headless) usando geolocalización real.
    Espera networkidle para capturar las tiendas cargadas dinámicamente.
    Retorna el __NEXT_DATA__ parseado, o None si falla.
    """
    try:
        from playwright.async_api import async_playwright  # importación diferida

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=_CHROMIUM_ARGS)
            context = await browser.new_context(
                locale="es-CO",
                timezone_id="America/Bogota",
                user_agent=HEADERS["User-Agent"],
                geolocation={"latitude": lat, "longitude": lng},
                permissions=["geolocation"],
            )

            # Cookies de ubicación (doble seguro)
            await context.add_cookies([
                {"name": "userLat", "value": str(lat), "domain": ".rappi.com.co", "path": "/"},
                {"name": "userLng", "value": str(lng), "domain": ".rappi.com.co", "path": "/"},
                {"name": "lat",     "value": str(lat), "domain": ".rappi.com.co", "path": "/"},
                {"name": "lng",     "value": str(lng), "domain": ".rappi.com.co", "path": "/"},
            ])

            page = await context.new_page()

            # Inicializar sesión en home (establece cookies de sesión de Rappi)
            try:
                await page.goto(RAPPI_HOME, wait_until="domcontentloaded", timeout=20_000)
                await page.wait_for_timeout(1_500)
            except Exception:
                pass  # no crítico

            # Navegar a la búsqueda y esperar carga dinámica completa
            await page.goto(url, wait_until="networkidle", timeout=35_000)
            await page.wait_for_timeout(2_500)

            # Extraer __NEXT_DATA__ del DOM
            next_data = await page.evaluate("""() => {
                const el = document.getElementById('__NEXT_DATA__');
                if (!el) return null;
                try { return JSON.parse(el.textContent || ''); } catch { return null; }
            }""")

            await browser.close()
            return next_data

    except Exception as exc:
        logger.warning("Playwright falló (%s) — se usará fallback httpx", exc)
        return None


# ─── httpx fallback ───────────────────────────────────────────────────────────

async def _fetch_httpx(url: str, lat: float, lng: float) -> dict | None:
    cookies = {
        "userLat": str(lat), "userLng": str(lng),
        "lat":     str(lat), "lng":     str(lng),
    }
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=HEADERS, cookies=cookies)
            resp.raise_for_status()
            return extract_next_data(resp.text)
    except Exception as exc:
        logger.error("httpx falló: %s", exc)
        return None


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/search")
async def rappi_search(
    query: str   = Query(..., min_length=2, description="Término de búsqueda"),
    limit: int   = Query(20, ge=1, le=100, description="Máximo de resultados"),
    lat: float   = Query(DEFAULT_LAT, description="Latitud de entrega"),
    lng: float   = Query(DEFAULT_LNG, description="Longitud de entrega"),
):
    """
    Busca productos en Rappi Colombia.
    Usa Playwright para capturar tiendas cargadas dinámicamente;
    si falla, cae a httpx con extracción SSR.
    """
    url = RAPPI_SEARCH_URL.format(query=query)

    # 1. Playwright (renderizado completo + geolocalización)
    next_data = await _fetch_playwright(url, lat, lng)

    # 2. Fallback httpx
    if not next_data:
        next_data = await _fetch_httpx(url, lat, lng)

    if not next_data:
        raise HTTPException(
            status_code=422,
            detail=(
                "No se pudo extraer datos de Rappi. "
                "Puede que requiera ubicación o cambió su estructura."
            ),
        )

    products = extract_products(next_data, query)

    return {
        "query":    query,
        "count":    len(products[:limit]),
        "total":    len(products),
        "products": products[:limit],
        "stores":   list({p["store"] for p in products if p["store"]}),
        "minPrice": products[0]["price"]  if products else None,
        "maxPrice": products[-1]["price"] if products else None,
        "source":   "playwright" if next_data else "httpx",
    }
