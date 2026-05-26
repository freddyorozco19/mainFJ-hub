/**
 * rappi-spy.cjs — extrae __NEXT_DATA__ de la página de búsqueda
 */
const { chromium } = require('playwright');

const SEARCH_TERM = 'leche';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'es-CO',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Capturar todas las respuestas JSON
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('rappi') && !url.includes('grability')) return;
    if (url.includes('.js') || url.includes('.css') || url.includes('analytics')) return;
    try {
      const ct = res.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const json = await res.json().catch(() => null);
      if (!json) return;

      function findPriced(obj, path = '', depth = 0) {
        if (depth > 8 || !obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          const priced = obj.filter(i => i?.price != null && i?.name);
          if (priced.length > 0) {
            console.log(`\n💰 ENCONTRADO en ${url.substring(0, 80)}`);
            console.log(`   path: ${path} → ${priced.length} productos`);
            priced.slice(0, 3).forEach(p => console.log(`   • ${p.name} = $${p.price} (${p.store_name || ''})`));
          }
          obj.forEach((i, idx) => findPriced(i, `${path}[${idx}]`, depth + 1));
          return;
        }
        Object.entries(obj).forEach(([k, v]) => findPriced(v, `${path}.${k}`, depth + 1));
      }
      findPriced(json);
    } catch (_) {}
  });

  console.log('Cargando home...');
  await page.goto('https://www.rappi.com.co', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log(`Navegando a búsqueda: "${SEARCH_TERM}"...`);
  await page.goto(`https://www.rappi.com.co/search?query=${encodeURIComponent(SEARCH_TERM)}`, {
    waitUntil: 'networkidle', timeout: 25000,
  }).catch(() => {});
  await page.waitForTimeout(5000);

  // Extraer __NEXT_DATA__
  console.log('\n─── Extrayendo __NEXT_DATA__ ───');
  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    if (!el) return null;
    try { return JSON.parse(el.textContent || ''); } catch { return null; }
  });

  if (nextData) {
    const str = JSON.stringify(nextData);
    console.log('__NEXT_DATA__ size:', str.length, 'chars');
    console.log('Top keys:', Object.keys(nextData).join(', '));
    if (nextData.props) console.log('props keys:', Object.keys(nextData.props).join(', '));

    // Buscar productos con precio dentro de __NEXT_DATA__
    function findPricedInData(obj, path = '', depth = 0) {
      if (depth > 10 || !obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        const priced = obj.filter(i => i?.price != null && i?.name);
        if (priced.length > 0) {
          console.log(`\n✅ PRODUCTOS en __NEXT_DATA__.${path} (${priced.length} items):`);
          priced.slice(0, 5).forEach(p => console.log(`   • ${p.name} = $${p.price}`));
        }
        obj.forEach((i, idx) => findPricedInData(i, `${path}[${idx}]`, depth + 1));
        return;
      }
      Object.entries(obj).forEach(([k, v]) => findPricedInData(v, `${path}.${k}`, depth + 1));
    }
    findPricedInData(nextData);

    // Guardar para inspección manual
    require('fs').writeFileSync('./rappi-next-data.json', JSON.stringify(nextData, null, 2));
    console.log('\n✅ __NEXT_DATA__ guardado en rappi-next-data.json');
  } else {
    console.log('⚠ No se encontró __NEXT_DATA__ — puede que Rappi requiera dirección');

    // Mostrar la URL actual y el título de la página
    console.log('URL actual:', page.url());
    console.log('Título:', await page.title());

    // Tomar screenshot para ver qué muestra
    await page.screenshot({ path: './rappi-screenshot.png', fullPage: false });
    console.log('Screenshot guardado en rappi-screenshot.png');
  }

  await browser.close();
})();
