/**
 * rappi-tracker.cjs (v4 — extrae __NEXT_DATA__ de Next.js SSR)
 *
 * Rappi renderiza los resultados de búsqueda en el servidor (Next.js SSR)
 * y los embebe en el HTML como __NEXT_DATA__. Los extraemos directamente.
 *
 * Uso:
 *   node rappi-tracker.cjs         → busca todos los productos del config
 *   node rappi-tracker.cjs leche   → busca solo "leche" (modo rápido)
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'rappi-products.json');
const OUTPUT_FILE = path.join(__dirname, 'public/data/rappi_prices.json');
const RAPPI_HOME  = 'https://www.rappi.com.co';

function log(msg) { console.log(`[rappi] ${msg}`); }
function today()  { return new Date().toISOString().split('T')[0]; }

function formatCOP(n) {
  return `$${Number(n).toLocaleString('es-CO')}`;
}

// ─── Extraer productos del __NEXT_DATA__ de una página de búsqueda ───────────
async function extractFromPage(page, keyword) {
  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    if (!el) return null;
    try { return JSON.parse(el.textContent || ''); } catch { return null; }
  });

  if (!nextData) {
    log('  ⚠ __NEXT_DATA__ no encontrado — Rappi puede estar pidiendo ubicación');
    return [];
  }

  const fallback = nextData?.props?.pageProps?.fallback;
  if (!fallback) return [];

  const results = [];
  const kw = keyword.toLowerCase().split(' ').filter(w => w.length > 2);

  function matchesKeyword(name) {
    const n = String(name).toLowerCase();
    return kw.every(w => n.includes(w));
  }

  // Recorrer todas las tiendas en el fallback
  for (const key of Object.keys(fallback)) {
    const entry = fallback[key];
    if (!entry?.stores) continue;

    for (const store of entry.stores) {
      const storeName = store.storeName || store.store_name || store.name || null;
      const storeId   = store.storeId   || null;
      const storeType = store.storeType || null;

      for (const p of (store.products || [])) {
        if (!p.name || p.price == null) continue;
        if (!matchesKeyword(p.name)) continue;

        results.push({
          id:            p.masterProductId || p.productId || p.id || null,
          name:          p.name,
          price:         Number(p.price),
          originalPrice: Number(p.realPrice || p.price),
          hasDiscount:   p.hasDiscount || false,
          pum:           p.pum || null,     // precio por unidad (ej: "8.13/ml")
          unitType:      p.unitType || null,
          inStock:       p.inStock !== false,
          store:         storeName,
          storeId:       storeId,
          storeType:     storeType,
          image:         p.image || null,
        });
      }
    }
  }

  // Deduplicar por producto + tienda
  const seen = new Set();
  return results
    .filter(p => {
      const key = `${p.id}_${p.storeId}`;
      if (seen.has(key) || p.price <= 0) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.price - b.price);
}

// ─── Script principal ─────────────────────────────────────────────────────────
(async () => {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

  // Si se pasa un término por argumento, buscar solo ese
  const argTerm = process.argv.slice(2).find(a => !a.startsWith('--'));
  const products = argTerm
    ? [{ id: 'manual', name: argTerm, keywords: [argTerm] }]
    : config.products;

  let history = { products: {}, lastUpdated: null };
  if (fs.existsSync(OUTPUT_FILE)) {
    try { history = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')); } catch (_) {}
  }

  log('Iniciando navegador...');
  const browser = await chromium.launch({
    headless: true,   // silencioso — sin ventana
    args: ['--lang=es-CO'],
  });
  const context = await browser.newContext({
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Cargar home para inicializar cookies/sesión
  log('Inicializando sesión...');
  await page.goto(RAPPI_HOME, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const dateKey = today();

  for (const product of products) {
    log(`\nBuscando: "${product.name}"...`);
    let allFound = [];

    for (const keyword of product.keywords) {
      const searchUrl = `${RAPPI_HOME}/search?query=${encodeURIComponent(keyword)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const found = await extractFromPage(page, keyword);
      if (found.length > 0) {
        allFound = found;
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (allFound.length === 0) {
      log(`  ⚠ Sin resultados`);
    } else {
      log(`  ✓ ${allFound.length} productos encontrados en ${new Set(allFound.map(p => p.store)).size} tiendas`);
      allFound.slice(0, 5).forEach((p, i) => {
        const disc = p.originalPrice > p.price
          ? ` (antes ${formatCOP(p.originalPrice)})`
          : '';
        const pum = p.pum ? ` [${p.pum}]` : '';
        log(`  ${i === 0 ? '🏆' : '  '} ${formatCOP(p.price)}${disc}${pum} — ${p.name} | ${p.store || '?'}`);
      });
    }

    // Guardar historial
    if (!history.products[product.id]) {
      history.products[product.id] = { name: product.name, history: [] };
    }

    const entry = {
      date:     dateKey,
      minPrice: allFound.length > 0 ? Math.min(...allFound.map(p => p.price)) : null,
      maxPrice: allFound.length > 0 ? Math.max(...allFound.map(p => p.price)) : null,
      count:    allFound.length,
      stores:   [...new Set(allFound.map(p => p.store))].filter(Boolean),
      results:  allFound,
    };

    const hist = history.products[product.id].history;
    const idx  = hist.findIndex(h => h.date === dateKey);
    if (idx >= 0) hist[idx] = entry; else hist.push(entry);
    if (hist.length > 90) history.products[product.id].history = hist.slice(-90);

    await page.waitForTimeout(1500);
  }

  history.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(history, null, 2), 'utf-8');
  log(`\n✅ Guardado en ${OUTPUT_FILE}`);

  await browser.close();
  log('Listo.');
})();
