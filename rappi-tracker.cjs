/**
 * rappi-tracker.cjs
 * Busca productos en Rappi Colombia e intercepta los endpoints internos
 * para extraer precios por tienda y guardar historial en JSON.
 *
 * Uso:
 *   node rappi-tracker.cjs                 → usa rappi-products.json
 *   node rappi-tracker.cjs --explore       → modo exploración (loguea todos los requests)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EXPLORE_MODE = process.argv.includes('--explore');
const CONFIG_FILE = path.join(__dirname, 'rappi-products.json');
const OUTPUT_FILE = path.join(__dirname, 'public/data/rappi_prices.json');
const RAPPI_BASE = 'https://www.rappi.com.co';

// ─── Cargar config de productos ──────────────────────────────────────────────
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

// ─── Cargar historial previo ─────────────────────────────────────────────────
let history = { products: {}, lastUpdated: null };
if (fs.existsSync(OUTPUT_FILE)) {
  try { history = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')); }
  catch (_) {}
}

// ─── Utilidades ──────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}

function log(msg) {
  console.log(`[rappi-tracker] ${msg}`);
}

// Intenta extraer items de producto de una respuesta JSON de Rappi
function extractProductsFromResponse(json, keyword) {
  const results = [];

  // Diferentes estructuras que Rappi puede usar:
  const candidates = [
    json?.data?.components,         // estructura antigua
    json?.data?.products,           // estructura de búsqueda
    json?.products,
    json?.results,
    json?.items,
    json?.data,
  ].filter(Array.isArray);

  for (const arr of candidates) {
    for (const item of arr) {
      // Producto directo
      if (item?.price && item?.name) {
        if (item.name.toLowerCase().includes(keyword.toLowerCase())) {
          results.push(normalizeProduct(item));
        }
      }
      // Producto anidado dentro de componente
      if (Array.isArray(item?.products)) {
        for (const p of item.products) {
          if (p?.price && p?.name) {
            if (p.name.toLowerCase().includes(keyword.toLowerCase())) {
              results.push(normalizeProduct(p));
            }
          }
        }
      }
      // Estructura type/resource
      if (item?.resource?.products) {
        for (const p of item.resource.products) {
          if (p?.price && p?.name) {
            results.push(normalizeProduct(p));
          }
        }
      }
    }
  }

  return results;
}

function normalizeProduct(item) {
  return {
    id: item.id || item.product_id || null,
    name: item.name || item.product_name || '',
    price: parseFloat(item.price || item.real_price || 0),
    originalPrice: parseFloat(item.real_price || item.original_price || item.price || 0),
    discount: item.discount || null,
    store: item.store_name || item.restaurant_name || item.storeName || null,
    storeId: item.store_id || item.restaurant_id || null,
    image: item.image || item.image_url || null,
    unit: item.unit_type || item.unit || null,
  };
}

// ─── Script principal ─────────────────────────────────────────────────────────
(async () => {
  log('Iniciando navegador...');

  const browser = await chromium.launch({
    headless: false,  // false para ver qué hace (cambiar a true en producción)
    args: ['--lang=es-CO'],
  });

  const context = await browser.newContext({
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // ── Interceptar todas las respuestas de la API de Rappi ──
  const capturedRequests = [];

  page.on('response', async (response) => {
    const url = response.url();
    const isApi = url.includes('services.rappi') ||
                  url.includes('/api/') ||
                  url.includes('api-apies') ||
                  url.includes('/ms/') ||
                  (url.includes('rappi') && url.includes('search'));

    if (!isApi) return;

    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;

      const json = await response.json().catch(() => null);
      if (!json) return;

      if (EXPLORE_MODE) {
        console.log(`\n🔗 URL: ${url}`);
        console.log('📦 Keys:', Object.keys(json).join(', '));
        if (json.data) console.log('  data keys:', Object.keys(json.data || {}).join(', '));
      }

      capturedRequests.push({ url, json });

    } catch (_) {}
  });

  // ── Navegar a Rappi ──
  log(`Navegando a ${RAPPI_BASE}...`);
  await page.goto(RAPPI_BASE, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
    log('timeout en networkidle, continuando...');
  });

  await page.waitForTimeout(3000);

  // Cerrar popup de ubicación si aparece
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1000);

  // ─── Por cada producto en el config ─────────────────────────────────────────
  const dateKey = today();
  const sessionResults = {};

  for (const product of config.products) {
    log(`\nBuscando: "${product.name}"...`);
    const keyword = product.keywords[0];
    capturedRequests.length = 0; // limpiar requests anteriores

    try {
      // Navegar a la URL de búsqueda de Rappi
      const searchUrl = `${RAPPI_BASE}/tiendas/search?term=${encodeURIComponent(keyword)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(4000);

      // Extraer productos de los requests capturados
      let found = [];
      for (const { url, json } of capturedRequests) {
        const extracted = extractProductsFromResponse(json, keyword);
        if (extracted.length > 0) {
          log(`  ✓ ${extracted.length} productos encontrados desde: ${url.substring(0, 80)}...`);
          found.push(...extracted);
        }
      }

      // Deduplicar por id+store
      const seen = new Set();
      found = found.filter(p => {
        const key = `${p.id}_${p.storeId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Ordenar por precio
      found.sort((a, b) => a.price - b.price);

      if (found.length === 0) {
        log(`  ⚠ No se encontraron productos para "${keyword}"`);
        // Intentar también extrayendo desde el DOM como fallback
        const domPrices = await page.evaluate((kw) => {
          const results = [];
          // Buscar precios en el DOM (estructura genérica)
          const cards = document.querySelectorAll('[class*="product"], [class*="item"], [data-testid*="product"]');
          cards.forEach(card => {
            const nameEl = card.querySelector('[class*="name"], [class*="title"], h3, h4');
            const priceEl = card.querySelector('[class*="price"]');
            if (nameEl && priceEl) {
              const name = nameEl.textContent?.trim() || '';
              const priceText = priceEl.textContent?.trim() || '';
              const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
              if (name.toLowerCase().includes(kw.toLowerCase()) && price > 0) {
                results.push({ name, price, source: 'dom' });
              }
            }
          });
          return results;
        }, keyword).catch(() => []);

        if (domPrices.length > 0) {
          log(`  ✓ ${domPrices.length} precios encontrados via DOM`);
          found = domPrices;
        }
      }

      sessionResults[product.id] = {
        name: product.name,
        keyword,
        results: found,
        count: found.length,
        minPrice: found.length > 0 ? Math.min(...found.map(p => p.price)) : null,
        maxPrice: found.length > 0 ? Math.max(...found.map(p => p.price)) : null,
      };

      found.slice(0, 5).forEach(p => {
        log(`    💰 $${p.price.toLocaleString('es-CO')} — ${p.name} (${p.store || 'tienda desconocida'})`);
      });

    } catch (err) {
      log(`  ❌ Error buscando "${product.name}": ${err.message}`);
      sessionResults[product.id] = { name: product.name, keyword, error: err.message };
    }

    await page.waitForTimeout(2000);
  }

  // ─── Guardar historial ───────────────────────────────────────────────────────
  for (const [productId, data] of Object.entries(sessionResults)) {
    if (!history.products[productId]) {
      history.products[productId] = { name: data.name, history: [] };
    }

    history.products[productId].history.push({
      date: dateKey,
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      count: data.count || 0,
      results: data.results || [],
      error: data.error || null,
    });

    // Mantener máximo 90 días de historial
    if (history.products[productId].history.length > 90) {
      history.products[productId].history = history.products[productId].history.slice(-90);
    }
  }

  history.lastUpdated = new Date().toISOString();

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(history, null, 2), 'utf-8');
  log(`\n✅ Datos guardados en ${OUTPUT_FILE}`);

  await browser.close();
  log('Listo.');
})();
