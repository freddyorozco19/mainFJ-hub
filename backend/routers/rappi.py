# -*- coding: utf-8 -*-
"""
backend/routers/rappi.py

Busca precios en Rappi Colombia interceptando las respuestas JSON que el
JS de la página hace *después* del SSR (tiendas dinámicas: Éxito, Carulla,
Jumbo, etc.) más el __NEXT_DATA__ inicial.

Estrategia:
  1. Playwright navega con geolocalización real y espera networkidle.
  2. Se interceptan TODAS las respuestas JSON de *.rappi.com* durante la carga.
  3. Se buscan recursivamente objetos con `products[]` (tiendas) en cada respuesta.
  4. Se fusionan con los productos del __NEXT_DATA__ SSR.
  5. Fallback a httpx puro si Playwright no está disponible.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

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

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": _UA,
    "Accept-Language": "es-CO,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# URLs que no tienen datos de productos — las ignoramos en la intercepción
_SKIP_PATTERNS = (
    "analytics", "tracking", "beacon", "segment", "amplitude",
    "sentry", "datadog", "firebase", "hotjar", "clarity",
    ".js", ".css", ".png", ".jpg", ".woff", "fonts",
    "translations", "i18n", "locales",
)


# ─── Extraer __NEXT_DATA__ del HTML ──────────────────────────────────────────

def _parse_next_data(html: str) -> dict | None:
    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html, re.DOTALL,
    )
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


# ─── Búsqueda recursiva de tiendas en cualquier JSON ─────────────────────────

def _find_stores(node: Any, depth: int = 0) -> list[dict]:
    """
    Recorre recursivamente cualquier estructura JSON buscando
    objetos que tengan una lista 'products' no vacía (→ tiendas de Rappi).
    Límite de profundidad para evitar recursión infinita.
    """
    if depth > 12:
        return []

    stores: list[dict] = []

    if isinstance(node, list):
        for item in node:
            stores.extend(_find_stores(item, depth + 1))

    elif isinstance(node, dict):
        products = node.get("products")
        if isinstance(products, list) and products:
            # Parece una tienda: tiene lista de productos
            stores.append(node)
        else:
            for v in node.values():
                if isinstance(v, (dict, list)):
                    stores.extend(_find_stores(v, depth + 1))

    return stores


# ─── Convertir tienda → lista de productos normalizados ──────────────────────

def _products_from_stores(stores: list[dict], keyword: str, seen: set[str]) -> list[dict]:
    kw_parts = [w for w in keyword.lower().split() if len(w) > 2]

    def matches(name: str) -> bool:
        n = name.lower()
        return all(w in n for w in kw_parts)

    results: list[dict] = []

    for store in stores:
        store_name = (
            store.get("storeName") or store.get("store_name") or store.get("name")
        )
        store_id   = store.get("storeId") or store.get("store_id")
        store_type = store.get("storeType") or store.get("store_type")
        store_path = store.get("url") or ""

        for p in store.get("products", []):
            if not isinstance(p, dict):
                continue
            name  = p.get("name", "")
            price = p.get("price")
            if not name or price is None:
                continue
            if not matches(name):
                continue

            dedup_key = f"{p.get('masterProductId') or name}_{store_id or store_name}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            product_id = p.get("productId") or p.get("masterProductId")
            if store_path and product_id:
                rappi_url = f"{RAPPI_HOME}{store_path}?product_id={product_id}"
            elif store_path:
                rappi_url = f"{RAPPI_HOME}{store_path}"
            else:
                rappi_url = None

            results.append({
                "id":            product_id,
                "name":          name,
                "price":         float(price),
                "originalPrice": float(p.get("realPrice") or p.get("real_price") or price),
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

    return results


# ─── Extraer desde __NEXT_DATA__ (entrada SSR) ───────────────────────────────

def _extract_from_next_data(next_data: dict, keyword: str, seen: set[str]) -> list[dict]:
    fallback = next_data.get("props", {}).get("pageProps", {}).get("fallback", {})
    if not fallback:
        return []

    all_stores: list[dict] = []
    for entry in fallback.values():
        all_stores.extend(_find_stores(entry))

    return _products_from_stores(all_stores, keyword, seen)


# ─── Playwright: navegación + intercepción de respuestas ─────────────────────

async def _fetch_playwright(
    url: str, lat: float, lng: float, query: str
) -> tuple[dict | None, list[Any]]:
    """
    Retorna (next_data_dict | None, lista_de_json_interceptados).
    """
    try:
        from playwright.async_api import async_playwright  # importación diferida

        intercepted: list[Any] = []

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=_CHROMIUM_ARGS)
            context = await browser.new_context(
                locale="es-CO",
                timezone_id="America/Bogota",
                user_agent=_UA,
                geolocation={"latitude": lat, "longitude": lng},
                permissions=["geolocation"],
            )
            await context.add_cookies([
                {"name": "userLat", "value": str(lat), "domain": ".rappi.com.co", "path": "/"},
                {"name": "userLng", "value": str(lng), "domain": ".rappi.com.co", "path": "/"},
                {"name": "lat",     "value": str(lat), "domain": ".rappi.com.co", "path": "/"},
                {"name": "lng",     "value": str(lng), "domain": ".rappi.com.co", "path": "/"},
            ])

            page = await browser.new_page()

            # ── Interceptar respuestas JSON ──
            async def on_response(response):
                try:
                    if not response.ok:
                        return
                    resp_url = response.url
                    if "rappi.com" not in resp_url:
                        return
                    if any(pat in resp_url for pat in _SKIP_PATTERNS):
                        return
                    ct = response.headers.get("content-type", "")
                    if "json" not in ct:
                        return
                    data = await response.json()
                    intercepted.append(data)
                except Exception:
                    pass

            page.on("response", on_response)

            # Inicializar sesión en home
            try:
                await page.goto(RAPPI_HOME, wait_until="domcontentloaded", timeout=20_000)
                await page.wait_for_timeout(1_500)
            except Exception:
                pass

            # Navegar a búsqueda y esperar que todo cargue
            await page.goto(url, wait_until="networkidle", timeout=35_000)
            await page.wait_for_timeout(3_000)

            # Scroll para disparar lazy-loading
            for _ in range(3):
                await page.evaluate("window.scrollBy(0, 600)")
                await page.wait_for_timeout(800)

            # Extraer __NEXT_DATA__ (datos SSR)
            next_data = await page.evaluate("""() => {
                const el = document.getElementById('__NEXT_DATA__');
                if (!el) return null;
                try { return JSON.parse(el.textContent || ''); } catch { return null; }
            }""")

            await browser.close()

        logger.info(
            "Playwright OK — interceptadas %d respuestas JSON", len(intercepted)
        )
        return next_data, intercepted

    except Exception as exc:
        logger.warning("Playwright falló (%s) — fallback a httpx", exc)
        return None, []


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
            return _parse_next_data(resp.text)
    except Exception as exc:
        logger.error("httpx falló: %s", exc)
        return None


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/search")
async def rappi_search(
    query: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    lat: float = Query(DEFAULT_LAT),
    lng: float = Query(DEFAULT_LNG),
):
    url = RAPPI_SEARCH_URL.format(query=query)

    # 1. Playwright + intercepción
    next_data, intercepted = await _fetch_playwright(url, lat, lng, query)

    # 2. Fallback httpx si Playwright no arrancó
    if not next_data and not intercepted:
        next_data = await _fetch_httpx(url, lat, lng)

    if not next_data and not intercepted:
        raise HTTPException(
            status_code=422,
            detail="No se pudo extraer datos de Rappi.",
        )

    # 3. Combinar: SSR + respuestas interceptadas
    seen: set[str] = set()
    products: list[dict] = []

    # SSR primero
    if next_data:
        products.extend(_extract_from_next_data(next_data, query, seen))

    # Respuestas dinámicas interceptadas
    for payload in intercepted:
        stores = _find_stores(payload)
        if stores:
            products.extend(_products_from_stores(stores, query, seen))

    products.sort(key=lambda x: x["price"])

    logger.info(
        "Query '%s': %d productos en %d tiendas (SSR=%s, interceptadas=%d)",
        query,
        len(products),
        len({p["store"] for p in products if p["store"]}),
        bool(next_data),
        len(intercepted),
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
            "intercepted_responses": len(intercepted),
            "source": "playwright+intercept" if intercepted else ("playwright_ssr" if next_data else "httpx"),
        },
    }
