#!/usr/bin/env node
/**
 * scrape-examtopics-dmf.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Scraper Playwright para CDMP DMF en ExamTopics (requiere cuenta Pro).
 *
 * Uso:
 *   ET_EMAIL="tu@email.com" ET_PASSWORD="tupass" node scrape-examtopics-dmf.cjs
 *
 * Salida: public/data/exam_dmf.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

// ── Credenciales ─────────────────────────────────────────────────────────────
const EMAIL    = process.env.ET_EMAIL    || '';
const PASSWORD = process.env.ET_PASSWORD || '';

if (!EMAIL || !PASSWORD) {
  console.error('❌  Debes pasar ET_EMAIL y ET_PASSWORD como variables de entorno.');
  console.error('    Ejemplo: ET_EMAIL="yo@email.com" ET_PASSWORD="mipass" node scrape-examtopics-dmf.cjs');
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────
const BASE      = 'https://www.examtopics.com';
const EXAM_PATH = '/exams/cdmp/dmf/view';
const OUT_FILE  = path.join(__dirname, 'public', 'data', 'exam_dmf.json');
const DELAY_MS  = 2000;   // ms entre páginas para no ser bloqueado
const SCROLL_WAIT = 600;  // ms de espera tras scroll (lazy-load de imágenes)

// ── Utilidades ────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function cleanText(str) {
  return (str || '').replace(/ /g, ' ').replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Extraer preguntas de la página actual ─────────────────────────────────────
async function scrapePage(page, pageNum) {
  // Scroll completo para triggear lazy-load
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0;
      const step = 400;
      const id = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight) {
          clearInterval(id);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 80);
    });
  });
  await sleep(SCROLL_WAIT);

  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('.exam-question-card, .card.exam-question-card')
    );

    return cards.map(card => {
      // ── Número ──────────────────────────────────────────────────────────
      const headerText = (card.querySelector('.card-header')?.innerText || '').trim();
      const numMatch   = headerText.match(/[Qq]uestion\s*#?\s*(\d+)/);
      const number     = numMatch ? `Question ${numMatch[1]}` : 'Question ?';

      // ── Texto de la pregunta ─────────────────────────────────────────────
      let questionText = '';
      const bodyEl = card.querySelector('.question-body, .card-body');
      if (bodyEl) {
        const clone = bodyEl.cloneNode(true);
        // Quitar sub-secciones que no son el enunciado
        ['.question-choices','.correct-answer-container','.answer-container',
         '.voted-answers-container','.discussion-container','.contribute-container'
        ].forEach(sel => clone.querySelector(sel)?.remove());
        questionText = (clone.innerText || '').replace(/ /g, ' ').replace(/\s{3,}/g, '\n\n').trim();
      }

      // ── Opciones ─────────────────────────────────────────────────────────
      let options = [];

      // Intento 1: selectores estándar de ET
      const optEls = card.querySelectorAll(
        '.question-choices .question-choice, .choices-list .choice'
      );
      if (optEls.length > 0) {
        options = Array.from(optEls).map(el => {
          const letter  = (el.querySelector('.question-choice-letter, .choice-key')?.innerText || '').trim();
          const content = (el.querySelector('.question-choice-content, .choice-content')?.innerText || el.innerText || '').trim();
          if (letter && content && !content.startsWith(letter + '.')) return `${letter}. ${content}`;
          return content;
        }).filter(Boolean);
      }

      // Intento 2: lista <li>
      if (options.length === 0) {
        const lis = card.querySelectorAll('ul.question-choices li, .answers li');
        options = Array.from(lis).map(li => (li.innerText || '').trim()).filter(Boolean);
      }

      // ── Respuesta correcta (Pro) ──────────────────────────────────────────
      let correctAnswer = '';

      // Método A: opción con clase "correct" resaltada
      const correctOptEl = card.querySelector(
        '.question-choice.correct-choice, .choice.correct-choice, .correct-choice, .right-choice'
      );
      if (correctOptEl) {
        const letter  = (correctOptEl.querySelector('.question-choice-letter, .choice-key')?.innerText || '').trim();
        const content = (correctOptEl.querySelector('.question-choice-content, .choice-content')?.innerText || correctOptEl.innerText || '').trim();
        correctAnswer = (letter && content && !content.startsWith(letter + '.'))
          ? `${letter}. ${content}` : content;
      }

      // Método B: div dedicado a la respuesta
      if (!correctAnswer) {
        const divAns = card.querySelector(
          '.correct-answer, .right-answer, .answer-text, [class*="correct-answer"]'
        );
        if (divAns) correctAnswer = (divAns.innerText || '').trim();
      }

      // Método C: regex en el texto completo de la card
      if (!correctAnswer) {
        const raw = card.innerText || '';
        const m = raw.match(/[Cc]orrect\s+[Aa]nswer\s*[:\-]?\s*([A-Z][\s\S]{0,120}?)(?:\n|$)/);
        if (m) correctAnswer = m[1].trim();
      }

      // Limpiar respuesta (a veces trae "Correct Answer: A. texto")
      correctAnswer = correctAnswer.replace(/^[Cc]orrect\s+[Aa]nswer\s*[:\-]?\s*/, '').trim();

      // ── Imágenes ──────────────────────────────────────────────────────────
      const imgEls = card.querySelectorAll('.question-body img, .card-body img');
      const images = Array.from(imgEls)
        .map(img => img.src || img.dataset.src || '')
        .filter(src => src && !src.startsWith('data:') && !src.includes('logo') && !src.includes('icon'));

      return { number, questionText, options, correctAnswer, images };
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Scraper CDMP DMF — ExamTopics Pro                  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({ headless: false, slowMo: 40 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ── 1. Login ────────────────────────────────────────────────────────────
  console.log('🔑 Iniciando sesión en ExamTopics...');
  await page.goto(`${BASE}/login/`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);

  // Intentar diferentes selectores de login
  const emailSel = await page.$('input[name="email"]') ? 'input[name="email"]'
    : await page.$('#id_email')                        ? '#id_email'
    : 'input[type="email"]';
  const passSel = await page.$('input[name="password"]') ? 'input[name="password"]'
    : await page.$('#id_password')                       ? '#id_password'
    : 'input[type="password"]';

  await page.fill(emailSel, EMAIL);
  await page.fill(passSel,  PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await sleep(2000);

  if (page.url().includes('/login/')) {
    console.error('❌ Login fallido. Verifica tus credenciales e inténtalo de nuevo.');
    await browser.close();
    process.exit(1);
  }
  console.log('✅ Login exitoso\n');

  // ── 2. Ir al examen y detectar total de páginas ─────────────────────────
  console.log(`📋 Cargando examen: ${BASE}${EXAM_PATH}/`);
  await page.goto(`${BASE}${EXAM_PATH}/`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);

  // ExamID embebido en el HTML (para enlace examprepper)
  const examId = await page.evaluate(() => {
    const m1 = document.body.innerHTML.match(/"examId"\s*:\s*(\d+)/);
    if (m1) return parseInt(m1[1]);
    const m2 = document.body.innerHTML.match(/\/exam\/(\d+)\//);
    if (m2) return parseInt(m2[1]);
    return null;
  });

  // Total de páginas desde la paginación
  const totalPages = await page.evaluate(() => {
    const sel = '.pagination a, .pagination .page-link, nav[aria-label*="page"] a';
    const links = Array.from(document.querySelectorAll(sel));
    const nums  = links
      .map(l => parseInt((l.textContent || '').trim()))
      .filter(n => !isNaN(n) && n > 0);
    return nums.length ? Math.max(...nums) : 1;
  });

  console.log(`   ExamID detectado : ${examId ?? '(no encontrado)'}`);
  console.log(`   Páginas totales  : ${totalPages}`);
  console.log(`   Preguntas aprox. : ~${totalPages * 5}\n`);

  const allQuestions = [];
  let withAnswer = 0;
  let withImages = 0;

  // ── 3. Scraping página a página ─────────────────────────────────────────
  for (let p = 1; p <= totalPages; p++) {
    const pageUrl = p === 1
      ? `${BASE}${EXAM_PATH}/`
      : `${BASE}${EXAM_PATH}/${p}/`;

    process.stdout.write(`  [${String(p).padStart(3)}/${totalPages}] ${pageUrl} ... `);

    if (p > 1) {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await sleep(1200);
    }

    const qs = await scrapePage(page, p);
    allQuestions.push(...qs);

    const ans = qs.filter(q => q.correctAnswer).length;
    const img = qs.filter(q => q.images?.length).length;
    withAnswer += ans;
    withImages += img;

    console.log(`✓  ${qs.length}Q  |  ${ans} resp.  |  ${img} img`);

    // Guardar progreso parcial cada 10 páginas
    if (p % 10 === 0) {
      const partial = {
        examId, examTitle: 'CDMP Data Management Fundamentals',
        totalQuestions: allQuestions.length, scrapedAt: new Date().toISOString(),
        partial: true, questions: allQuestions,
      };
      fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
      fs.writeFileSync(OUT_FILE.replace('.json', '_partial.json'), JSON.stringify(partial, null, 2));
      console.log(`     💾 Progreso guardado (${allQuestions.length} preguntas)`);
    }

    if (p < totalPages) await sleep(DELAY_MS);
  }

  await browser.close();

  // ── 4. Guardar JSON final ───────────────────────────────────────────────
  const result = {
    examId:         examId,
    examTitle:      'CDMP Data Management Fundamentals',
    totalQuestions: allQuestions.length,
    scrapedAt:      new Date().toISOString(),
    partial:        false,
    questions:      allQuestions,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf-8');

  // Borrar parcial si existe
  const partialFile = OUT_FILE.replace('.json', '_partial.json');
  if (fs.existsSync(partialFile)) fs.unlinkSync(partialFile);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  ✅ Scraping completo                                ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`   Total preguntas : ${allQuestions.length}`);
  console.log(`   Con respuesta   : ${withAnswer}`);
  console.log(`   Con imágenes    : ${withImages}`);
  console.log(`   Archivo         : ${OUT_FILE}`);
  console.log('\n📤 Próximo paso: sube el JSON a GitHub (public/data/exam_dmf.json)');
})();