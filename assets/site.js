(function () {
  "use strict";
  var T = window.SITE_T || {};
  var LANG = document.documentElement.lang || "en";
  var DIRX = document.documentElement.dir === "rtl" ? -1 : 1;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (id) { return document.getElementById(id); };
  var dfLong = null, dfShort = null;
  try {
    dfLong = new Intl.DateTimeFormat(LANG, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    dfShort = new Intl.DateTimeFormat(LANG, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  } catch (e) {}
  function fmtDate(iso, long) {
    try { return (long ? dfLong : dfShort).format(new Date(iso)); }
    catch (e) { return iso.slice(0, 10); }
  }
  $("year").textContent = new Date().getFullYear();
  document.querySelectorAll("time[datetime]").forEach(function (t) { t.textContent = fmtDate(t.getAttribute("datetime"), t.hasAttribute("data-long")); });

  // ---------- Springs (damping ratio + response, like Apple's) ----------
  function Spring(value, response, damping) {
    this.x = value; this.v = 0; this.t = value;
    this.k = Math.pow(2 * Math.PI / response, 2);
    this.c = 4 * Math.PI * damping / response;
  }
  Spring.prototype.step = function (dt) {
    var n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (var i = 0; i < n; i++) { var a = -this.k * (this.x - this.t) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    return this.x;
  };
  Spring.prototype.idle = function () { return Math.abs(this.x - this.t) < 1e-4 && Math.abs(this.v) < 1e-4; };

  // ---------- One frame loop that sleeps when nothing moves ----------
  var tasks = [], running = false, last = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    var busy = false;
    for (var i = 0; i < tasks.length; i++) { try { if (tasks[i](dt, now)) busy = true; } catch (err) { if (window.console) console.error(err); } }
    if (busy) requestAnimationFrame(loop); else running = false;
  }
  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }

  // ---------- Language flyout ----------
  var lb = $("lang-btn"), lm = $("lang-menu");
  function closeMenu() { lm.hidden = true; lb.setAttribute("aria-expanded", "false"); }
  lb.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = lm.hidden;
    lm.hidden = !open;
    lb.setAttribute("aria-expanded", String(open));
    if (open) { var cur = lm.querySelector('[aria-current="true"]'); if (cur) cur.focus(); }
  });
  document.addEventListener("click", function (e) { if (!lm.hidden && !lm.contains(e.target)) closeMenu(); });
  lb.parentNode.addEventListener("focusout", function (e) { if (!lm.hidden && !lb.parentNode.contains(e.relatedTarget)) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lm.hidden) { closeMenu(); lb.focus(); } });
  lm.querySelectorAll("a[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () { try { localStorage.setItem("lang", a.dataset.lang); } catch (e) {} });
  });

  // ---------- The world made of code ----------
  var hud = $("hud"), frame = $("frame"), hero = $("hero"), wrap = $("globe-wrap"), heroInner = $("hero-inner"), cv = $("globe"), ctx = cv.getContext("2d"), atmo = $("atmo");
  var W = 0, H = 0, R = 100, CX = 0, CY = 0, DPR = 1, heroVisible = true, pageVisible = !document.hidden, globeReady = false, bodyG = null, rimG = null, copyR = -1e9;
  var small = Math.min(innerWidth, innerHeight) < 700;
  var N = small ? 3000 : 5600;
  var MASK = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADf//8AAf///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB////D//////n/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/gf/x////////wAAAAAbgAAB4AAAAAAPwAAAAAAAAAAAAAAAAAAAAAAAAAAAf//8A///////+AAAAB/ngAAAAAAAAAAH8AAAAAAAAAAAAAAAAAAAAAAAAcH3Hv/5////////8AAAAA/gAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAcIAAQP/AH///////+AAAAAPCAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAADwDAc+f+AP///////4AAAAAAAAAAAAAB4AAAAB/8AAAAAAAAAAAAAAAAAAAAAH9wc374AAAf/////8AAAAAAAAAAAAH4AAAA////AAAB/gAAAAAAAAAAAAAAAAwAAA/QAAAH/////8AAAAAAAAAAAAOAAAAP///wAAAAAAAAAAAAAAAAAAAAP8AYe+c3AAAD/////4AAAAAAAAAAAA4AAAH////++HgAOAAAAAAAAAAAAAAAfv+4+w/4gAAB/////wAAAAAAAAAAADwAHgH///////4AfgAAAAAgAAAAAAAAPf/4O4//9AAB/////wAAAAAAAAAAADwAPb////////4m//gAAAAAAAf+AAAAAA/+A8f//4AB////8gAAAAAAA/gAAAAAfv/////////////8AAAAAB///+H//H/+PeDwf+AA3////AAAAAAA//4AAAA8fv///////////////P8gAf////////A4CPz4H8AAP///wAAAAAAD///wADH/n3/////////////////8AD////////////34Z/wA///4AAAAAAAP///+M////n/////////////////+4E/////////////gD/8Af//gAAAAAAAf//5+P////f/////////////////fw/////////////6AD8YAf/wAAf8AAAA/8f+D///////////////////////AgEf///////////zw7/AAP/gAAP4AAAB/4/+f//////////////////////8AMAf//////////+DIA/gAH/gAAAAAAAH/z/////////////////////////+AAH///////////8AwgOAAD+AAAAAAAA//H/////////////////////////6AAP///////////wAA/AAAB+AAAAAAAB/+H//////////////////////nP+AAAH//z////////wAA/wAAAOAAAAAAAB//D/////////////////////+A/4AAAA/zAD///////gAA/4wAAAAAAAAAAB//Ab///////////////////+eDgAAAAABwAA///////4AA/94AAAAAAAAAYA5+A///////////////////4AAHAAAAAADcAAD//////4AAf/8AAAAAAAAA8AC+C///////////////////wAAfgAAAAAMAAAA///////wAf/8AAAAAAAAA4AO8H///////////////////AAA/gAAAABgAAAA///////8A///AAAAAAAAA8ANwH//////////////////8AAB/AAAAAEAAAAAf///////z///4AAAAAAAHOAEDv//////////////////+AAA+AAAAAAAAAABH///////x///8AAAAAAAHHAf/////////////////////6AA8AAAAAAAAAAAD///////x///8AAAAAAAGPz//////////////////////6AAwAAAAAAAAAAAD///////9///6AAAAAAAAPj//////////////////////6AAQAAAAAAAAAAAC///////////EAAAAAAAAYf//////////////////////7AAAAAAAAAAAAAABv////////+MNAAAAAAAAD///////////////////////zAAAAAAAAAAAAAAAH////////7gfgAAAAAAAf///////////////////////yAAAAAAAAAAAAAAAL/////////gCgAAAAAAAH///////////////////////iAAAAAAAAAAAAAAAP/////////pAAAAAAAAAD/////uP////////////////DAAAAAAAAAAAAAAAP/////////+AAAAAAAAAB//v//Gf///////////////+AAAAAAAAAAAAAAAAP////////8wAAAAAAAAAB//H/+AP///////////////8CAAAAAAAAAAAAAAAP////////wAAAAAAAAADj/jz/8AD///////////////4HgAAAAAAAAAAAAAAP////////gAAAAAAAAAH/4Bw/8AA//////////////+APAAAAAAAAAAAAAAAP////////gAAAAAAAAAH/wA8f8Ph//////////////8AAAAAAAAAAAAAAAAAP///////8AAAAAAAAAAH/gMHfJ///////////////v4AMAAAAAAAAAAAAAAAP///////8AAAAAAAAAAH/AMCOP//////////////+JwAMAAAAAAAAAAAAAAAH///////4AAAAAAAAAAH/AAAHH//////////////8BwAIAAAAAAAAAAAAAAAH///////wAAAAAAAAAAH+AAYGH//////////////+w4A4AAAAAAAAAAAAAAAD///////wAAAAAAAAAAAgf+ACBs//////////////g4D4AAAAAAAAAAAAAAAB///////wAAAAAAAAAAAj/+AAAA//////////////AYf4AAAAAAAAAAAAAAAA///////gAAAAAAAAAAB//8AAAA//////////////Ah2AAAAAAAAAAAAAAAAAP/////+AAAAAAAAAAAD//+AAAB//////////////gDwAAAAAAAAAAAAAAAAAH/////8AAAAAAAAAAAH///4GAB//////////////gDAAAAAAAAAAAAAAAAAAG/////4AAAAAAAAAAAP///8P4h//////////////wCAAAAAAAAAAAAAAAAAACf////4AAAAAAAAAAAP////v////////////////gAAAAAAAAAAAAAAAAAAABP//hgYAAAAAAAAAAAP//////3//P///////////wAAAAAAAAAAAAAAAAAAAAv//AAYAAAAAAAAAAAf//////9//H///////////wAAAAAAAAAAAAAAAAAAAB3/+AAcAAAAAAAAAAB///////4//h///////////gAAAAAAAAAAAAAAAAAAAAR/+AANAAAAAAAAAAD///////8//wH//////////AAAAAAAAAAAAAAAAAAAAAJ/+AAEAAAAAAAAAAH///////+f/0B/////////+AAAAAAAAAAAAAAAAAAAAAI/8AAAAAAAAAAAAAH///////+f/44Af///////+QAAAAAAAAAAAAAAAAAAAAAf8AAAAAAAAAAAAAP////////H//+AP///////4gAAAAAAAAAAAAAAAAAAAAAP8AAuAAAAAAAAAAP////////H///AD///v///ggAAAAAAAAAAAAAAAAAAAAAH+AABgAAAAAAAAAf////////n//+AD//4P//YAAAAAAAAAAAAAAAAAAAAAAAP+A4AYAAAAAAAAAP////////j//+AAf/4H/+AAAAAAAAAAAAAAAAgAAAAAAAH/B4ABwAAAAAAAAP////////h//8AAf/gD/8YAAAAAAAAAAAAAAAAAAAAAAAD/nwAD9AAAAAAAAP////////x//4AAf/AD/8QAAAAAAAAAAAAAAAAAAAAAAAAf/wAAAAAAAAAAAP////////4//gAAf+AD/+AAwAAAAAAAAAAAAAAAAAAAAAAH/wAAAAAAAAAAAf////////4f+AAAf8AD//AAwAAAAAAAAAAAAAAAAAAAAAAAH/AAAAAAAAAAAf////////8f8AAAPwAAP/gAwAAAAAAAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAf////////+fgAAAPwAAP/gAwAAAAAAAAAAAAAAAAAAAAAAAA/AAAAAAAAAAAf/////////eAAAAHwAAP/gAMAAAAAAAAAAAAAAAAAAAAAAAAHgAAAAAAAAAAf/////////gAAAAHwAAM/gACAAAAAAAAAAAAAAAAAAAAAAAADABAAAAAAAAAP/////////gYAAADwAAEfgAJAAAAAAAAAAAAAAAAAAAAAAAADgPfOAAAAAAAH/////////34AAADwAAIOABAAAAAAAAAAAAAAAAAAAAAAAAAAyPf+AAAAAAAD//////////4AAADoAAIEACBAAAAAAAAAAAAAAAAAAAAAAAAA8///AAAAAAAB//////////wAAABIAAMAAAFAAAAAAAAAAAAAAAAAAAAAAAAAE///gAAAAAAB//////////wAAAAMAAEAAALgAAAAAAAAAAAAAAAAAAAAAAAAAf//wAAAAAAAf/////////gAAAAMAADAAMCAAAAAAAAAAAAAAAAAAAAAAAAAA////gAAAAAAP/B///////gAAAAAAADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAf///wAAAAAACAA///////AAAAAAAAxgA+AAAAAAAAAAAAAAAAAAAAAAAAAAAf///4AAAAAAAAAD/////+AAAAAAAAZgB4AAAAAAAAAAAAAAAAAAAAAAAAAAB////4AAAAAAAAAD/////8AAAAAAAAMwH8AAAAAAAAAAAAAAAAAAAAAAAAAAB////8AAAAAAAAAH/////4AAAAAAAAHQf8AIAAAAAAAAAAAAAAAAAAAAAAAAD////8AAAAAAAAAH/////gAAAAAAAAHgf88IAAAAAAAAAAAAAAAAAAAAAAAAD////+AAAAAAAAAH/////AAAAAAAAADwf8AAgAAAAAAAAAAAAAAAAAAAAAAAH/////4AAAAAAAAH/////AAAAAAAAABwP5wBwAAAAAAAAAAAAAAAAAAAAAAAH/////6AAAAAAAAD////+AAAAAAAAAB8P5wATwAAAAAAAAAAAAAAAAAAAAAAD//////4AAAAAAAB////8AAAAAAAAAA8AxQif+AAAAAAAAAAAAAAAAAAAAAAH//////8AAAAAAAB////4AAAAAAAAAAcAAIAD/gAAAAAAAAAAAAAAAAAAAAAH///////gAAAAAAA////4AAAAAAAAAAMAAIAI/ywAAAAAAAAAAAAAAAAAAAAH///////gAAAAAAA////4AAAAAAAAAADgAAAI/8BAAAAAAAAAAAAAAAAAAAAD///////gAAAAAAAf///4AAAAAAAAAAB+AAAA/4AIAAAAAAAAAAAAAAAAAAAB///////gAAAAAAAf///4AAAAAAAAAAAAmogAOMAAAAAAAAAAAAAAAAAAAAAB///////AAAAAAAAf///8AAAAAAAAAAAABCAAAGADAAAAAAAAAAAAAAAAAAAA///////AAAAAAAAf///8AAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAf/////+AAAAAAAAP///8AAAAAAAAAAAAAAAgCAAAAAAAAAAAAAAAAAAAAAAAf/////8AAAAAAAAf///+AQAAAAAAAAAAAAB+CAAAAAAAAAAAAAAAAAAAAAAAP/////4AAAAAAAAf///+AQAAAAAAAAAAAAD8DAAAAAAAAAAAAAAAAAAAAAAAP/////4AAAAAAAA////+AwAAAAAAAAAAAA38DgAAAAAAAAAAAAAAAAAAAAAAH/////4AAAAAAAA////8BwAAAAAAAAAAAD/8DgAAAAAAAAAAAAAAAAAAAAAAB/////4AAAAAAAA////8PwAAAAAAAAAAAD//HwAABABAAAAAAAAAAAAAAAAAAf////4AAAAAAAA////wPgAAAAAAAAAAAP//3wAAAACAAAAAAAAAAAAAAAAAAP////wAAAAAAAA////APgAAAAAAAAAAAP///wAAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAf//+APgAAAAAAAAAAAf///4AAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAf//+APgAAAAAAAAAAD////+AAIAAAAAAAAAAAAAAAAAAAAP////gAAAAAAAAP//+AfAAAAAAAAAAAf////+AAEAAAAAAAAAAAAAAAAAAAAP////AAAAAAAAAP///AfAAAAAAAAAAA//////AAAAAAAAAAAAAAAAAAAAAAAP///4AAAAAAAAAP//+APAAAAAAAAAAA//////gAAAAAAAAAAAAAAAAAAAAAAf///gAAAAAAAAAH//+AOAAAAAAAAAAB//////wAAAAAAAAAAAAAAAAAAAAAAf///AAAAAAAAAAH//4AEAAAAAAAAAAA//////4AAAAAAAAAAAAAAAAAAAAAAf//+AAAAAAAAAAH//4AAAAAAAAAAAAB//////4AAAAAAAAAAAAAAAAAAAAAAf//+AAAAAAAAAAH//4AAAAAAAAAAAAA//////4AAAAAAAAAAAAAAAAAAAAAAf//+AAAAAAAAAAD//wAAAAAAAAAAAAAf/////8AAAAAAAAAAAAAAAAAAAAAAf//8AAAAAAAAAAB//gAAAAAAAAAAAAAf/////4AAAAAAAAAAAAAAAAAAAAAA///8AAAAAAAAAAB//gAAAAAAAAAAAAAf/////4AAAAAAAAAAAAAAAAAAAAAA///4AAAAAAAAAAA//AAAAAAAAAAAAAAP/////4AAAAAAAAAAAAAAAAAAAAAAf//wAAAAAAAAAAA/+AAAAAAAAAAAAAAP/AP//wAAAAAAAAAAAAAAAAAAAAAA///gAAAAAAAAAAA/4AAAAAAAAAAAAAAf8AG//gAAAAAAAAAAAAAAAAAAAAAA//3AAAAAAAAAAAAYAAAAAAAAAAAAAAAOAAF//gAAAAAAAAAAAAAAAAAAAAAB//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//AAABAAAAAAAAAAAAAAAAAAB//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/AAAAgAAAAAAAAAAAAAAAAAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/AAAAQAAAAAAAAAAAAAAAAAB//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYAAAAcAAAAAAAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAD/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAADQAAAAAAAAAAAAAAAAAD/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAHAAAAAAAAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAOAAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAH+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAH+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4BwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAH4AAAAAAB4HgAD8AAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAA//AAAD//////////wAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAf///4Af///////////AAAAAAAAAAAAAAAAAAAAAAAz4AAAAAAAAAAAAAAAPz////8B/////////////wAAAAAAAAAAAAAAAAAAAAA78AAAAAAAAAAA8/8///////wf/////////////+AAAAAAAAAAAAAAAAAAAAH9+AAAAAAAAZ////////////w////////////////4AAAAAAAAAAAAAAAAAAAB+AAAAAAAB//////////////////////////////4AAAAAAAAABmAAB8f+HB/+AAAAAAAP//////////////////////////////gAAAAAAAAP/c/oAf/////4AAAAAAAP/////////////////////////////8AAAAAAAD/////////////gAAAAAAB//////////////////////////////wAAAAAAAD////////////wAAAAAAP///////////////////////////////wAAAAAD/////////////4AAAAAAD////////////////////////////////wAAAADh/////////////AAAAB8A/////////////////////////////////+AAAAA4Af///////////gAAAH+AA///////////////////////////////+AAAAAAAAH///////////+A/A/wAA///////////////////////////////8AAAAAAAf//////////////gAAAf////////////////////////////////+AAAAAAAH///////////////h////////////////////////////////////wAAAAAAP/////////////////////////////////////////////////////gA+/gAAH///////////////////////////////////////////////gAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  var GLYPHS = "01{}<>/;=#$*+[]".split("");
  // Natural Earth land mask (360x180, 1 bit per degree) to place the continents
  var bits = (function () { var b = atob(MASK), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; })();
  function isLandAt(lat, lon) {
    var col = Math.min(359, Math.max(0, Math.floor((lon + Math.PI) / (2 * Math.PI) * 360)));
    var row = Math.min(179, Math.max(0, Math.floor((Math.PI / 2 - lat) / Math.PI * 180)));
    return (bits[row * 45 + (col >> 3)] >> (7 - (col & 7))) & 1;
  }
  function hash(i, j, k) {
    var h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function sm(t) { return t * t * (3 - 2 * t); }
  function vnoise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    function L(a, b, t) { return a + (b - a) * t; }
    return L(L(L(hash(xi, yi, zi), hash(xi + 1, yi, zi), xf), L(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), xf), yf),
             L(L(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), xf), L(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  }
  function fbm(x, y, z) { return 0.55 * vnoise(x, y, z) + 0.3 * vnoise(x * 2.1 + 5, y * 2.1, z * 2.1) + 0.15 * vnoise(x * 4.3, y * 4.3 + 9, z * 4.3); }
  var pts = [], land = [];
  (function build() {
    var ga = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * ga;
      var x = Math.cos(th) * r, z = Math.sin(th) * r;
      var isLand = !!isLandAt(Math.asin(y), Math.atan2(-z, x));
      var p = { x: x, y: y, z: z, land: isLand, g: (Math.random() * GLYPHS.length) | 0, hot: isLand && fbm(x * 3 + 2, y * 3, z * 3) > 0.62 };
      pts.push(p);
      if (isLand) land.push(p);
    }
  })();
  var atlas = {};
  function makeAtlas() {
    var S = Math.round(28 * DPR);
    [["c", "#7FD8FF"], ["h", "#C7B9FF"]].forEach(function (pair) {
      atlas[pair[0]] = GLYPHS.map(function (ch) {
        var c = document.createElement("canvas"); c.width = c.height = S;
        var g = c.getContext("2d");
        g.fillStyle = pair[1];
        g.font = "600 " + Math.round(S * 0.78) + "px " + "Cascadia Mono, Consolas, Menlo, monospace";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(ch, S / 2, S / 2 + S * 0.04);
        return c;
      });
    });
  }
  var LABELS = ["Kotlin", "Python", "PHP", "OSINT", "Magisk", "KernelSU", "Compose", "Bash"];
  var pings = [], linksMade = 0, fpsAcc = 0, fpsN = 0, hudT = 0;
  var yaw = -1.2, yawVel = 0.16, AUTO = 0.16; // starts facing the Atlantic: the Americas, Europe and Africa
  var pitch = new Spring(-0.32, 0.55, 0.8), hoverX = new Spring(0, 0.6, 1), hoverY = new Spring(0, 0.6, 1);
  var ringA = 0, arcs = [], dragging = false, hist = [], lastPX = 0, lastPY = 0, pitchRaw = -0.32;
  function resize() {
    var rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height; DPR = Math.min(W < 900 ? 1.5 : 2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    var wide = W >= 900;
    // Phones: the planet rises below the text like a horizon, so nothing covers the copy
    R = wide ? Math.min(H * 0.34, W * 0.24) : Math.min(W * 0.72, 300);
    CX = wide ? W * 0.73 : W * 0.5;
    if (wide) { CY = H * 0.52; hero.style.minHeight = ""; }
    else {
      var copyBottom = document.querySelector(".hero-copy").getBoundingClientRect().bottom - rect.top;
      CY = copyBottom + 40 + R;
      var need = Math.round(CY + R * 0.35);
      if (Math.abs((parseFloat(hero.style.minHeight) || 0) - need) > 2 && need > innerHeight) { hero.style.minHeight = need + "px"; return; }
    }
    atmo.style.left = CX + "px"; atmo.style.top = CY + "px";
    atmo.style.width = atmo.style.height = (R * 3.2) + "px";
    var fr = R * 1.5;
    frame.style.left = (CX - fr) + "px"; frame.style.top = (CY - fr) + "px"; frame.style.width = frame.style.height = (fr * 2) + "px";
    hud.style.left = Math.min(W - 190, CX + R * 0.95) + "px"; hud.style.top = (CY + R * 0.7) + "px";
    hero.classList.add("placed");
    // Labels fade out before they reach the text column
    copyR = wide ? document.querySelector(".hero-copy").getBoundingClientRect().right - rect.left + 24 : -1e9;
    bodyG = ctx.createRadialGradient(CX - R * 0.35, CY - R * 0.4, R * 0.1, CX, CY, R * 1.04);
    bodyG.addColorStop(0, "rgba(20, 52, 90, 0.6)");
    bodyG.addColorStop(0.8, "rgba(7, 16, 32, 0.6)");
    bodyG.addColorStop(0.97, "rgba(40, 110, 170, 0.35)");
    bodyG.addColorStop(1, "rgba(96, 205, 255, 0.5)");
    rimG = ctx.createRadialGradient(CX, CY, R * 1.0, CX, CY, R * 1.12);
    rimG.addColorStop(0, "rgba(96, 205, 255, 0.18)"); rimG.addColorStop(1, "rgba(96, 205, 255, 0)");
    if (!globeReady) return;
    makeAtlas();
    drawGlobe(0);
  }
  function rot(p, cy, sy, cp, sp, out) {
    var x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
    var y2 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp;
    var k = 3.2 / (3.2 - z2);
    out.x = CX + x1 * R * k; out.y = CY - y2 * R * k; out.z = z2; out.k = k;
    return out;
  }
  var tmp = { x: 0, y: 0, z: 0, k: 1 }, tmpB = { x: 0, y: 0, z: 0, k: 1 };
  function spawnArc() {
    if (land.length < 2) return;
    var a = land[(Math.random() * land.length) | 0], b = land[(Math.random() * land.length) | 0];
    var dot = a.x * b.x + a.y * b.y + a.z * b.z;
    if (a === b || dot < 0.25 || dot > 0.97) return;
    arcs.push({ a: a, b: b, t: 0, s: 0.45 + Math.random() * 0.3, h: 0.1 + 0.22 * (1 - dot) });
    linksMade++;
  }
  function arcPoint(a, b, s, out, h) {
    var x = a.x + (b.x - a.x) * s, y = a.y + (b.y - a.y) * s, z = a.z + (b.z - a.z) * s;
    var l = Math.sqrt(x * x + y * y + z * z) || 1, lift = 1 + h * Math.sin(Math.PI * s);
    out.x = x / l * lift; out.y = y / l * lift; out.z = z / l * lift;
    return out;
  }
  var ap = { x: 0, y: 0, z: 0 };
  function drawGlobe(dt) {
    if (!atlas.c) return;
    var Y = yaw + hoverX.x, P = pitch.x + hoverY.x;
    var cy = Math.cos(Y), sy = Math.sin(Y), cp = Math.cos(P), sp = Math.sin(P);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Planet body: dark sphere with a lit rim so it reads as solid
    ctx.globalAlpha = 1; ctx.fillStyle = bodyG;
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.035, 0, 6.2832); ctx.fill();
    // Ocean dots and back glyphs first, front glyphs on top
    ctx.fillStyle = "#9fd3ff";
    var base = R * (small ? 0.05 : 0.04);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      rot(p, cy, sy, cp, sp, tmp);
      if (!p.land) {
        if (tmp.z < -0.2) continue;
        if ((i & 1) && small) continue;
        ctx.globalAlpha = 0.04 + 0.2 * Math.max(0, tmp.z);
        var d = 1.2 * tmp.k;
        ctx.fillRect(tmp.x - d / 2, tmp.y - d / 2, d, d);
      } else {
        var alpha = tmp.z > 0 ? 0.35 + 0.65 * tmp.z : 0.05 * (1 + tmp.z);
        if (alpha < 0.02) continue;
        var s = base * tmp.k * (tmp.z > 0 ? 1 : 0.8);
        if (tmp.z > 0) { ctx.globalAlpha = alpha * 0.22; ctx.fillStyle = p.hot ? "#B4A6FF" : "#60CDFF"; ctx.fillRect(tmp.x - s * 0.45, tmp.y - s * 0.45, s * 0.9, s * 0.9); ctx.fillStyle = "#9fd3ff"; }
        ctx.globalAlpha = alpha;
        ctx.drawImage(atlas[p.hot ? "h" : "c"][p.g], tmp.x - s / 2, tmp.y - s / 2, s, s);
      }
    }
    // Code flickering on the surface
    if (dt > 0) for (var f = 0; f < 4; f++) { var q = land[(Math.random() * land.length) | 0]; if (q) q.g = (Math.random() * GLYPHS.length) | 0; }
    // Data arcs between points
    if (dt > 0) {
      if (arcs.length < (small ? 3 : 5) && Math.random() < dt * 1.6) spawnArc();
      ctx.lineWidth = 1.4; ctx.lineCap = "round";
      for (var j = arcs.length - 1; j >= 0; j--) {
        var A = arcs[j]; A.t += dt * A.s;
        if (A.t > 1.4) { arcs.splice(j, 1); continue; }
        var s0 = Math.max(0, A.t - 0.4), s1 = Math.min(1, A.t), steps = 18, prev = null;
        for (var k = 0; k <= steps; k++) {
          var ss = s0 + (s1 - s0) * k / steps;
          arcPoint(A.a, A.b, ss, ap, A.h);
          rot(ap, cy, sy, cp, sp, tmpB);
          if (prev && tmpB.z > -0.05 && prev.z > -0.05) {
            ctx.globalAlpha = (k / steps) * 0.9;
            ctx.strokeStyle = "#60CDFF";
            ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(tmpB.x, tmpB.y); ctx.stroke();
          }
          prev = { x: tmpB.x, y: tmpB.y, z: tmpB.z };
        }
        if (A.t <= 1 && prev && prev.z > -0.05) { ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(prev.x, prev.y, 2.2, 0, 6.283); ctx.fill(); }
        if (A.t > 1 && !A.pinged) { A.pinged = true; pings.push({ p: A.b, t: 0 }); }
      }
    }
    // Pings where a link lands
    for (var q2 = pings.length - 1; q2 >= 0; q2--) {
      var P2 = pings[q2]; P2.t += dt;
      if (P2.t > 1.6) { pings.splice(q2, 1); continue; }
      rot(P2.p, cy, sy, cp, sp, tmp);
      if (tmp.z <= 0) continue;
      ctx.globalAlpha = (1 - P2.t / 1.6) * tmp.z;
      ctx.strokeStyle = "#B4A6FF"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tmp.x, tmp.y, 3 + P2.t * R * 0.06, 0, 6.283); ctx.stroke();
    }
    // Rim light
    ctx.globalAlpha = 1; ctx.fillStyle = rimG;
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.12, 0, 6.2832); ctx.arc(CX, CY, R * 1.0, 0, 6.2832, true); ctx.fill();
    // Orbit ring with stack labels
    ringA += dt * 0.12;
    var tilt = 0.42, ct = Math.cos(tilt), st = Math.sin(tilt);
    ctx.font = "600 " + Math.max(10, Math.round(R * 0.055)) + "px Cascadia Mono, Consolas, Menlo, monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (var m = 0; m < 64; m++) {
      var a = m / 64 * 6.2832 + ringA, rx = Math.cos(a) * 1.34, rz = Math.sin(a) * 1.34;
      var pt = { x: rx, y: -rz * st, z: rz * ct };
      rot(pt, Math.cos(hoverX.x * 0.5), Math.sin(hoverX.x * 0.5), cp, sp, tmp);
      var li = m % 8 === 0 ? m / 8 : -1;
      var front = tmp.z > 0;
      if (li >= 0) {
        var dx2 = tmp.x - CX, dy2 = tmp.y - CY;
        if (!front && dx2 * dx2 + dy2 * dy2 < R * R * 1.05) continue;
        var tw = ctx.measureText(LABELS[li]).width + 16, th = Math.max(18, R * 0.1);
        var fade = Math.min(1, Math.max(0, (tmp.x - tw / 2 - copyR) / 60));
        if (fade <= 0) continue;
        ctx.globalAlpha = (front ? 0.95 : 0.35) * fade;
        ctx.fillStyle = "rgba(10, 16, 28, 0.78)"; ctx.strokeStyle = "rgba(96, 205, 255, 0.45)"; ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(tmp.x - tw / 2, tmp.y - th / 2, tw, th, th / 2); else ctx.rect(tmp.x - tw / 2, tmp.y - th / 2, tw, th);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = front ? "#ffffff" : "#9fd3ff";
        ctx.fillText(LABELS[li], tmp.x, tmp.y + 0.5);
      } else {
        ctx.globalAlpha = front ? 0.45 : 0.12;
        ctx.fillStyle = "#7FD8FF";
        ctx.fillRect(tmp.x - 1, tmp.y - 1, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
  var paused = false, pb = $("pause-btn");
  if (pb) {
    if (reduce) pb.hidden = true;
    pb.addEventListener("click", function () {
      paused = !paused;
      document.documentElement.classList.toggle("paused", paused);
      pb.setAttribute("aria-pressed", String(paused));
      pb.querySelector("span").textContent = paused ? (T.play || "Play") : (T.pause || "Pause");
      pb.querySelector("use").setAttribute("href", paused ? "#i-play" : "#i-pause");
      if (!paused) kick();
    });
  }
  var globeTask = function (dt) {
    if (!globeReady || !heroVisible || !pageVisible || (paused && !dragging)) return false;
    if (!dragging) {
      yawVel = AUTO + (yawVel - AUTO) * Math.pow(0.997, dt * 1000);
      yaw += yawVel * dt;
      pitch.step(dt);
    }
    hoverX.step(dt); hoverY.step(dt);
    drawGlobe(dt);
    if (dt > 0) { fpsAcc += dt; fpsN++; hudT += dt; }
    if (hudT > 0.5 && hud.offsetParent) {
      hudT = 0;
      fpsAcc = 0; fpsN = 0;
      $("h-links").textContent = linksMade.toLocaleString(LANG);
      $("h-rot").textContent = ((((yaw * 180 / Math.PI) % 360) + 360) % 360).toFixed(0) + "°";
    }
    return !reduce;
  };
  tasks.push(globeTask);

  // Drag with momentum: 1:1 tracking, velocity handoff, rubber-banded pitch
  function rubber(over, dim) { var c = 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }
  cv.addEventListener("pointerdown", function (e) {
    dragging = true; cv.classList.add("drag");
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    lastPX = e.clientX; lastPY = e.clientY; hist = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
    pitchRaw = pitch.x; pitch.v = 0; yawVel = 0;
    $("hint").classList.add("gone");
    kick();
  });
  cv.addEventListener("pointermove", function (e) {
    if (dragging) {
      var dx = e.clientX - lastPX, dy = e.clientY - lastPY;
      lastPX = e.clientX; lastPY = e.clientY;
      yaw += dx / R;
      pitchRaw += dy / R;
      var lim = 0.7, over = Math.abs(pitchRaw) > lim ? pitchRaw - Math.sign(pitchRaw) * lim : 0;
      pitch.x = over ? Math.sign(pitchRaw) * lim + rubber(over, 1) : pitchRaw;
      hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      while (hist.length > 2 && e.timeStamp - hist[0].t > 100) hist.shift();
      if (reduce) drawGlobe(0);
    } else if (fine) {
      var r = hero.getBoundingClientRect();
      hoverX.t = ((e.clientX - r.left) / r.width - 0.5) * 0.35;
      hoverY.t = ((e.clientY - r.top) / r.height - 0.5) * 0.2;
      kick();
    }
  });
  function release(e) {
    if (!dragging) return;
    dragging = false; cv.classList.remove("drag");
    var a = hist[0], b = hist[hist.length - 1], dtm = Math.max(16, b.t - a.t);
    var vx = (b.x - a.x) / dtm * 1000, vy = (b.y - a.y) / dtm * 1000;
    yawVel = reduce ? 0 : Math.max(-9, Math.min(9, vx / R));
    pitch.t = -0.32; pitch.v = reduce ? 0 : vy / R;
    kick();
  }
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", release);
  hero.addEventListener("pointerleave", function () { hoverX.t = 0; hoverY.t = 0; kick(); });
  cv.tabIndex = 0;
  cv.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { yawVel = (e.key === "ArrowLeft" ? -3 : 3); kick(); e.preventDefault(); }
  });

  if ("ResizeObserver" in window) new ResizeObserver(function () { resize(); }).observe(hero); else addEventListener("resize", resize);
  resize();
  $("h-nodes").textContent = N.toLocaleString(LANG);
  // The globe starts once the page has painted, so it never delays the text
  function startGlobe() { if (globeReady) return; globeReady = true; resize(); cv.classList.add("on"); kick(); }
  function afterLoad() { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(startGlobe, { timeout: 1500 }); }
  if (document.readyState === "complete") afterLoad(); else addEventListener("load", afterLoad);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; if (heroVisible) kick(); }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { pageVisible = !document.hidden; if (pageVisible) kick(); });

  // ---------- Scroll: hero zoom-out, chrome, progress, active section ----------
  var titlebar = $("titlebar"), tabbar = $("tabbar");
  var spyLinks = document.querySelectorAll("[data-spy]"), secs = document.querySelectorAll("[data-section]"), darks = document.querySelectorAll("[data-dark]");
  function onScroll() {
    var y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    var hh = hero.offsetHeight, p = Math.min(1, Math.max(0, y / hh));
    if (!reduce) {
      wrap.style.transform = "translate3d(0," + (p * 18) + "%,0) scale(" + (1 + p * 0.35) + ")";
      wrap.style.opacity = String(1 - p * 0.9);
      heroInner.style.transform = "translate3d(0," + (-p * 90) + "px,0)";
      heroInner.style.opacity = String(Math.max(0, 1 - p * 1.6));
    }
    var onDark = false, probe = 34;
    darks.forEach(function (d) { var r = d.getBoundingClientRect(); if (r.top <= probe && r.bottom > probe) onDark = true; });
    titlebar.classList.toggle("on-dark", onDark);
    var tb = false, bp = innerHeight - 30;
    darks.forEach(function (d) { var r = d.getBoundingClientRect(); if (r.top <= bp && r.bottom > bp) tb = true; });
    tabbar.classList.toggle("on-dark", tb);
    var cur = "top", mid = innerHeight * 0.4;
    secs.forEach(function (s) { if (s.getBoundingClientRect().top <= mid) cur = s.dataset.section; });
    if (h > 0 && y >= h - 4) cur = "contact";
    spyLinks.forEach(function (a) { if (a.dataset.spy === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    storyScroll();
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);

  // ---------- Monitor story: pinned phone that turns with the scroll ----------
  var story = $("monitor"), phone3d = $("phone3d"), glare = $("glare"), caps = document.querySelectorAll("#captions li"), dots = document.querySelectorAll("#dots i");
  var sp = new Spring(0, 0.5, 1), stage = -1;
  function storyScroll() {
    var r = story.getBoundingClientRect(), total = story.offsetHeight - innerHeight;
    var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    sp.t = p;
    var s = Math.min(3, Math.floor(p * 4));
    if (s !== stage) {
      stage = s; phone3d.dataset.stage = s;
      caps.forEach(function (c, i) { c.classList.toggle("on", i === s); });
      dots.forEach(function (d, i) { d.classList.toggle("on", i === s); });
    }
    kick();
  }
  tasks.push(function (dt) {
    if (reduce) { phone3d.style.transform = "none"; return false; }
    sp.step(dt);
    var p = sp.x, wave = Math.sin(p * Math.PI);
    var ry = (DIRX) * (-30 + p * 52), rx = 10 - p * 14, sc = 0.9 + wave * 0.12, ty = (1 - wave) * 12;
    phone3d.style.transform = "translate3d(0," + ty + "px,0) rotateX(" + rx + "deg) rotateY(" + ry + "deg) scale(" + sc + ")";
    glare.style.transform = "translate3d(" + (p * 260 - 20) + "%,0,0)";
    return !sp.idle();
  });

  // ---------- Cards that tilt with springs (pointer devices only) ----------
  if (fine && !reduce) {
    document.querySelectorAll(".tilt").forEach(function (el) {
      var rx = new Spring(0, 0.4, 0.8), ry = new Spring(0, 0.4, 0.8), active = false;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        ry.t = (x - 0.5) * 10; rx.t = (0.5 - y) * 8;
        el.style.setProperty("--x", (x * 100) + "%"); el.style.setProperty("--y", (y * 100) + "%");
        el.classList.add("hot");
        if (!active) { active = true; tasks.push(tick); }
        kick();
      });
      el.addEventListener("pointerleave", function () { rx.t = 0; ry.t = 0; el.classList.remove("hot"); kick(); });
      function tick(dt) {
        rx.step(dt); ry.step(dt);
        el.style.transform = "perspective(900px) rotateX(" + rx.x.toFixed(3) + "deg) rotateY(" + ry.x.toFixed(3) + "deg)";
        if (rx.idle() && ry.idle()) { active = false; tasks.splice(tasks.indexOf(tick), 1); el.style.transform = ""; return false; }
        return true;
      }
    });
    // Magnetic buttons
    document.querySelectorAll(".magnet").forEach(function (el) {
      var mx = new Spring(0, 0.35, 0.7), my = new Spring(0, 0.35, 0.7), active = false;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        mx.t = (e.clientX - r.left - r.width / 2) * 0.22; my.t = (e.clientY - r.top - r.height / 2) * 0.3;
        if (!active) { active = true; tasks.push(tick); }
        kick();
      });
      el.addEventListener("pointerleave", function () { mx.t = 0; my.t = 0; kick(); });
      function tick(dt) {
        mx.step(dt); my.step(dt);
        el.style.translate = mx.x.toFixed(2) + "px " + my.x.toFixed(2) + "px";
        if (mx.idle() && my.idle()) { active = false; tasks.splice(tasks.indexOf(tick), 1); el.style.translate = ""; return false; }
        return true;
      }
    });
  }

  // ---------- Count-up and reveal ----------
  function countUp(el, to) {
    if (reduce) { el.textContent = to.toLocaleString(LANG); return; }
    var t0 = null;
    requestAnimationFrame(function f(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round((+el.dataset.count || to) * e).toLocaleString(LANG);
      if (k < 1) requestAnimationFrame(f);
    });
  }
  var items = document.querySelectorAll(".reveal");
  function shown(el) {
    el.classList.add("in");
    if (el.id === "kpis") el.querySelectorAll("b[data-count]").forEach(function (b) { countUp(b, +b.dataset.count); });
    if (el.id === "term") startTerm();
    if (el.querySelector && el.querySelector("#term")) startTerm();
  }
  if (reduce || !("IntersectionObserver" in window)) items.forEach(shown);
  else {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { shown(x.target); io.unobserve(x.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  // ---------- Terminal: types, then prints neofetch line by line ----------
  var cmds = $("cmds"), nf = $("nf"), tail = $("tail"), termStarted = false;
  var lines = [].slice.call(nf.querySelectorAll(".line")), art = nf.querySelector(".art");
  if (!reduce) { cmds.textContent = ""; tail.style.visibility = "hidden"; lines.forEach(function (l) { l.classList.add("hide"); }); art.classList.add("hide"); }
  function startTerm() {
    if (termStarted || reduce) return;
    termStarted = true;
    var script = [["p", "C:\\> ", "adb shell"], ["h", "phone:/ $ ", "su"], ["h", "phone:/ # ", "neofetch"]], li = 0;
    (function next() {
      if (li >= script.length) {
        art.classList.remove("hide");
        var k = 0;
        (function out() { if (k < lines.length) { lines[k++].classList.remove("hide"); setTimeout(out, 80); } else tail.style.visibility = ""; })();
        return;
      }
      var s = script[li++];
      var pr = document.createElement("span"); pr.className = s[0]; pr.textContent = s[1]; cmds.appendChild(pr);
      var txt = document.createTextNode(""); cmds.appendChild(txt);
      var caret = document.createElement("span"); caret.className = "c"; cmds.appendChild(caret);
      var i = 0;
      setTimeout(function typing() {
        txt.data = s[2].slice(0, ++i);
        if (i < s[2].length) setTimeout(typing, 45 + Math.random() * 55);
        else { cmds.removeChild(caret); txt.data += "\n"; setTimeout(next, 320); }
      }, 400);
    })();
  }

  // ---------- Release history: expand on demand ----------
  var more = $("more"), tl = $("timeline");
  more.addEventListener("click", function () {
    var open = tl.classList.toggle("collapsed") === false;
    more.setAttribute("aria-expanded", String(open));
    more.querySelector("span").textContent = open ? T.less : T.more;
    tl.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    if (!open) tl.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  });

  // ---------- Animated Monitor screen (simulated values) ----------
  var css = getComputedStyle(document.documentElement);
  var mcv = $("cpu"), M = 40, cpu = [], v = 14;
  for (var i = 0; i < M; i++) cpu.push(v);
  function stepCpu() {
    v += (Math.random() - 0.5) * 14;
    if (Math.random() < 0.08) v += Math.random() * 40;
    v = Math.max(3, Math.min(92, v * 0.9 + 14 * 0.1));
    cpu.push(v); cpu.shift();
  }
  function drawCpu() {
    var g = mcv.getContext("2d"), w = mcv.width, h = mcv.height, c = matchMedia("(prefers-color-scheme: dark)").matches ? "#60CDFF" : "#005FB8";
    g.clearRect(0, 0, w, h);
    g.strokeStyle = c; g.globalAlpha = 0.12; g.lineWidth = 1;
    for (var y = 1; y < 6; y++) { var yy = Math.round(h * y / 6) + 0.5; g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke(); }
    var sx = w / (M - 1);
    g.beginPath();
    cpu.forEach(function (p, i) { var x = i * sx, y = h - p / 100 * h; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c); gr.addColorStop(1, "transparent");
    g.globalAlpha = 0.35; g.fillStyle = gr; g.fill();
    g.globalAlpha = 1; g.beginPath();
    cpu.forEach(function (p, i) { var x = i * sx, y = h - p / 100 * h; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.lineWidth = 3; g.lineJoin = "round"; g.stroke();
  }
  var ram = 46, gpu = 8, temp = 39, batt = 82, storyVisible = false;
  function set(id, txt) { $(id).textContent = txt; }
  function setBar(id, pct) { $(id).style.transform = "scaleX(" + Math.max(0, Math.min(1, pct / 100)) + ")"; }
  function tickScreen() {
    stepCpu();
    ram = Math.max(40, Math.min(60, ram + (Math.random() - 0.5) * 2));
    gpu = Math.max(2, Math.min(70, gpu * 0.8 + Math.random() * 12));
    temp = Math.max(35, Math.min(46, temp + (Math.random() - 0.5) * 1.2));
    var c = Math.round(cpu[M - 1]);
    set("m-cpu", c + "%"); set("o-cpu", c + "%");
    set("m-ram", Math.round(ram) + "%"); set("m-gpu", Math.round(gpu) + "%");
    set("m-temp", Math.round(temp) + " °C"); set("o-temp", Math.round(temp) + "°C");
    set("m-batt", batt + "%"); set("o-fps", 57 + Math.round(Math.random() * 3));
    [0, 1, 2].forEach(function (k) { set("p" + k, (Math.random() * (3 - k) + 0.2).toFixed(1) + "%"); });
    setBar("b-ram", ram); setBar("b-gpu", gpu); setBar("b-temp", (temp - 20) * 2.5); setBar("b-batt", batt);
    drawCpu();
  }
  tickScreen();
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { storyVisible = en[0].isIntersecting; }).observe(story);
  if (!reduce) setInterval(function () { if (storyVisible && pageVisible) tickScreen(); }, 1000);

  // ---------- Discord: copy the username ----------
  var toast = $("toast"), timer;
  function show(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }
  function fallbackCopy(text) {
    var t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(t);
    return ok;
  }
  $("discord").addEventListener("click", function () {
    var user = "kevxngg", done = function () { show(T.copied + ": " + user); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(user).then(done, function () { fallbackCopy(user) ? done() : show("Discord: " + user); });
    else fallbackCopy(user) ? done() : show("Discord: " + user);
  });

  // ---------- Live data from GitHub (the page already has a snapshot) ----------
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }); }
  getJSON("https://api.github.com/repos/kevxngg/monitor-root/releases/latest").then(function (rel) {
    if (!rel.tag_name || !rel.published_at) throw new Error();
    var build = rel.tag_name.replace("build-", "");
    var el = $("version"), a = document.createElement("a");
    a.href = rel.html_url;
    a.textContent = T.latest.replace("{b}", build).replace("{d}", fmtDate(rel.published_at, true));
    el.textContent = ""; el.appendChild(a);
    document.querySelectorAll("[data-live-build]").forEach(function (n) { if (n.dataset.count) n.dataset.count = build; var v = (+build).toLocaleString(LANG); if (n.textContent !== v) n.textContent = v; });
  }).catch(function () {});
  function firstNote(body) {
    var m = (body || "").split("\n").filter(function (l) { return /^\s*[-*] /.test(l); })[0];
    return m ? m.replace(/^\s*[-*] /, "").trim() : "";
  }
  getJSON("https://api.github.com/repos/kevxngg/monitor-root/releases?per_page=30").then(function (list) {
    var tl = $("timeline"), first = tl.querySelector("li[data-build]");
    if (!first) return;
    var known = +first.dataset.build;
    var fresh = list.filter(function (r) { return !r.draft && !r.prerelease; })
      .map(function (r) { return { b: parseInt(String(r.tag_name).replace("build-", ""), 10), r: r }; })
      .filter(function (x) { return x.b > known; })
      .sort(function (a, c) { return a.b - c.b; });
    if (!fresh.length) return;
    fresh.forEach(function (x) {
      var li = first.cloneNode(true);
      li.dataset.build = x.b; li.classList.add("in");
      li.querySelector(".node").textContent = x.b;
      li.querySelector("header b").textContent = "Build " + x.b;
      var tm = li.querySelector("time");
      tm.setAttribute("datetime", x.r.published_at); tm.textContent = fmtDate(x.r.published_at, true);
      var p = li.querySelector("p"), note = LANG === "en" ? firstNote(x.r.body) : "";
      p.textContent = "";
      if (note) p.textContent = note;
      else { var a = document.createElement("a"); a.href = x.r.html_url; a.textContent = T.tlNew; p.appendChild(a); }
      tl.insertBefore(li, tl.firstChild);
      first = li;
    });
    tl.querySelectorAll("header .tag").forEach(function (t) { t.remove(); });
    var tag = document.createElement("span"); tag.className = "tag"; tag.textContent = T.tlLatest;
    tl.querySelector("li header").appendChild(tag);
  }).catch(function () {});
  getJSON("https://api.github.com/users/kevxngg/repos?per_page=100&sort=pushed").then(function (repos) {
    var own = repos.filter(function (r) { return !r.fork && r.name !== "kevxngg" && r.name !== "kevxngg.github.io"; }).length;
    document.querySelectorAll("[data-live-repos]").forEach(function (n) { n.dataset.count = own; n.textContent = own.toLocaleString(LANG); });
    repos.forEach(function (r) {
      var t = document.querySelector('time[data-repo="' + r.name + '"]');
      if (t && r.pushed_at) { t.setAttribute("datetime", r.pushed_at); t.textContent = fmtDate(r.pushed_at); }
    });
  }).catch(function () {});

  onScroll();
  kick();
})();
