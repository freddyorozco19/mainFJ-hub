/**
 * rappi-explore.cjs
 * Captura los requests EXACTOS (headers + body + URL) que hace Rappi
 * para autenticación y búsqueda. Úsalo una vez para descubrir la API.
 */
const { chromium } = require('playwright');

const SEARCH_TERM = 'leche entera';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'es-CO',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let capturedToken = null;
  const searchRequests = [];

  // ── Interceptar REQUESTS (lo que el browser ENVÍA) ──
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('grability') && !url.includes('rappi')) return;

    // Token endpoint
    if (url.includes('/rocket/v2/guest')) {
      console.log('\n🔑 TOKEN REQUEST:');
      console.log('  URL:', url);
      console.log('  Method:', req.method());
      console.log('  Headers:', JSON.stringify(req.headers(), null, 4));
      const body = req.postData();
      if (body) console.log('  Body:', body);
    }

    // Search endpoint
    if (url.includes('search') || url.includes('pns-global')) {
      console.log('\n🔍 SEARCH REQUEST:');
      console.log('  URL:', url);
      console.log('  Method:', req.method());
      const relevantHeaders = Object.fromEntries(
        Object.entries(req.headers()).filter(([k]) =>
          ['authorization', 'x-authorization', 'x-app-type', 'x-country', 'content-type', 'x-device-id'].includes(k)
        )
      );
      console.log('  Auth/Key headers:', JSON.stringify(relevantHeaders, null, 4));
      searchRequests.push({ url, headers: req.headers() });
    }
  });

  // ── Interceptar RESPONSES ──
  page.on('response', async res => {
    const url = res.url();
    if (!url.includes('grability') && !url.includes('rappi')) return;

    try {
      const ct = res.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const json = await res.json().catch(() => null);
      if (!json) return;

      if (url.includes('/rocket/v2/guest') && json.access_token) {
        capturedToken = json.access_token;
        console.log('\n✅ TOKEN OBTENIDO:', capturedToken.substring(0, 60) + '...');
      }

      if ((url.includes('search') || url.includes('pns-global')) && !url.includes('recent')) {
        console.log('\n📦 SEARCH RESPONSE desde:', url.substring(0, 100));
        console.log('  Keys:', Object.keys(json).join(', '));
        if (json.data) console.log('  data.keys:', Object.keys(json.data).join(', '));

        // Buscar cualquier array con precio
        function findArraysWithPrice(obj, depth = 0) {
          if (depth > 5 || !obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            const withPrice = obj.filter(i => i?.price != null);
            if (withPrice.length > 0) {
              console.log(`  🏷 Array con precios (${withPrice.length} items):`);
              withPrice.slice(0, 3).forEach(p => {
                console.log(`    - ${p.name || p.product_name || '?'} → $${p.price}`);
              });
            }
            return;
          }
          Object.values(obj).forEach(v => findArraysWithPrice(v, depth + 1));
        }
        findArraysWithPrice(json);
      }
    } catch (_) {}
  });

  // ── Navegar al home ──
  console.log('Navegando a rappi.com.co...');
  await page.goto('https://www.rappi.com.co', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // ── Buscar usando la caja de búsqueda real ──
  console.log(`\nBuscando "${SEARCH_TERM}" en la caja de búsqueda...`);

  // Intentar encontrar el input de búsqueda
  const searchSelectors = [
    'input[placeholder*="Busca"]',
    'input[placeholder*="busca"]',
    'input[type="search"]',
    '[data-testid*="search"] input',
    'input[name*="search"]',
    'input[name*="query"]',
  ];

  let searchInput = null;
  for (const sel of searchSelectors) {
    searchInput = await page.$(sel).catch(() => null);
    if (searchInput) { console.log(`  ✓ Input encontrado: ${sel}`); break; }
  }

  if (searchInput) {
    await searchInput.click();
    await page.waitForTimeout(500);
    await searchInput.fill(SEARCH_TERM);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
  } else {
    console.log('  ⚠ No se encontró input de búsqueda — navegando por URL');
    await page.goto(`https://www.rappi.com.co/search?q=${encodeURIComponent(SEARCH_TERM)}`, {
      waitUntil: 'networkidle', timeout: 20000
    }).catch(() => {});
    await page.waitForTimeout(5000);
  }

  console.log('\n─────────────────────────────────');
  console.log('Token capturado:', capturedToken ? '✅ SÍ' : '❌ NO');
  console.log('Search requests capturados:', searchRequests.length);
  if (searchRequests.length > 0) {
    console.log('\nPrimer search URL completo:');
    console.log(searchRequests[0].url);
  }

  await browser.close();
})();
