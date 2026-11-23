// Pruebas de la web en un Chrome real: node --test tests/
// Usa el Chrome instalado (CHROME_PATH o el canal "chrome") y sirve el repositorio en local.
// La API de GitHub se simula para que las pruebas no dependan de la red ni del límite de peticiones.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LANGS = ["en", "es", "fr", "pt", "de", "it", "ru", "ar", "zh", "ja", "ko"];
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".xml": "application/xml", ".txt": "text/plain" };
const pagePath = (l) => (l === "en" ? "/" : `/${l}/`);

// Respuestas simuladas de la API: una build nueva (999) y once repositorios propios
const RELEASE = { tag_name: "build-999", published_at: "2026-12-01T10:00:00Z", html_url: "https://github.com/kevxngg/monitor-root/releases/tag/build-999", draft: false, prerelease: false, body: "- New thing for testing" };
const REPOS = Array.from({ length: 11 }, (_, i) => ({ name: i === 0 ? "kevxngg" : i === 1 ? "kevxngg.github.io" : `repo-${i}`, fork: false, pushed_at: "2026-11-20T00:00:00Z" }))
  .concat([{ name: "a-fork", fork: true, pushed_at: "2026-11-20T00:00:00Z" }]);

let server, browser, base;

before(async () => {
  server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
    try { const body = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(body); }
    catch { res.writeHead(404).end("not found"); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const opts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" };
  browser = await chromium.launch(opts);
});
after(async () => { await browser?.close(); server?.close(); });

async function open(lang, { width = 1440, height = 900, reducedMotion = "no-preference", js = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion, javaScriptEnabled: js, locale: lang });
  await ctx.addInitScript((l) => { try { localStorage.setItem("lang", l); } catch (e) {} }, lang);
  await ctx.route("https://api.github.com/**", (route) => {
    const u = route.request().url();
    const body = u.includes("/releases/latest") ? RELEASE : u.includes("/releases") ? [RELEASE] : u.includes("/repos") ? REPOS : {};
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", (r) => errors.push(`failed: ${r.url()}`));
  page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  await page.goto(base + pagePath(lang), { waitUntil: "load" });
  return { page, ctx, errors };
}

for (const lang of LANGS) {
  test(`${lang}: carga sin errores, metadatos y enlaces entre idiomas`, async () => {
    const { page, ctx, errors } = await open(lang);
    await page.waitForTimeout(600);
    assert.deepEqual(errors, []);
    const meta = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.hreflang),
      og: document.querySelector('meta[property="og:image"]')?.content,
      h1: document.querySelectorAll("h1").length,
      t: typeof window.SITE_T === "object" && !!window.SITE_T.pause,
    }));
    assert.equal(meta.lang, lang);
    assert.equal(meta.dir, lang === "ar" ? "rtl" : "ltr");
    assert.equal(meta.canonical, `https://kevxngg.github.io${pagePath(lang)}`);
    assert.equal(meta.hreflang.length, 12);
    assert.match(meta.og, /\/assets\/og\.jpg$/);
    assert.equal(meta.h1, 1);
    assert.ok(meta.t, "faltan los textos de la página (SITE_T)");
    await ctx.close();
  });

  // Con la fuente del sistema y con una más ancha (como DejaVu Sans en Linux o algunas de Android)
  for (const font of ["", "Verdana, 'DejaVu Sans'"]) {
    test(`${lang}: sin desbordamiento horizontal a 320 px${font ? " con fuente ancha" : ""}`, async () => {
      const { page, ctx } = await open(lang, { width: 320, height: 640 });
      if (font) { await page.addStyleTag({ content: `*{font-family:${font}!important}` }); await page.waitForTimeout(100); }
      const r = await page.evaluate(() => ({
        over: document.documentElement.scrollWidth - window.innerWidth,
        culprits: [...document.querySelectorAll("body *")].filter((e) => {
          const b = e.getBoundingClientRect();
          if (!b.width || (b.right <= innerWidth + 0.5 && b.left >= -0.5) || getComputedStyle(e).position === "fixed") return false;
          for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") return false;
          return true;
        }).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`),
      }));
      assert.ok(r.over <= 0, `desborda ${r.over}px: ${r.culprits.join(", ")}`);
      await ctx.close();
    });
  }
}

test("los datos en vivo actualizan build, repositorios e historial", async () => {
  const { page, ctx } = await open("es");
  await page.evaluate(() => document.getElementById("kpis").scrollIntoView());
  await page.waitForTimeout(1800); // el contador de las cifras tarda 1,4 s en llegar a su valor
  await page.waitForFunction(() => [...document.querySelectorAll("[data-live-build]")].every((n) => n.textContent === "999")
    && [...document.querySelectorAll("[data-live-repos]")].every((n) => n.textContent === "9"), null, { timeout: 5000 });
  const r = await page.evaluate(() => ({
    builds: [...document.querySelectorAll("[data-live-build]")].map((n) => n.textContent),
    repos: [...document.querySelectorAll("[data-live-repos]")].map((n) => n.textContent),
    first: document.querySelector("#timeline li")?.dataset.build,
    note: document.querySelector("#timeline li p")?.textContent,
  }));
  assert.ok(r.builds.every((b) => b === "999"), r.builds.join());
  assert.ok(r.repos.every((n) => n === "9"), r.repos.join()); // 11 propios menos el perfil y la web; el fork no cuenta
  assert.equal(r.first, "999");
  assert.ok(!r.note.includes("New thing"), "en español no deben salir notas en inglés");
  await ctx.close();
});

test("en inglés el historial sí muestra la nota de la build", async () => {
  const { page, ctx } = await open("en");
  await page.waitForFunction(() => document.querySelector("#timeline li")?.dataset.build === "999");
  assert.match(await page.textContent("#timeline li p"), /New thing for testing/);
  await ctx.close();
});

test("menú de idioma: abre, se cierra al salir con Tab y con Escape", async () => {
  const { page, ctx } = await open("es");
  assert.match(await page.getAttribute("#lang-btn", "aria-label"), /^ES/);
  await page.click("#lang-btn");
  assert.equal(await page.getAttribute("#lang-btn", "aria-expanded"), "true");
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  assert.equal(await page.isHidden("#lang-menu"), true, "el menú sigue abierto tras salir con Tab");
  await page.click("#lang-btn");
  await page.keyboard.press("Escape");
  assert.equal(await page.isHidden("#lang-menu"), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), "lang-btn");
  await ctx.close();
});

test("el enlace para saltar al contenido es lo primero con Tab y se ve", async () => {
  const { page, ctx } = await open("es");
  await page.keyboard.press("Tab");
  const s = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { cls: a.className, top: r.top, h: r.height }; });
  assert.equal(s.cls, "skip");
  assert.ok(s.top >= 0 && s.h >= 24);
  await ctx.close();
});

test("el botón de pausa detiene las animaciones y el globo", async () => {
  const { page, ctx } = await open("es");
  await page.waitForSelector("#globe.on");
  await page.click("#pause-btn");
  assert.equal(await page.getAttribute("#pause-btn", "aria-pressed"), "true");
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains("paused")));
  const rot = () => page.textContent("#h-rot");
  const a = await rot(); await page.waitForTimeout(700); const b = await rot();
  assert.equal(a, b, "el globo sigue girando en pausa");
  await page.click("#pause-btn");
  await page.waitForTimeout(700);
  assert.notEqual(await rot(), b, "el globo no vuelve a girar");
  await ctx.close();
});

test("con movimiento reducido no queda contenido oculto y no hay botón de pausa", async () => {
  const { page, ctx } = await open("es", { reducedMotion: "reduce", width: 390, height: 844 });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } });
  const hidden = await page.evaluate(() => [...document.querySelectorAll(".reveal, .fade-up, .captions li")].filter((e) => getComputedStyle(e).opacity === "0").length);
  assert.equal(hidden, 0);
  const moved = await page.evaluate(() => [...document.querySelectorAll(".hero .fade-up, .hero .w")].filter((e) => getComputedStyle(e).transform !== "none").length);
  assert.equal(moved, 0, "el texto del hero queda desplazado con movimiento reducido");
  assert.equal(await page.isHidden("#pause-btn"), true);
  await ctx.close();
});

test("sin JavaScript el contenido es visible", async () => {
  const { page, ctx } = await open("es", { js: false });
  const hidden = await page.evaluate(() => [...document.querySelectorAll("main h2, main h3, .summary")].filter((e) => getComputedStyle(e).opacity === "0").length);
  assert.equal(hidden, 0);
  await ctx.close();
});

test("las etiquetas del globo no tapan el texto del hero en escritorio", async () => {
  const { page, ctx } = await open("es", { width: 1280, height: 800 });
  await page.waitForSelector("#globe.on");
  await page.waitForTimeout(400);
  // Lee del canvas la zona de la columna de texto (sin los 60 px del borde, donde empieza el planeta) y comprueba que está vacía
  const ink = await page.evaluate(() => {
    const cv = document.getElementById("globe"), r = document.querySelector(".hero-copy").getBoundingClientRect(), cr = cv.getBoundingClientRect();
    const k = cv.width / cr.width, x1 = Math.round((r.left - cr.left) * k), w = Math.round((r.width - 60) * k);
    const d = cv.getContext("2d").getImageData(x1, Math.round((r.top - cr.top) * k), w, Math.round(r.height * k)).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++; return n;
  });
  assert.ok(ink < 50, `hay ${ink} píxeles opacos de etiquetas sobre el texto`);
  await ctx.close();
});

test("el sitemap y robots apuntan a todas las páginas", async () => {
  const sm = await readFile(join(ROOT, "sitemap.xml"), "utf8");
  for (const l of LANGS) assert.ok(sm.includes(`<loc>https://kevxngg.github.io${pagePath(l)}</loc>`), l);
  assert.match(await readFile(join(ROOT, "robots.txt"), "utf8"), /Sitemap: https:\/\/kevxngg\.github\.io\/sitemap\.xml/);
});

test("la navegación marca la sección visible", async () => {
  const { page, ctx } = await open("es");
  await page.evaluate(() => document.getElementById("projects").scrollIntoView());
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const a = document.querySelector('.top-links [data-spy][aria-current]');
    const other = document.querySelector('.top-links [data-spy]:not([aria-current])');
    return { spy: a?.dataset.spy, on: a && getComputedStyle(a).backgroundColor, off: other && getComputedStyle(other).backgroundColor };
  });
  assert.equal(r.spy, "projects");
  assert.notEqual(r.on, r.off, "el enlace activo no se distingue");
  await ctx.close();
});

test("en pausa, las flechas del teclado siguen girando el globo", async () => {
  const { page, ctx } = await open("es");
  await page.waitForSelector("#globe.on");
  await page.click("#pause-btn");
  const a = await page.textContent("#h-rot");
  await page.focus("#globe");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  assert.notEqual(await page.textContent("#h-rot"), a);
  await ctx.close();
});
