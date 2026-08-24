/*! dt-lab - Digital Treasury component laboratory
 *
 *  Load ORDER MATTERS on a lab page:
 *
 *    <script src="./dist/dt-lab-chrome.js" defer></script>   generated nav + footer
 *    <script src="./dist/dt-lab.js"        defer></script>   this file
 *    <script src="./dist/dt-craft.js"      defer></script>   the craft layer
 *
 *  Deferred scripts run in document order after parsing, so this file has
 *  injected the nav before dt-craft.js goes looking for #themeSw. Reversing
 *  the two leaves the theme switch dead.
 *
 *  Every module tolerates a page without its markup, the same contract the
 *  craft layer keeps, so one file serves every lab page.
 */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch  = matchMedia('(hover: none)').matches;
  var root   = document.documentElement;

  /* Marks the document so the CSS knows the craft layer is present. Any
     component whose finished state is the safe one (the vault door, the
     seal) is authored open and only closes behind this class. */
  root.classList.add('dt-lab');

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };

  /* =========================================================
     0. CHROME — the nav, palette and footer, injected from the
     generated copy of index.html so they cannot drift out of step
     with the homepage. Runs before anything reads the DOM.
     ========================================================= */
  (function chrome() {
    var C = window.DTChrome;
    if (!C || document.getElementById('nav')) return;

    /* a fragment, not a loop: inserting one node at a time before
       body.firstChild puts the block in backwards */
    var head = document.createElement('div');
    head.innerHTML = C.head;
    var frag = document.createDocumentFragment();
    while (head.firstChild) frag.appendChild(head.firstChild);
    document.body.insertBefore(frag, document.body.firstChild);

    var sc = document.getElementById('scroller');
    if (sc && C.foot) {
      var f = document.createElement('div');
      f.innerHTML = C.foot;
      while (f.firstChild) sc.appendChild(f.firstChild);
    }
    /* A page-level ground. It is authored inside the page so it travels
       with the bundle, but position:fixed inside #scroller would resolve
       against #scroller and ride the transform — so it is lifted out to
       the body here, before anything measures it. */
    var ground = document.getElementById('labGround');
    if (ground) {
      document.body.appendChild(ground);
      /* removed, not hidden: the atmosphere module bails without #atmo,
         so the shared molten field never builds a WebGL context at all */
      var atmo = document.getElementById('atmo');
      if (atmo) atmo.remove();
      var fluid = document.getElementById('fluid');
      if (fluid && ground.dataset.fluid === 'off') fluid.remove();
    }

    var wantsCursor = !(ground && ground.dataset.cursor === 'off');
    var had = document.getElementById('cur');
    if (!wantsCursor) { if (had) had.remove(); }
    else if (!had) {
      var cur = document.createElement('div');
      cur.id = 'cur'; cur.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cur);
    }

    /* The lab's own routes replace the homepage's in-page anchors.
       Two hosting shapes to satisfy: the .html files opened straight off
       disk or from the demo, and real routes on Webflow. The extension on
       the current URL says which one this is. */
    var LAB = [['media', 'Media'], ['cards', 'Cards'],
               ['testimonials', 'Quotes'], ['cta', 'CTA'], ['team', 'Team'],
               ['backgrounds', 'Grounds'], ['scroll', 'Scroll']];
    var path = location.pathname.toLowerCase();
    /* DTLabPage is only set by a generated bundle, which already carries
       hosted routes in its markup -- so its presence settles the question
       whatever the current URL happens to end in */
    var flat = !window.DTLabPage && /\.html?$/.test(path);
    var here = window.DTLabPage ||
      (path.split('/').pop() || '').replace(/\.html?$/, '');

    var links = document.querySelector('.nav-links');
    if (links) {
      var keep = links.querySelector('#svcTrigger');
      [].slice.call(links.children).forEach(function (n) { if (n !== keep) n.remove(); });
      LAB.forEach(function (r) {
        var a = document.createElement('a');
        a.href = flat ? r[0] + '.html' : '/' + r[0];
        a.textContent = r[1];
        if (r[0] === here) a.setAttribute('aria-current', 'page');
        links.appendChild(a);
      });
    }
    var brand = document.querySelector('.brand');
    if (brand) brand.setAttribute('href', flat ? 'index.html' : '/');
  })();

  /* =========================================================
     1. SHARED PLUMBING
     ========================================================= */

  /* Canvas and WebGL cannot read CSS, so every painted surface subscribes
     here and re-reads its palette from custom properties on the host
     element — which is how two fields on one page can carry different
     tints without either knowing about the theme. */
  var themeSubs = [];
  function onTheme(fn) {
    themeSubs.push(fn);
    fn();
  }
  addEventListener('dt:theme', function () {
    for (var i = 0; i < themeSubs.length; i++) { try { themeSubs[i](); } catch (e) {} }
  });

  function tint(el, name, fallback) {
    var raw = getComputedStyle(el || root).getPropertyValue(name).trim();
    return /^\d[\d.,\s]*$/.test(raw) ? raw.replace(/\s+/g, '') : fallback;
  }
  function numvar(el, name, fallback) {
    var v = parseFloat(getComputedStyle(el || root).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  /* A render loop that sleeps. Nothing on these pages runs while it is
     off-screen or while the tab is hidden — with this many canvases on
     one document, that is the difference between idle and a hot fan. */
  function loop(el, step, gate) {
    var live = false, running = false, id = 0;
    function frame(t) {
      if (!running) return;
      id = requestAnimationFrame(frame);
      /* on screen is not the same as visible: inside the scene rig every
         canvas shares one box, and only the two in play are worth drawing */
      if (gate && !gate()) return;
      step(t || 0);
    }
    function set(on) {
      on = on && live;
      if (on === running) return;
      running = on;
      if (on) id = requestAnimationFrame(frame);
      else cancelAnimationFrame(id);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        live = es[0].isIntersecting;
        set(!document.hidden);
      }, { rootMargin: '160px' }).observe(el);
    } else { live = true; set(true); }
    document.addEventListener('visibilitychange', function () { set(!document.hidden); });
    return { stop: function () { live = false; set(false); } };
  }

  /* device pixel ratio, capped. An uncapped canvas on a 3x phone is four
     times the fill rate for a difference nobody can see on a blurred field. */
  function fit(cv, cap) {
    var dpr = Math.min(devicePixelRatio || 1, cap || 1.75);
    var r = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w: w, h: h, dpr: dpr, cw: r.width, ch: r.height };
  }

  /* seeded, so a reload lays the same field down twice */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { return (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  }

  /* pointer position in element space, -1..1, eased */
  function pointer(el, onMove) {
    if (touch) return;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      onMove((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, e);
    }, { passive: true });
  }

  /* Scroll progress for one element, 0..1, measured visually. rect is the
     *transformed* position under smooth scroll, which is exactly what a
     scrubbed value should follow. */
  function progress(el, mode) {
    var r = el.getBoundingClientRect(), vh = innerHeight;
    if (mode === 'through') {
      // a tall pinned section: 0 as its top hits the viewport top, 1 at its end
      var span = r.height - vh;
      return span <= 0 ? 0 : clamp(-r.top / span, 0, 1);
    }
    return clamp((vh * 0.94 - r.top) / (vh * 0.6), 0, 1);
  }

  /* Hold an element still inside a taller section while that section
     passes. This is what position:sticky would do, except sticky resolves
     against the nearest scrollport -- and under the transform-based smooth
     scroll that scrollport (#vp) never scrolls, so a sticky child just
     rides the transform. Scrubbing the offset behaves identically with the
     rig on or off, which is the only version that works on both. */
  function pin(section, el) {
    var cur = -1;
    return function () {
      var r = section.getBoundingClientRect();
      var travel = r.height - innerHeight;
      if (travel <= 0) return;
      var y = clamp(-r.top, 0, travel);
      if (Math.abs(y - cur) < 0.5) return;
      cur = y;
      el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    };
  }

  /* =========================================================
     2. BACKGROUND FIELDS
     One engine, ten grounds. Each canvas declares which field it is and
     reads its own tint, so two instances on one page can differ in
     colour, density and speed without a second implementation.
     ========================================================= */
  var FIELDS = {};

  /* ---------- starfield: depth planes plus meridian arcs ---------- */
  FIELDS.starfield = function (cv, ctx, o) {
    var stars = [], arcs = [], m = fit(cv, 1.6);
    var r = rng(o.seed);
    function build() {
      m = fit(cv, 1.6);
      stars.length = 0;
      var n = Math.round(m.cw * m.ch / 5200 * o.density);
      for (var i = 0; i < n; i++) {
        stars.push({
          x: r(), y: r(),
          z: 0.25 + r() * 0.75,
          p: r() * Math.PI * 2
        });
      }
      arcs.length = 0;
      for (var j = 0; j < 7; j++) arcs.push({ o: r() * Math.PI, s: 0.1 + r() * 0.25 });
    }
    build();
    addEventListener('resize', build, { passive: true });

    var mx = 0.5, my = 0.5, cx = 0.5, cy = 0.5;
    pointer(cv.parentNode, function (x, y) { mx = x; my = y; });

    return function (t) {
      m = fit(cv, 1.6);
      cx = lerp(cx, mx, 0.045); cy = lerp(cy, my, 0.045);
      ctx.clearRect(0, 0, m.w, m.h);
      var a = t * 0.00004 * o.speed;

      /* the meridians: a wire cage suggested rather than drawn */
      ctx.lineWidth = m.dpr;
      for (var k = 0; k < arcs.length; k++) {
        var ar = arcs[k];
        ctx.beginPath();
        ctx.globalAlpha = 0.06 * o.alpha;
        ctx.strokeStyle = 'rgb(' + o.rgb + ')';
        var rad = Math.min(m.w, m.h) * (0.28 + k * 0.09);
        ctx.ellipse(m.w * 0.5, m.h * 0.5, rad, rad * (0.2 + ar.s), a * (k % 2 ? -1 : 1) + ar.o, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var px = (s.x + (cx - 0.5) * 0.06 * s.z + a * s.z * 4) % 1;
        if (px < 0) px += 1;
        var py = (s.y + (cy - 0.5) * 0.06 * s.z) % 1;
        var tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.0016 + s.p));
        ctx.globalAlpha = tw * s.z * 0.75 * o.alpha;
        ctx.fillStyle = 'rgb(' + o.rgb + ')';
        var sz = s.z * 1.5 * m.dpr;
        ctx.fillRect(px * m.w, py * m.h, sz, sz);
      }
      ctx.globalAlpha = 1;
    };
  };

  /* ---------- rings: a vault dial, ticked and counter-running ---------- */
  FIELDS.rings = function (cv, ctx, o) {
    var m = fit(cv, 1.6);
    return function (t) {
      m = fit(cv, 1.6);
      ctx.clearRect(0, 0, m.w, m.h);
      var cx = m.w * 0.5, cy = m.h * 0.52;
      var base = Math.min(m.w, m.h);
      var a = t * 0.00006 * o.speed;
      for (var i = 0; i < 6; i++) {
        var rad = base * (0.16 + i * 0.1);
        var dir = i % 2 ? -1 : 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a * dir * (1 + i * 0.22));
        ctx.globalAlpha = (0.16 - i * 0.017) * o.alpha;
        ctx.strokeStyle = 'rgb(' + o.rgb + ')';
        ctx.lineWidth = m.dpr;
        ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.stroke();
        /* ticks: the marks that make a ring read as an instrument */
        var ticks = 24 + i * 8;
        ctx.globalAlpha = (0.3 - i * 0.03) * o.alpha;
        for (var j = 0; j < ticks; j++) {
          var th = j / ticks * Math.PI * 2;
          var len = (j % 4 === 0 ? 9 : 4) * m.dpr;
          ctx.beginPath();
          ctx.moveTo(Math.cos(th) * rad, Math.sin(th) * rad);
          ctx.lineTo(Math.cos(th) * (rad + len), Math.sin(th) * (rad + len));
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };
  };

  /* ---------- streaks: light drawn out along the axis of travel ---------- */
  FIELDS.streaks = function (cv, ctx, o) {
    var m = fit(cv, 1.5), rows = [], r = rng(o.seed);
    function build() {
      m = fit(cv, 1.5); rows.length = 0;
      var n = Math.max(9, Math.round(m.ch / 26 * o.density));
      for (var i = 0; i < n; i++) {
        rows.push({ y: (i + r() * 0.6) / n, w: 0.1 + r() * 0.5, x: r(), v: 0.15 + r() * 0.85, a: 0.2 + r() * 0.8 });
      }
    }
    build();
    addEventListener('resize', build, { passive: true });
    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      for (var i = 0; i < rows.length; i++) {
        var s = rows[i];
        var x = (s.x + t * 0.00003 * s.v * o.speed) % 1.4 - 0.2;
        var w = s.w * m.w;
        var g = ctx.createLinearGradient(x * m.w, 0, x * m.w + w, 0);
        g.addColorStop(0, 'rgba(' + o.rgb + ',0)');
        g.addColorStop(0.5, 'rgba(' + o.rgb + ',' + (0.13 * s.a * o.alpha).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + o.rgb + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(x * m.w, s.y * m.h, w, Math.max(1, m.dpr));
      }
    };
  };

  /* ---------- scan: a shutter, with one bright bar passing ---------- */
  FIELDS.scan = function (cv, ctx, o) {
    var m = fit(cv, 1.5);
    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      var step = 13 * m.dpr * (1 / o.density);
      ctx.fillStyle = 'rgba(' + o.rgb + ',' + (0.06 * o.alpha).toFixed(3) + ')';
      for (var x = 0; x < m.w; x += step) ctx.fillRect(x, 0, m.dpr, m.h);
      var bar = ((t * 0.00011 * o.speed) % 1.3 - 0.15) * m.w;
      var w = m.w * 0.22;
      var g = ctx.createLinearGradient(bar - w, 0, bar + w, 0);
      g.addColorStop(0, 'rgba(' + o.rgb + ',0)');
      g.addColorStop(0.5, 'rgba(' + o.rgb + ',' + (0.16 * o.alpha).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + o.rgb + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(bar - w, 0, w * 2, m.h);
    };
  };

  /* ---------- grid3d: a floor receding to a horizon ---------- */
  FIELDS.grid3d = function (cv, ctx, o) {
    var m = fit(cv, 1.5);
    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      var hz = m.h * 0.42, off = (t * 0.00013 * o.speed) % 1;
      ctx.strokeStyle = 'rgb(' + o.rgb + ')';
      ctx.lineWidth = m.dpr;
      /* rails converging on the vanishing point */
      for (var i = -14; i <= 14; i++) {
        ctx.globalAlpha = (0.13 - Math.abs(i) * 0.006) * o.alpha;
        if (ctx.globalAlpha <= 0) continue;
        ctx.beginPath();
        ctx.moveTo(m.w * 0.5 + i * m.w * 0.16, m.h);
        ctx.lineTo(m.w * 0.5 + i * m.w * 0.012, hz);
        ctx.stroke();
      }
      /* sleepers, spaced so they crowd toward the horizon */
      for (var j = 0; j < 22; j++) {
        var p = (j + off) / 22;
        var y = hz + (m.h - hz) * (p * p * p);
        ctx.globalAlpha = (0.16 * (1 - p * 0.55)) * o.alpha;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(m.w, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
  };

  /* ---------- hex: the hive. A pulse leaves the pointer and travels
       out through the comb, so the grid reads as a connected surface
       rather than a set of independent hovers. ---------- */
  FIELDS.hex = function (cv, ctx, o) {
    var m = fit(cv, 1.5), cells = [], R = 0;
    var px = -9999, py = -9999, pulses = [];
    function build() {
      m = fit(cv, 1.5);
      R = (o.size || 30) * m.dpr;
      cells.length = 0;
      var hw = Math.sqrt(3) * R, vh2 = R * 1.5;
      for (var row = -1; row * vh2 < m.h + R * 2; row++) {
        for (var col = -1; col * hw < m.w + hw * 2; col++) {
          cells.push({ x: col * hw + (row % 2 ? hw / 2 : 0), y: row * vh2, e: 0 });
        }
      }
    }
    build();
    addEventListener('resize', build, { passive: true });

    var host = cv.parentNode;
    if (!touch) {
      host.addEventListener('pointermove', function (e) {
        var r = cv.getBoundingClientRect();
        px = (e.clientX - r.left) * m.dpr; py = (e.clientY - r.top) * m.dpr;
      }, { passive: true });
      host.addEventListener('pointerleave', function () { px = py = -9999; }, { passive: true });
      host.addEventListener('pointerdown', function (e) {
        var r = cv.getBoundingClientRect();
        pulses.push({ x: (e.clientX - r.left) * m.dpr, y: (e.clientY - r.top) * m.dpr, t: 0 });
        if (pulses.length > 4) pulses.shift();
      }, { passive: true });
    }

    function hexPath(x, y, rr) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 30);
        var vx = x + rr * Math.cos(a), vy = y + rr * Math.sin(a);
        if (i) ctx.lineTo(vx, vy); else ctx.moveTo(vx, vy);
      }
      ctx.closePath();
    }

    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      var near = 210 * m.dpr;
      for (var i = pulses.length - 1; i >= 0; i--) {
        pulses[i].t += 0.016;
        if (pulses[i].t > 2.2) pulses.splice(i, 1);
      }
      for (var c = 0; c < cells.length; c++) {
        var ce = cells[c];
        var target = 0;
        var dx = ce.x - px, dy = ce.y - py;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < near) target = 1 - d / near;
        /* breathing, so the comb is alive before anyone touches it */
        target = Math.max(target, 0.16 + 0.12 * Math.sin(t * 0.0009 * o.speed + (ce.x + ce.y) * 0.006));
        for (var p = 0; p < pulses.length; p++) {
          var pu = pulses[p];
          var pd = Math.sqrt((ce.x - pu.x) * (ce.x - pu.x) + (ce.y - pu.y) * (ce.y - pu.y));
          var front = pu.t * 620 * m.dpr;
          var band = Math.abs(pd - front);
          if (band < 90 * m.dpr) target = Math.max(target, (1 - band / (90 * m.dpr)) * (1 - pu.t / 2.2));
        }
        ce.e = lerp(ce.e, target, 0.12);
        if (ce.e < 0.02) continue;
        hexPath(ce.x, ce.y, R * 0.9);
        ctx.strokeStyle = 'rgba(' + o.rgb + ',' + (ce.e * 0.62 * o.alpha).toFixed(3) + ')';
        ctx.lineWidth = m.dpr;
        ctx.stroke();
        if (ce.e > 0.42) {
          ctx.fillStyle = 'rgba(' + o.rgb + ',' + ((ce.e - 0.42) * 0.2 * o.alpha).toFixed(3) + ')';
          ctx.fill();
        }
      }
    };
  };

  /* ---------- mesh: motes on a slow curl, joined when close ---------- */
  FIELDS.mesh = function (cv, ctx, o) {
    var m = fit(cv, 1.5), pts = [], r = rng(o.seed);
    function build() {
      m = fit(cv, 1.5); pts.length = 0;
      var n = clamp(Math.round(m.cw * m.ch / 15000 * o.density), 18, 96);
      for (var i = 0; i < n; i++) pts.push({ x: r() * m.w, y: r() * m.h, p: r() * 6.28 });
    }
    build();
    addEventListener('resize', build, { passive: true });
    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      var link = 130 * m.dpr, a = t * 0.00022 * o.speed;
      for (var i = 0; i < pts.length; i++) {
        var q = pts[i];
        /* a cheap curl: two offset sines standing in for a flow field */
        q.x += Math.cos(a + q.y * 0.004 + q.p) * 0.42 * m.dpr;
        q.y += Math.sin(a + q.x * 0.004 + q.p) * 0.42 * m.dpr;
        if (q.x < -20) q.x = m.w + 20; if (q.x > m.w + 20) q.x = -20;
        if (q.y < -20) q.y = m.h + 20; if (q.y > m.h + 20) q.y = -20;
      }
      ctx.lineWidth = m.dpr;
      for (var j = 0; j < pts.length; j++) {
        for (var k = j + 1; k < pts.length; k++) {
          var dx = pts[j].x - pts[k].x, dy = pts[j].y - pts[k].y;
          var d = dx * dx + dy * dy;
          if (d > link * link) continue;
          ctx.strokeStyle = 'rgba(' + o.rgb + ',' + ((1 - Math.sqrt(d) / link) * 0.16 * o.alpha).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(pts[j].x, pts[j].y); ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(' + o.rgb + ',' + (0.4 * o.alpha).toFixed(3) + ')';
        ctx.fillRect(pts[j].x, pts[j].y, 1.6 * m.dpr, 1.6 * m.dpr);
      }
    };
  };

  /* ---------- contour: a topographic map that will not hold still ---------- */
  FIELDS.contour = function (cv, ctx, o) {
    var m = fit(cv, 1.4);
    return function (t) {
      m = fit(cv, 1.4);
      ctx.clearRect(0, 0, m.w, m.h);
      var a = t * 0.00016 * o.speed;
      var lines = Math.round(15 * o.density);
      ctx.lineWidth = m.dpr;
      for (var i = 0; i < lines; i++) {
        var base = (i / lines) * m.h * 1.25 - m.h * 0.12;
        ctx.globalAlpha = (0.055 + (i % 4 === 0 ? 0.075 : 0)) * o.alpha;
        ctx.strokeStyle = 'rgb(' + o.rgb + ')';
        ctx.beginPath();
        for (var x = 0; x <= m.w; x += 9 * m.dpr) {
          var n = Math.sin(x * 0.0042 + a + i * 0.4) * 22
                + Math.sin(x * 0.0017 - a * 1.6 + i * 0.9) * 34
                + Math.sin(x * 0.009 + a * 0.7) * 9;
          var y = base + n * m.dpr;
          if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
  };

  /* ---------- dust: motes with real depth, drifting up ---------- */
  FIELDS.dust = function (cv, ctx, o) {
    var m = fit(cv, 1.5), ps = [], r = rng(o.seed);
    function build() {
      m = fit(cv, 1.5); ps.length = 0;
      var n = clamp(Math.round(m.cw * m.ch / 7000 * o.density), 24, 170);
      for (var i = 0; i < n; i++) ps.push({ x: r(), y: r(), z: 0.2 + r() * 0.8, p: r() * 6.28 });
    }
    build();
    addEventListener('resize', build, { passive: true });
    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      for (var i = 0; i < ps.length; i++) {
        var q = ps[i];
        q.y -= 0.00006 * q.z * o.speed * 16;
        if (q.y < -0.05) { q.y = 1.05; q.x = (q.x + 0.37) % 1; }
        var x = (q.x + Math.sin(t * 0.0004 + q.p) * 0.012) * m.w;
        var sz = q.z * 2.4 * m.dpr;
        ctx.globalAlpha = q.z * 0.5 * o.alpha;
        ctx.fillStyle = 'rgb(' + o.rgb + ')';
        ctx.beginPath(); ctx.arc(x, q.y * m.h, sz, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
  };

  /* ---------- moire: two ring systems beating against each other ---------- */
  FIELDS.moire = function (cv, ctx, o) {
    var m = fit(cv, 1.4);
    return function (t) {
      m = fit(cv, 1.4);
      ctx.clearRect(0, 0, m.w, m.h);
      var a = t * 0.00008 * o.speed;
      var pts = [
        { x: m.w * (0.34 + Math.sin(a) * 0.08), y: m.h * (0.44 + Math.cos(a * 1.3) * 0.09) },
        { x: m.w * (0.68 + Math.cos(a * 0.8) * 0.09), y: m.h * (0.56 + Math.sin(a * 1.1) * 0.08) }
      ];
      ctx.lineWidth = m.dpr;
      var gap = 15 * m.dpr / o.density;
      for (var p = 0; p < pts.length; p++) {
        ctx.globalAlpha = 0.075 * o.alpha;
        ctx.strokeStyle = 'rgb(' + o.rgb + ')';
        for (var rad = gap; rad < Math.max(m.w, m.h) * 1.1; rad += gap) {
          ctx.beginPath(); ctx.arc(pts[p].x, pts[p].y, rad, 0, 6.283); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };
  };

  /* ---------- ledger: ruled paper with a travelling entry ---------- */
  FIELDS.ledger = function (cv, ctx, o) {
    var m = fit(cv, 1.5);
    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      var step = 30 * m.dpr / o.density;
      ctx.lineWidth = m.dpr;
      var lit = ((t * 0.00006 * o.speed) % 1) * m.h;
      for (var y = 0; y < m.h; y += step) {
        var d = Math.abs(y - lit);
        var glow = d < 120 * m.dpr ? (1 - d / (120 * m.dpr)) : 0;
        ctx.strokeStyle = 'rgba(' + o.rgb + ',' + ((0.05 + glow * 0.2) * o.alpha).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(m.w, y); ctx.stroke();
      }
      /* the two margin rules of a ledger page */
      ctx.strokeStyle = 'rgba(' + o.rgb + ',' + (0.13 * o.alpha).toFixed(3) + ')';
      [0.13, 0.87].forEach(function (f) {
        ctx.beginPath(); ctx.moveTo(m.w * f, 0); ctx.lineTo(m.w * f, m.h); ctx.stroke();
      });
    };
  };


  /* ---------- aurora: ribbons of light bent across the frame.
       Rendered at a fraction of device resolution and blurred, because
       that is what an aurora is — there is no detail to lose, and the
       blur is the whole effect. ---------- */
  FIELDS.aurora = function (cv, ctx, o) {
    var m = fit(cv, 0.55), r = rng(o.seed), bands = [];
    function build() {
      m = fit(cv, 0.55); bands.length = 0;
      var n = Math.max(3, Math.round(5 * o.density));
      for (var i = 0; i < n; i++) bands.push({
        y: 0.2 + r() * 0.6,
        amp: 0.04 + r() * 0.14,
        f1: 0.6 + r() * 1.6,
        f2: 1.3 + r() * 2.4,
        ph: r() * 6.283,
        sp: 0.4 + r() * 1.1,
        h: 0.1 + r() * 0.22,
        a: 0.45 + r() * 0.55
      });
    }
    build();
    addEventListener('resize', build, { passive: true });

    return function (t) {
      m = fit(cv, 0.55);
      ctx.clearRect(0, 0, m.w, m.h);
      ctx.globalCompositeOperation = o.blend ? 'multiply' : 'lighter';
      try { ctx.filter = 'blur(' + (m.w * 0.018).toFixed(1) + 'px)'; } catch (e) {}
      var a = t * 0.00016 * o.speed;
      var step = Math.max(6, m.w / 42);

      for (var i = 0; i < bands.length; i++) {
        var b = bands[i], H = b.h * m.h;
        var yAt = function (x) {
          var u = x / m.w;
          return (b.y
            + Math.sin(u * b.f1 * 6.283 + a * b.sp + b.ph) * b.amp
            + Math.sin(u * b.f2 * 6.283 - a * b.sp * 1.7 + b.ph) * b.amp * 0.42) * m.h;
        };
        ctx.beginPath();
        for (var x = -step; x <= m.w + step; x += step) ctx.lineTo(x, yAt(x) - H / 2);
        for (var x2 = m.w + step; x2 >= -step; x2 -= step) ctx.lineTo(x2, yAt(x2) + H / 2);
        ctx.closePath();
        var g = ctx.createLinearGradient(0, 0, m.w, m.h);
        g.addColorStop(0, 'rgba(' + o.rgb + ',0)');
        g.addColorStop(0.4, 'rgba(' + o.rgb + ',' + (0.3 * b.a * o.alpha).toFixed(3) + ')');
        g.addColorStop(0.75, 'rgba(' + o.rgb + ',' + (0.14 * b.a * o.alpha).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + o.rgb + ',0)');
        ctx.fillStyle = g;
        ctx.fill();
      }
      try { ctx.filter = 'none'; } catch (e) {}
      ctx.globalCompositeOperation = 'source-over';
    };
  };

  /* ---------- terrain: a wireframe landscape running at the viewer.
       Rows are spaced by 1/z rather than evenly, which is the whole
       difference between perspective and a stack of wavy lines. ---------- */
  FIELDS.terrain = function (cv, ctx, o) {
    var m = fit(cv, 1.4);
    function h(u, z) {
      return Math.sin(u * 2.1 + z * 0.34) * 0.5
           + Math.sin(u * 5.3 - z * 0.83) * 0.22
           + Math.sin(z * 0.47 + u * 0.9) * 0.3;
    }
    return function (t) {
      m = fit(cv, 1.4);
      ctx.clearRect(0, 0, m.w, m.h);
      var scroll = (t * 0.00042 * o.speed) % 1;
      var rows = Math.max(12, Math.round(24 * o.density)), cols = 44;
      var hz = m.h * 0.34;
      ctx.lineWidth = m.dpr;
      ctx.strokeStyle = 'rgb(' + o.rgb + ')';

      for (var i = rows; i >= 1; i--) {
        var z = i - scroll;
        if (z < 0.55) continue;
        var p = 1 / z;                       // the perspective divide
        var y = hz + (m.h - hz) * p;
        ctx.globalAlpha = Math.min(1, (1 - i / rows) * 0.62 + 0.03) * o.alpha;
        ctx.beginPath();
        for (var c = 0; c <= cols; c++) {
          var u = c / cols - 0.5;
          var x = m.w * 0.5 + u * m.w * p * 2.1;
          var py = y - h(u * 6, z) * m.h * 0.1 * p;
          if (c) ctx.lineTo(x, py); else ctx.moveTo(x, py);
        }
        ctx.stroke();
      }
      /* the horizon line, which is what makes it read as a landscape */
      ctx.globalAlpha = 0.3 * o.alpha;
      ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(m.w, hz); ctx.stroke();
      ctx.globalAlpha = 1;
    };
  };

  /* ---------- a shared low-resolution buffer.
       Per-pixel fields are drawn small and scaled up: at this blur there
       is no detail to lose, and it turns a full-frame pixel loop into a
       twenty-thousand pixel one. ---------- */
  function lowres(cv, ctx, o, divisor, shade) {
    var m = fit(cv, 1), off = document.createElement('canvas');
    var octx = off.getContext('2d'), img = null, W = 0, H = 0;
    function build() {
      m = fit(cv, 1);
      W = Math.max(24, Math.round(m.cw / divisor));
      H = Math.max(14, Math.round(m.ch / divisor));
      off.width = W; off.height = H;
      img = octx.createImageData(W, H);
    }
    build();
    addEventListener('resize', build, { passive: true });

    return function (t) {
      m = fit(cv, 1);
      if (!img || Math.abs(W - Math.round(m.cw / divisor)) > 2) build();
      var d = img.data, rgb = o.rgb.split(',');
      var cr = +rgb[0], cg = +rgb[1], cb = +rgb[2], i = 0;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var a = shade(x / W, y / H, t);
          d[i] = cr; d[i + 1] = cg; d[i + 2] = cb;
          d[i + 3] = a * 255 * o.alpha;
          i += 4;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, m.w, m.h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, m.w, m.h);
    };
  }

  /* ---------- plasma: domain-warped interference ---------- */
  FIELDS.plasma = function (cv, ctx, o) {
    return lowres(cv, ctx, o, 9, function (u, v, t) {
      var a = t * 0.00035 * o.speed;
      var wx = u * 6 + Math.sin(v * 4.1 + a) * 0.6;
      var wy = v * 6 + Math.cos(u * 3.7 - a * 0.8) * 0.6;
      var s = Math.sin(wx + a)
            + Math.sin(wy - a * 0.8)
            + Math.sin((wx + wy) * 0.7 + a * 0.6)
            + Math.sin(Math.sqrt(wx * wx + wy * wy) * 1.4 - a * 1.2);
      var n = (s + 4) / 8;
      return Math.pow(n, 2.6) * 0.62;
    });
  };

  /* ---------- caustics: the same machinery, a much harder transfer
       curve, which turns broad interference into thin filaments ---------- */
  FIELDS.caustics = function (cv, ctx, o) {
    return lowres(cv, ctx, o, 7, function (u, v, t) {
      var a = t * 0.00028 * o.speed;
      var s = Math.sin(u * 11 + a)
            + Math.sin(v * 13 - a * 0.9)
            + Math.sin((u + v) * 9 + a * 0.7)
            + Math.sin((u - v) * 15 - a * 0.5);
      var n = Math.abs(s) / 4;
      return Math.pow(1 - n, 7) * 0.7;
    });
  };

  /* ---------- circuit: Manhattan traces with a pulse running each one ---------- */
  FIELDS.circuit = function (cv, ctx, o) {
    var m = fit(cv, 1.5), paths = [], r = rng(o.seed);
    function build() {
      m = fit(cv, 1.5); paths.length = 0;
      var grid = 34 * m.dpr;
      var n = Math.max(8, Math.round(22 * o.density));
      for (var i = 0; i < n; i++) {
        var pts = [], x = Math.round(r() * m.w / grid) * grid, y = Math.round(r() * m.h / grid) * grid;
        pts.push([x, y]);
        var legs = 3 + Math.floor(r() * 4);
        for (var j = 0; j < legs; j++) {
          var len = (2 + Math.floor(r() * 6)) * grid;
          if (j % 2 === 0) x += r() > 0.5 ? len : -len; else y += r() > 0.5 ? len : -len;
          x = clamp(x, 0, m.w); y = clamp(y, 0, m.h);
          pts.push([x, y]);
        }
        /* total length, so the pulse travels at a constant speed */
        var seg = [], tot = 0;
        for (var k = 1; k < pts.length; k++) {
          var d = Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]);
          seg.push(d); tot += d;
        }
        paths.push({ pts: pts, seg: seg, tot: tot || 1, off: r(), sp: 0.4 + r() * 0.8 });
      }
    }
    build();
    addEventListener('resize', build, { passive: true });

    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      ctx.lineWidth = m.dpr;
      ctx.lineJoin = 'round';

      for (var i = 0; i < paths.length; i++) {
        var P = paths[i];
        ctx.globalAlpha = 0.13 * o.alpha;
        ctx.strokeStyle = 'rgb(' + o.rgb + ')';
        ctx.beginPath();
        ctx.moveTo(P.pts[0][0], P.pts[0][1]);
        for (var k = 1; k < P.pts.length; k++) ctx.lineTo(P.pts[k][0], P.pts[k][1]);
        ctx.stroke();

        /* pads at the ends, so a trace terminates in something */
        ctx.globalAlpha = 0.28 * o.alpha;
        ctx.beginPath();
        ctx.arc(P.pts[0][0], P.pts[0][1], 2.2 * m.dpr, 0, 6.283);
        ctx.arc(P.pts[P.pts.length - 1][0], P.pts[P.pts.length - 1][1], 2.2 * m.dpr, 0, 6.283);
        ctx.fillStyle = 'rgb(' + o.rgb + ')';
        ctx.fill();

        /* the pulse: walk the segments until the travelled distance lands */
        var trav = ((t * 0.00016 * o.speed * P.sp + P.off) % 1) * P.tot;
        var acc = 0;
        for (var s = 0; s < P.seg.length; s++) {
          if (acc + P.seg[s] >= trav) {
            var f = P.seg[s] ? (trav - acc) / P.seg[s] : 0;
            var px = lerp(P.pts[s][0], P.pts[s + 1][0], f);
            var py = lerp(P.pts[s][1], P.pts[s + 1][1], f);
            var g = ctx.createRadialGradient(px, py, 0, px, py, 16 * m.dpr);
            g.addColorStop(0, 'rgba(' + o.rgb + ',' + (0.85 * o.alpha).toFixed(3) + ')');
            g.addColorStop(1, 'rgba(' + o.rgb + ',0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(px, py, 16 * m.dpr, 0, 6.283); ctx.fill();
            break;
          }
          acc += P.seg[s];
        }
      }
      ctx.globalAlpha = 1;
    };
  };

  /* ---------- orbits: ellipse paths with bodies and trailing arcs ---------- */
  FIELDS.orbits = function (cv, ctx, o) {
    var m = fit(cv, 1.5), rings = [], r = rng(o.seed);
    function build() {
      m = fit(cv, 1.5); rings.length = 0;
      var n = Math.max(4, Math.round(8 * o.density));
      for (var i = 0; i < n; i++) rings.push({
        rx: 0.12 + (i / n) * 0.42 + r() * 0.05,
        ry: (0.12 + (i / n) * 0.42) * (0.28 + r() * 0.5),
        rot: r() * 3.14,
        sp: (0.35 + r() * 0.9) * (r() > 0.5 ? 1 : -1),
        ph: r() * 6.283,
        sz: 1.6 + r() * 2.4
      });
    }
    build();
    addEventListener('resize', build, { passive: true });

    return function (t) {
      m = fit(cv, 1.5);
      ctx.clearRect(0, 0, m.w, m.h);
      var cx = m.w * 0.5, cy = m.h * 0.5, base = Math.min(m.w, m.h);
      ctx.lineWidth = m.dpr;

      for (var i = 0; i < rings.length; i++) {
        var g2 = rings[i];
        var rx = g2.rx * base, ry = g2.ry * base;
        ctx.globalAlpha = 0.11 * o.alpha;
        ctx.strokeStyle = 'rgb(' + o.rgb + ')';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, g2.rot, 0, 6.283);
        ctx.stroke();

        var ang = t * 0.00022 * o.speed * g2.sp + g2.ph;
        /* the trail is an arc of the same ellipse, so it sits on the path */
        ctx.globalAlpha = 0.4 * o.alpha;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, g2.rot, ang - 0.5 * (g2.sp > 0 ? 1 : -1), ang, g2.sp < 0);
        ctx.stroke();

        var bx = cx + Math.cos(ang) * rx * Math.cos(g2.rot) - Math.sin(ang) * ry * Math.sin(g2.rot);
        var by = cy + Math.cos(ang) * rx * Math.sin(g2.rot) + Math.sin(ang) * ry * Math.cos(g2.rot);
        ctx.globalAlpha = 1;
        var rg = ctx.createRadialGradient(bx, by, 0, bx, by, g2.sz * 5 * m.dpr);
        rg.addColorStop(0, 'rgba(' + o.rgb + ',' + (0.95 * o.alpha).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(' + o.rgb + ',0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(bx, by, g2.sz * 5 * m.dpr, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
  };


  /* ---------- blueprint: a drawing rather than an atmosphere. Minor and
       major rules, registration crosses at the major intersections, and two
       slow compass arcs so it reads as drafting paper and not graph paper.
       This is the page-level ground for a page that wants to be somewhere
       else entirely. ---------- */
  FIELDS.blueprint = function (cv, ctx, o) {
    var m = fit(cv, 1.35);
    return function (t) {
      m = fit(cv, 1.35);
      ctx.clearRect(0, 0, m.w, m.h);
      var minor = Math.max(14, 34 * m.dpr / o.density);
      var major = minor * 5;
      var dx = (t * 0.0022 * o.speed) % major;
      var dy = (t * 0.0015 * o.speed) % major;
      var x, y;
      ctx.lineWidth = m.dpr;

      ctx.strokeStyle = 'rgba(' + o.rgb + ',' + (0.075 * o.alpha).toFixed(3) + ')';
      ctx.beginPath();
      for (x = -major + dx; x < m.w + major; x += minor) { ctx.moveTo(x, 0); ctx.lineTo(x, m.h); }
      for (y = -major + dy; y < m.h + major; y += minor) { ctx.moveTo(0, y); ctx.lineTo(m.w, y); }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(' + o.rgb + ',' + (0.21 * o.alpha).toFixed(3) + ')';
      ctx.beginPath();
      for (x = -major + dx; x < m.w + major; x += major) { ctx.moveTo(x, 0); ctx.lineTo(x, m.h); }
      for (y = -major + dy; y < m.h + major; y += major) { ctx.moveTo(0, y); ctx.lineTo(m.w, y); }
      ctx.stroke();

      /* registration crosses: the mark that says this is a drawing */
      var k = 5 * m.dpr;
      ctx.strokeStyle = 'rgba(' + o.rgb + ',' + (0.46 * o.alpha).toFixed(3) + ')';
      ctx.beginPath();
      for (x = -major + dx; x < m.w + major; x += major) {
        for (y = -major + dy; y < m.h + major; y += major) {
          ctx.moveTo(x - k, y); ctx.lineTo(x + k, y);
          ctx.moveTo(x, y - k); ctx.lineTo(x, y + k);
        }
      }
      ctx.stroke();

      /* two compass arcs, drifting slowly out of step */
      var a = t * 0.00004 * o.speed;
      ctx.strokeStyle = 'rgba(' + o.rgb + ',' + (0.24 * o.alpha).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(m.w * (0.24 + Math.sin(a) * 0.06), m.h * (0.7 + Math.cos(a * 1.3) * 0.07),
              Math.min(m.w, m.h) * 0.46, 0, 6.283);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.w * (0.78 + Math.cos(a * 0.8) * 0.05), m.h * (0.26 + Math.sin(a * 1.1) * 0.06),
              Math.min(m.w, m.h) * 0.34, 0, 6.283);
      ctx.stroke();
    };
  };

  /* Exposed for debugging only: a hidden or headless tab never runs a
     frame, so this is how a draw path gets exercised without one. */
  window.DTLab = { FIELDS: FIELDS, fit: fit };

  /* ---------- the mount ---------- */
  (function backgrounds() {
    $$('canvas[data-bg]').forEach(function (cv) {
      var kind = cv.getAttribute('data-bg');
      var make = FIELDS[kind];
      if (!make) return;
      var ctx = cv.getContext('2d');
      if (!ctx) return;

      var o = {
        rgb: '227,185,107',
        alpha: parseFloat(cv.getAttribute('data-alpha') || '1'),
        speed: parseFloat(cv.getAttribute('data-speed') || '1'),
        density: parseFloat(cv.getAttribute('data-density') || '1'),
        size: parseFloat(cv.getAttribute('data-size') || '30'),
        seed: parseInt(cv.getAttribute('data-seed') || '7', 10),
        blend: 0
      };
      /* the tint comes off the canvas's own host, so a field inside an
         inverted island keeps the bright accent while the page flips.
         --fx-blend says which way an additive field has to composite:
         lightening onto the dark ground, darkening onto paper. */
      onTheme(function () {
        o.rgb = tint(cv, '--fx-rgb', '227,185,107');
        o.blend = numvar(cv, '--fx-blend', 0) > 0.5 ? 1 : 0;
      });

      var step = make(cv, ctx, o);
      if (reduce) {
        /* one frame, then nothing: the field still reads as a texture */
        requestAnimationFrame(function () { step(4200); });
        addEventListener('resize', function () { step(4200); }, { passive: true });
        addEventListener('dt:theme', function () { requestAnimationFrame(function () { step(4200); }); });
        return;
      }
      var scene = cv.closest ? cv.closest('.scene') : null;
      loop(cv, step, scene ? function () { return scene.dataset.on !== '0'; } : null);
    });
  })();

  /* =========================================================
     3. MEDIA 01 — ORBITAL SPHERE CAROUSEL

     Tiles are placed by the golden-angle spiral, which is the only
     distribution that stays even at any count — a lat/long grid bunches
     at the poles and looks like a mistake. The sphere then rotates as
     one rigid body and each tile is projected per frame.
     ========================================================= */
  (function orbit() {
    $$('.orb').forEach(function (host) {
      var tiles = $$('.orb-t', host);
      if (!tiles.length) return;
      var read = $('.orb-read .swap', host.parentNode) || $('.orb-read .swap', host);
      var N = tiles.length, GOLD = Math.PI * (3 - Math.sqrt(5));

      var pts = tiles.map(function (el, i) {
        var y = 1 - (i / (N - 1)) * 2;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var th = i * GOLD;
        return { x: Math.cos(th) * r, y: y, z: Math.sin(th) * r };
      });

      var yaw = 0.4, pitch = -0.12, vy = 0, vp = 0;
      var tYaw = null, tPitch = null;          // a focus target, when there is one
      var idle = 0, near = -1, R = 260;
      var drag = false, lx = 0, ly = 0, moved = 0;

      function measure() {
        var r = host.getBoundingClientRect();
        R = Math.min(r.width, r.height) * 0.4;
        var cage = $('.orb-cage', host);
        if (cage) cage.style.setProperty('--r2', (R * 2) + 'px');
      }
      measure();
      addEventListener('resize', measure, { passive: true });

      host.addEventListener('pointerdown', function (e) {
        drag = true; moved = 0; lx = e.clientX; ly = e.clientY;
        tYaw = tPitch = null;
        host.classList.add('dragging');
        host.setPointerCapture && host.setPointerCapture(e.pointerId);
      });
      host.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - lx, dy = e.clientY - ly;
        lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        vy = dx * 0.0052; vp = -dy * 0.0042;
        yaw += vy; pitch = clamp(pitch + vp, -0.95, 0.95);
        idle = 0;
      });
      function end() { drag = false; host.classList.remove('dragging'); idle = 0; }
      host.addEventListener('pointerup', end);
      host.addEventListener('pointercancel', end);

      /* focus or click brings a tile to the front rather than jumping to it */
      function face(i) {
        var p = pts[i];
        var h = Math.sqrt(p.x * p.x + p.z * p.z);
        tYaw = Math.atan2(p.x, p.z);
        tPitch = clamp(Math.atan2(p.y, h), -0.95, 0.95);
        /* take the shortest way round rather than unwinding */
        while (tYaw - yaw > Math.PI) tYaw -= Math.PI * 2;
        while (tYaw - yaw < -Math.PI) tYaw += Math.PI * 2;
        vy = vp = 0; idle = -2400;
      }
      tiles.forEach(function (el, i) {
        el.addEventListener('focus', function () { face(i); });
        el.addEventListener('click', function () { if (moved < 8) face(i); });
      });
      host.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        var u = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
        if (!d && !u) return;
        e.preventDefault();
        tYaw = tPitch = null;
        yaw += d * 0.22; pitch = clamp(pitch + u * 0.16, -0.95, 0.95);
        idle = -1200;
      });

      function paint(t) {
        if (tYaw !== null) {
          yaw = lerp(yaw, tYaw, 0.11); pitch = lerp(pitch, tPitch, 0.11);
          if (Math.abs(tYaw - yaw) < 0.002) { yaw = tYaw; pitch = tPitch; tYaw = tPitch = null; }
        } else if (!drag) {
          yaw += vy; pitch = clamp(pitch + vp, -0.95, 0.95);
          vy *= 0.945; vp *= 0.93;
          idle += 16;
          /* the drift only resumes once the reader has finished with it */
          if (idle > 1400 && !reduce) yaw += 0.0016;
        }

        var cy = Math.cos(yaw), sy = Math.sin(yaw);
        var cp = Math.cos(pitch), sp = Math.sin(pitch);
        var best = -2, bi = 0;

        for (var i = 0; i < N; i++) {
          var p = pts[i];
          var x1 = p.x * cy - p.z * sy;
          var z1 = p.x * sy + p.z * cy;
          var y2 = p.y * cp - z1 * sp;
          var z2 = p.y * sp + z1 * cp;
          if (z2 > best) { best = z2; bi = i; }

          var d = (z2 + 1) / 2;                       // 0 far, 1 near
          var s = 0.5 + d * 0.66;
          var el = tiles[i];
          el.style.transform = 'translate3d(' + (x1 * R).toFixed(1) + 'px,' +
            (y2 * R).toFixed(1) + 'px,' + (z2 * R).toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
          el.style.opacity = (0.12 + d * 0.88).toFixed(3);
          el.style.filter = 'blur(' + ((1 - d) * 2.4).toFixed(2) + 'px)';
          el.style.zIndex = (100 + Math.round(d * 100));
        }

        if (bi !== near) {
          if (near > -1) tiles[near].classList.remove('is-near');
          near = bi;
          tiles[bi].classList.add('is-near');
          if (read) {
            read.innerHTML =
              '<span class="mono k">' + (tiles[bi].dataset.k || '') + '</span>' +
              '<h3>' + (tiles[bi].dataset.title || '') + '</h3>' +
              '<p>' + (tiles[bi].dataset.desc || '') + '</p>';
            /* restart the entrance without a reflow-forcing class dance */
            read.style.animation = 'none';
            void read.offsetWidth;
            read.style.animation = '';
          }
        }
      }
      loop(host, paint);
      paint(0);
    });
  })();

  /* =========================================================
     4. MEDIA 02 — CYLINDER CAROUSEL
     One axis, and a detent: the release snaps to the nearest facet, so
     the carousel always comes to rest square to the reader.
     ========================================================= */
  (function cylinder() {
    $$('.cyl').forEach(function (host) {
      var space = $('.cyl-space', host);
      var tiles = $$('.cyl-t', host);
      if (!space || !tiles.length) return;
      var N = tiles.length, step = 360 / N;

      var spin = 0, vel = 0, drag = false, lx = 0, moved = 0, front = -1, idle = 0, snap = null;
      /* the caption strip is a sibling of .stage, not a child of it */
      var sec  = host.closest('.lab-sec') || document;
      var prev = $('[data-cyl="prev"]', sec);
      var next = $('[data-cyl="next"]', sec);
      var prog = $('.cprog i', sec);

      function measure() {
        var r = host.getBoundingClientRect();
        /* offsetWidth, not the rect: these tiles sit under a perspective,
           so their rect is the projected size and feeding that back into
           the radius makes the radius climb on every measure */
        var tw = tiles[0].offsetWidth || 210;
        /* the radius that leaves a constant gap between neighbouring
           facets, whatever the count — not a number picked by eye */
        var rad = Math.max(tw * 1.05, (tw * 1.22) / (2 * Math.tan(Math.PI / N)));
        rad = Math.min(rad, r.width * 0.62);
        tiles.forEach(function (el, i) {
          el.style.setProperty('--a', (i * step) + 'deg');
          el.style.setProperty('--rad', rad.toFixed(1) + 'px');
        });
      }
      measure();
      addEventListener('resize', measure, { passive: true });

      function goto(i) { snap = -i * step; idle = -2600; vel = 0; }

      host.addEventListener('pointerdown', function (e) {
        drag = true; moved = 0; lx = e.clientX; snap = null;
        host.classList.add('dragging');
        host.setPointerCapture && host.setPointerCapture(e.pointerId);
      });
      host.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - lx; lx = e.clientX; moved += Math.abs(dx);
        vel = dx * 0.26; spin += vel; idle = 0;
      });
      function release() {
        if (!drag) return;
        drag = false; host.classList.remove('dragging');
        /* let the throw carry, then take the nearest detent */
        snap = Math.round((spin + vel * 6) / step) * step;
        idle = -2200;
      }
      host.addEventListener('pointerup', release);
      host.addEventListener('pointercancel', release);
      host.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;   // let the page scroll
        e.preventDefault();
        snap = null; vel = -e.deltaX * 0.12; spin += vel; idle = 0;
      }, { passive: false });

      if (prev) prev.addEventListener('click', function () { goto(((front + 1) % N + N) % N); });
      if (next) next.addEventListener('click', function () { goto(((front - 1) % N + N) % N); });
      tiles.forEach(function (el, i) {
        el.addEventListener('click', function () { if (moved < 8) goto(i); });
      });

      function paint() {
        if (snap !== null) {
          spin = lerp(spin, snap, 0.11);
          if (Math.abs(snap - spin) < 0.02) { spin = snap; snap = null; }
        } else if (!drag) {
          spin += vel; vel *= 0.93;
          idle += 16;
          if (idle > 1500 && !reduce) spin -= 0.045;
        }
        space.style.setProperty('--spin', spin.toFixed(2) + 'deg');

        var f = ((Math.round(-spin / step) % N) + N) % N;
        for (var i = 0; i < N; i++) {
          /* how square this facet is to the reader, 1 at the front */
          var a = (i * step + spin) * Math.PI / 180;
          var face = (Math.cos(a) + 1) / 2;
          tiles[i].style.setProperty('--dim', (0.72 - face * 0.62).toFixed(3));
        }
        if (f !== front) {
          if (front > -1) tiles[front].classList.remove('is-front');
          front = f; tiles[f].classList.add('is-front');
          if (prog) prog.style.setProperty('--p', ((f + 1) / N).toFixed(3));
        }
      }
      loop(host, paint);
      paint();
    });
  })();

  /* =========================================================
     5. MEDIA 03 — MOTIONFLOW RAIL
     Velocity is the only input. It drives position, skew, vertical
     stretch and the parallax of each photograph inside its frame, so
     one number produces the whole gesture instead of four timers.
     ========================================================= */
  (function motionflow() {
    $$('.flow').forEach(function (host) {
      var track = $('.flow-track', host);
      if (!track) return;
      var frames = $$('.flow-f', track);
      if (!frames.length) return;

      /* duplicate for the seam, exactly as the homepage ticker does */
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      $$('a', clone).forEach(function (a) { a.tabIndex = -1; });
      var wrap = document.createElement('div');
      wrap.style.display = 'flex'; wrap.style.width = 'max-content';
      track.parentNode.insertBefore(wrap, track);
      wrap.appendChild(track); wrap.appendChild(clone);
      var all = frames.concat($$('.flow-f', clone));

      var base = reduce ? 0 : parseFloat(host.dataset.speed || '-0.55');
      var x = 0, vel = base, half = 0;
      var drag = false, lx = 0;
      var meter = $('.flow-meter .bar i', host.closest('.lab-sec') || document);

      function measure() { half = track.getBoundingClientRect().width; }
      measure();
      addEventListener('resize', measure, { passive: true });
      if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);

      host.addEventListener('pointerdown', function (e) {
        drag = true; lx = e.clientX; host.classList.add('dragging');
        host.setPointerCapture && host.setPointerCapture(e.pointerId);
      });
      host.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - lx; lx = e.clientX;
        vel = clamp(dx, -70, 70);
      });
      function end() { drag = false; host.classList.remove('dragging'); }
      host.addEventListener('pointerup', end);
      host.addEventListener('pointercancel', end);
      host.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
        e.preventDefault();
        vel = clamp(vel - e.deltaX * 0.5, -70, 70);
      }, { passive: false });

      if (reduce) { measure(); return; }

      loop(host, function () {
        if (!drag) vel = lerp(vel, base, 0.06);
        x += vel;
        if (half > 0) { if (x <= -half) x += half; if (x > 0) x -= half; }
        wrap.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';

        var sk = clamp(-vel * 0.16, -11, 11);
        var sy = 1 + Math.min(Math.abs(vel) * 0.0035, 0.11);
        var px = clamp(vel * 1.5, -26, 26);
        for (var i = 0; i < all.length; i++) {
          all[i].style.setProperty('--sk', sk.toFixed(2) + 'deg');
          all[i].style.setProperty('--sy', sy.toFixed(3));
          var ph = all[i].firstElementChild;
          if (ph) ph.style.setProperty('--px', px.toFixed(1) + 'px');
        }
        if (meter) meter.style.setProperty('--v', clamp(vel / 40, -1, 1).toFixed(3));
      });
    });
  })();

  /* =========================================================
     6. MEDIA 04 — SLICE SLIDER
     Both frames move in the same direction at the same time, one beat
     apart per column, so the change reads as a shutter rather than
     a dissolve.
     ========================================================= */
  (function sliceSlider() {
    $$('[data-slice]').forEach(function (host) {
      var src = $$('.slice-src > li', host);
      if (!src.length) return;
      var COLS = parseInt(host.dataset.cols || '7', 10);
      var stage = host.closest('.lab-sec') || host.closest('.stage') || host;

      var slides = src.map(function (li) {
        return {
          img: li.dataset.img || '',
          title: li.dataset.title || '',
          k: li.dataset.k || '',
          n: li.dataset.n || '',
          pa: li.dataset.pa || '0',
          pb: li.dataset.pb || '0'
        };
      });
      host.style.setProperty('--cols', COLS);
      host.style.setProperty('--cwp', (100 / COLS) + '%');

      /* build every column x every frame once, then only move them */
      var cells = [];
      for (var c = 0; c < COLS; c++) {
        var col = document.createElement('div');
        col.className = 'slice-col';
        col.style.setProperty('--i', c);
        var row = [];
        for (var s = 0; s < slides.length; s++) {
          var sl = document.createElement('div');
          sl.className = 'sl';
          var win = document.createElement('div');
          win.className = 'win';
          if (slides[s].img) {
            var im = document.createElement('img');
            im.src = slides[s].img; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
            win.appendChild(im);
          } else {
            var pl = document.createElement('span');
            pl.className = 'gplate';
            pl.style.setProperty('--pa', slides[s].pa);
            pl.style.setProperty('--pb', slides[s].pb);
            win.appendChild(pl);
          }
          sl.appendChild(win);
          sl.style.setProperty('--sy', s === 0 ? '0%' : '104%');
          col.appendChild(sl);
          row.push(sl);
        }
        cells.push(row);
        host.appendChild(col);
      }

      var cur = 0, busy = false;
      var head = $('.slice-read .swap', stage);
      var nums = $('.slice-nums', stage);
      var thumbs = $$('.slice-th', stage);

      function paintHead() {
        if (head) {
          head.innerHTML = '<span class="mono k">' + slides[cur].k + '</span><h3>' + slides[cur].title + '</h3>';
          head.style.animation = 'none'; void head.offsetWidth; head.style.animation = '';
        }
        if (nums) nums.innerHTML = '<em>' + String(cur + 1).padStart(2, '0') + '</em> / ' + String(slides.length).padStart(2, '0');
        thumbs.forEach(function (b, i) { b.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
      }
      paintHead();

      function go(to, dir) {
        if (busy || to === cur) return;
        busy = true;
        var from = cur; cur = to;
        var out = dir > 0 ? '-104%' : '104%';
        var into = dir > 0 ? '104%' : '-104%';
        for (var c = 0; c < COLS; c++) {
          /* the stagger runs from the leading edge, which is what makes
             the two frames interleave instead of swapping as a block */
          var order = dir > 0 ? c : (COLS - 1 - c);
          var d = order * (reduce ? 0 : 46);
          var a = cells[c][from], b = cells[c][cur];
          a.style.transition = 'transform .74s var(--ease) ' + d + 'ms';
          b.style.transition = 'none';
          b.style.setProperty('--sy', into);
          void b.offsetWidth;
          b.style.transition = 'transform .74s var(--ease) ' + d + 'ms';
          a.style.setProperty('--sy', out);
          b.style.setProperty('--sy', '0%');
        }
        paintHead();
        setTimeout(function () { busy = false; }, reduce ? 60 : 820);
      }

      var prev = $('[data-slice-btn="prev"]', stage);
      var next = $('[data-slice-btn="next"]', stage);
      if (prev) prev.addEventListener('click', function () { go((cur - 1 + slides.length) % slides.length, -1); });
      if (next) next.addEventListener('click', function () { go((cur + 1) % slides.length, 1); });
      thumbs.forEach(function (b, i) {
        b.addEventListener('click', function () { go(i, i > cur ? 1 : -1); });
      });

      /* auto-advance, and stop for good once anyone takes it over */
      if (!reduce) {
        var timer = setInterval(function () {
          if (document.hidden) return;
          go((cur + 1) % slides.length, 1);
        }, 5600);
        ['pointerdown', 'keydown'].forEach(function (ev) {
          stage.addEventListener(ev, function () { clearInterval(timer); }, { once: true });
        });
      }
    });
  })();

  /* =========================================================
     7. MEDIA 05 — SCROLL GALLERY
     One scrubbed value for the whole pinned section. The columns, the
     plate that takes the screen and the caption all read the same --k,
     so they cannot fall out of step with each other.
     ========================================================= */
  (function scrollGallery() {
    var gals = $$('.gal');
    if (!gals.length) return;
    if (reduce) { gals.forEach(function (g) { g.style.setProperty('--k', '1'); }); return; }

    gals.forEach(function (g) {
      var pct = $('.gal-rail b', g);
      var hold = $('.gal-pin', g);
      var hero = $('.gal-hero', g);
      var drive = hold ? pin(g, hold) : null;
      var last = -1;

      /* The plate is laid out full-bleed, so its START scale is whatever
         makes it match a grid cell. Measured rather than guessed: the cell
         width comes out of a clamp() and the plate's out of max(). */
      function fitPlate() {
        if (!hero) return;
        var cell = $('.gal-i', g);
        var w = hero.offsetWidth;
        if (!cell || !w) return;
        g.style.setProperty('--s0', (cell.offsetWidth / w).toFixed(4));
      }
      fitPlate();
      addEventListener('resize', fitPlate, { passive: true });
      loop(g, function () {
        if (drive) drive();
        var k = progress(g, 'through');
        if (Math.abs(k - last) < 0.004) return;
        last = k;
        g.style.setProperty('--k', k.toFixed(4));
        if (pct) pct.textContent = String(Math.round(k * 100)).padStart(2, '0');
      });
      if (drive) drive();
    });
  })();

  /* =========================================================
     8. CARDS 01 — HIGHLIGHT CAROUSEL
     ========================================================= */
  (function highlight() {
    $$('.hl').forEach(function (host) {
      var ps = $$('.hl-p', host);
      if (!ps.length) return;
      var open = 0, dwell = parseInt(host.dataset.dwell || '5200', 10), timer = null, taken = false;

      function show(i) {
        open = i;
        ps.forEach(function (p, j) {
          var on = j === i;
          p.setAttribute('aria-expanded', on ? 'true' : 'false');
          p.style.setProperty('--g', on ? '4.6' : '1');
          var t = $('.hl-t', p);
          if (!t) return;
          t.style.transition = 'none';
          t.style.transform = 'scaleX(0)';
          if (on && !taken && !reduce) {
            void t.offsetWidth;
            t.style.transition = 'transform ' + dwell + 'ms linear';
            t.style.transform = 'scaleX(1)';
          }
        });
      }
      function tick() {
        clearTimeout(timer);
        if (taken || reduce) return;
        timer = setTimeout(function () { show((open + 1) % ps.length); tick(); }, dwell);
      }
      function take() { taken = true; clearTimeout(timer); ps.forEach(function (p) { var t = $('.hl-t', p); if (t) t.style.transform = 'scaleX(0)'; }); }

      ps.forEach(function (p, i) {
        p.addEventListener('click', function () { take(); show(i); });
        p.addEventListener('focus', function () { take(); show(i); });
        if (!touch) p.addEventListener('pointerenter', function () { take(); show(i); });
        p.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          var n = (i + d + ps.length) % ps.length;
          ps[n].focus();
        });
      });
      show(0); tick();
    });
  })();

  /* =========================================================
     9. CARDS 02 — THROW DECK
     The card follows the pointer while held, and past the threshold it
     keeps the direction it was thrown in rather than snapping to an
     axis — which is the difference between a deck and a slideshow.
     ========================================================= */
  (function throwDeck() {
    $$('.deck').forEach(function (host) {
      var cards = $$('.deck-c', host);
      if (!cards.length) return;
      var order = cards.map(function (_, i) { return i; });
      var n = cards.length;

      function layout() {
        order.forEach(function (ci, pos) {
          var c = cards[ci];
          c.style.setProperty('--i', pos);
          c.style.setProperty('--zi', n - pos);
          c.style.setProperty('--o', pos > 3 ? '0' : (1 - pos * 0.12).toFixed(2));
          c.style.setProperty('--rot', (pos === 0 ? 0 : ((ci % 2 ? 1 : -1) * (1.1 + pos * 0.5))).toFixed(2) + 'deg');
          c.setAttribute('data-top', pos === 0 ? '1' : '0');
          c.setAttribute('aria-hidden', pos > 3 ? 'true' : 'false');
          c.tabIndex = pos === 0 ? 0 : -1;
        });
      }
      function cycle() {
        var top = order.shift();
        order.push(top);
        var c = cards[top];
        c.classList.remove('drag');
        c.classList.add('fly');
        setTimeout(function () {
          c.classList.remove('fly');
          c.style.setProperty('--dx', '0px');
          c.style.setProperty('--dy', '0px');
          layout();
        }, 460);
        layout();
      }
      layout();

      var drag = false, sx = 0, sy = 0, dx = 0, dy = 0, active = null;
      host.addEventListener('pointerdown', function (e) {
        var c = e.target.closest('.deck-c');
        if (!c || c.getAttribute('data-top') !== '1') return;
        drag = true; active = c; sx = e.clientX; sy = e.clientY; dx = dy = 0;
        c.classList.add('drag');
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
      });
      host.addEventListener('pointermove', function (e) {
        if (!drag || !active) return;
        dx = e.clientX - sx; dy = e.clientY - sy;
        active.style.setProperty('--dx', dx.toFixed(1) + 'px');
        active.style.setProperty('--dy', dy.toFixed(1) + 'px');
        active.style.setProperty('--rot', (dx * 0.045).toFixed(2) + 'deg');
      });
      function release() {
        if (!drag || !active) return;
        drag = false;
        var c = active; active = null;
        c.classList.remove('drag');
        if (Math.abs(dx) > 110 || Math.abs(dy) > 130) {
          var m = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          c.classList.add('fly');
          c.style.setProperty('--dx', (dx / m * 940).toFixed(0) + 'px');
          c.style.setProperty('--dy', (dy / m * 940).toFixed(0) + 'px');
          c.style.setProperty('--o', '0');
          setTimeout(cycle, 260);
        } else {
          c.style.setProperty('--dx', '0px');
          c.style.setProperty('--dy', '0px');
          layout();
        }
      }
      host.addEventListener('pointerup', release);
      host.addEventListener('pointercancel', release);

      host.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var c = cards[order[0]];
        c.classList.add('fly');
        c.style.setProperty('--dx', '-880px');
        c.style.setProperty('--rot', '-14deg');
        c.style.setProperty('--o', '0');
        setTimeout(function () { cycle(); cards[order[n - 1]].blur(); cards[order[0]].focus(); }, 260);
      });

      var next = $('[data-deck="next"]', host.closest('.lab-sec') || document);
      if (next) next.addEventListener('click', function () {
        var c = cards[order[0]];
        c.classList.add('fly');
        c.style.setProperty('--dx', '-880px');
        c.style.setProperty('--rot', '-14deg');
        c.style.setProperty('--o', '0');
        setTimeout(cycle, 260);
      });
    });
  })();

  /* =========================================================
     10. CARDS 03 — BENTO MORPH
     The track list is the only thing animating. Nothing inside a cell
     is transformed, so the photographs stay sharp while the grid moves.
     ========================================================= */
  (function bentoMorph() {
    $$('.bento').forEach(function (host) {
      var cs = $$('.bento-c', host);
      if (!cs.length) return;
      var COLS = parseInt(host.dataset.cols || '3', 10);
      var BIG = 2.15, SMALL = 0.75, RB = 1.45, RS = 0.72;

      function set(i) {
        if (i < 0) {
          for (var c = 1; c <= COLS; c++) host.style.setProperty('--c' + c, '1fr');
          host.style.setProperty('--r1', '1fr'); host.style.setProperty('--r2', '1fr');
          cs.forEach(function (x) { x.classList.remove('on'); });
          return;
        }
        var col = i % COLS, row = Math.floor(i / COLS);
        for (var j = 0; j < COLS; j++) host.style.setProperty('--c' + (j + 1), (j === col ? BIG : SMALL) + 'fr');
        host.style.setProperty('--r1', (row === 0 ? RB : RS) + 'fr');
        host.style.setProperty('--r2', (row === 1 ? RB : RS) + 'fr');
        cs.forEach(function (x, j) { x.classList.toggle('on', j === i); });
      }
      cs.forEach(function (c, i) {
        if (!touch) {
          c.addEventListener('pointerenter', function () { set(i); });
        } else {
          c.addEventListener('click', function () { set(c.classList.contains('on') ? -1 : i); });
        }
        c.addEventListener('focus', function () { set(i); });
      });
      if (!touch) host.addEventListener('pointerleave', function () { set(-1); });
      host.addEventListener('focusout', function (e) {
        if (!host.contains(e.relatedTarget)) set(-1);
      });
      set(-1);
    });
  })();

  /* =========================================================
     11. CARDS 04 — SCROLL STACK
     Each card is keyed to how far the NEXT card has covered it, not to
     its own scroll position. Keyed to itself, a pinned card never
     finishes, so the whole stack stays half-dimmed at the bottom.
     ========================================================= */
  (function scrollStack() {
    $$('.stk').forEach(function (host) {
      var hold = $('.stk-pin', host);
      var cs = $$('.stk-c', host);
      if (!hold || cs.length < 2) return;
      cs.forEach(function (c, i) { c.style.setProperty('--i', i); });
      if (reduce) return;

      var n = cs.length;
      var drive = pin(host, hold);

      function paint() {
        drive();
        var k = progress(host, 'through');
        /* one card per step, with a settled beat at the end so the last
           card is readable rather than arriving as the section leaves */
        var t = k * (n - 0.35);
        for (var i = 0; i < n; i++) {
          var d = t - i;
          var arrive = clamp(d + 1, 0, 1);            // 0 below, 1 landed
          var behind = clamp(d, 0, n);                // cards landed since
          var e = 1 - Math.pow(1 - arrive, 3);        // ease the last of the travel out
          cs[i].style.setProperty('--ty', ((1 - e) * 64).toFixed(2) + 'vh');
          cs[i].style.setProperty('--sc', Math.max(0.8, 1 - behind * 0.052).toFixed(3));
          cs[i].style.setProperty('--br', Math.max(0.42, 1 - behind * 0.17).toFixed(3));
          /* fade the buried cards out over a band rather than switching
             them off at a threshold, which pops on a short stack */
          var deep = clamp(1 - (behind - 2.5) / 1.3, 0, 1);
          cs[i].style.setProperty('--op', (arrive * deep).toFixed(3));
          cs[i].style.setProperty('--zi', 10 + i);
        }
      }
      loop(host, paint);
      paint();
    });
  })();

  /* =========================================================
     12. CARDS 05 — TILT GRID
     ========================================================= */
  (function tiltGrid() {
    if (touch || reduce) return;
    $$('.tlt').forEach(function (host) {
      var inner = $('.tlt-in', host);
      if (!inner) return;
      var raf = 0, tx = 0, ty = 0;

      host.addEventListener('pointerenter', function () { host.classList.add('live'); });
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width;
        ty = (e.clientY - r.top) / r.height;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var rx = (0.5 - ty) * 13, ry = (tx - 0.5) * 15;
          inner.style.setProperty('--rx', rx.toFixed(2) + 'deg');
          inner.style.setProperty('--ry', ry.toFixed(2) + 'deg');
          inner.style.setProperty('--mx', (tx * 100).toFixed(1) + '%');
          inner.style.setProperty('--my', (ty * 100).toFixed(1) + '%');
          inner.style.setProperty('--mxr', (tx - 0.5).toFixed(3));
          inner.style.setProperty('--myr', (ty - 0.5).toFixed(3));
        });
      }, { passive: true });
      host.addEventListener('pointerleave', function () {
        host.classList.remove('live');
        inner.style.setProperty('--rx', '0deg');
        inner.style.setProperty('--ry', '0deg');
        inner.style.setProperty('--mxr', '0');
        inner.style.setProperty('--myr', '0');
      });
    });
  })();

  /* =========================================================
     13. TESTIMONIALS 01 — ORBIT
     ========================================================= */
  (function orbitQuotes() {
    $$('.oq').forEach(function (host) {
      /* .r2 is the slow decorative ring and comes first in the markup, so
         a bare .oq-ring lookup finds an empty span and the module bails */
      var ring = $('.oq-ring:not(.r2)', host) || $('.oq-ring', host);
      var avs = $$('.oq-a', ring || host);
      var core = $('.oq-core .swap', host);
      if (!ring || !avs.length) return;
      var N = avs.length, step = 360 / N, cur = -1, timer = null, taken = false;

      function measure() {
        var r = host.getBoundingClientRect();
        var d = Math.min(r.width, r.height) * 0.74;
        host.style.setProperty('--d0', d + 'px');
        $$('.oq-ring', host).forEach(function (rg) {
          if (!rg.classList.contains('r2')) rg.style.setProperty('--d', d + 'px');
        });
      }
      measure();
      addEventListener('resize', measure, { passive: true });

      avs.forEach(function (a, i) { a.style.setProperty('--a', (i * step) + 'deg'); });

      function show(i) {
        if (i === cur) return;
        cur = i;
        ring.style.setProperty('--spin', (-i * step) + 'deg');
        avs.forEach(function (a, j) { a.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
        if (core) {
          var a = avs[i];
          core.innerHTML =
            '<div class="oq-stars" aria-hidden="true">' + Array(5).join('|').split('|').map(function () {
              return '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M6 .6 7.5 4l3.7.4-2.8 2.5.8 3.7L6 8.7 2.8 10.6l.8-3.7L.8 4.4 4.5 4Z"/></svg>';
            }).join('') + '</div>' +
            '<blockquote>' + (a.dataset.quote || '') + '</blockquote>' +
            '<span class="mono who">' + (a.dataset.who || '') + '</span>' +
            '<span class="role">' + (a.dataset.role || '') + '</span>';
          core.style.animation = 'none'; void core.offsetWidth; core.style.animation = '';
        }
      }
      function tick() {
        clearTimeout(timer);
        if (taken || reduce) return;
        timer = setTimeout(function () { show((cur + 1) % N); tick(); }, 6200);
      }
      avs.forEach(function (a, i) {
        a.setAttribute('role', 'tab');
        a.addEventListener('click', function () { taken = true; clearTimeout(timer); show(i); });
        a.addEventListener('focus', function () { taken = true; clearTimeout(timer); show(i); });
        a.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          avs[(i + d + N) % N].focus();
        });
      });
      show(0); tick();
    });
  })();

  /* =========================================================
     14. TESTIMONIALS 02 — MARQUEE WALL
     The strip is duplicated so the -50% loop has something to run into.
     ========================================================= */
  (function marqueeWall() {
    $$('.wall-col > .strip, .tm-band > .strip, .sck-row > .strip').forEach(function (strip) {
      var kids = [].slice.call(strip.children);
      if (!kids.length) return;
      kids.forEach(function (k) {
        var c = k.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        $$('a,button', c).forEach(function (x) { x.tabIndex = -1; });
        strip.appendChild(c);
      });
    });
  })();

  /* =========================================================
     15. TESTIMONIALS 03 — SPOTLIGHT RAIL
     ========================================================= */
  (function spotlightRail() {
    $$('.spot').forEach(function (host) {
      var names = $$('.spot-n', host);
      var q = $('.spot-q .swap', host);
      var shot = $('.spot-shot', host);
      if (!names.length) return;
      var cur = -1;

      function show(i) {
        if (i === cur) return;
        cur = i;
        var n = names[i];
        names.forEach(function (b, j) {
          b.setAttribute('aria-selected', j === i ? 'true' : 'false');
          b.tabIndex = j === i ? 0 : -1;
        });
        if (q) {
          q.innerHTML =
            '<span class="mark" aria-hidden="true">&ldquo;</span>' +
            '<blockquote>' + (n.dataset.quote || '') + '</blockquote>' +
            '<div class="spot-by"><b>' + (n.dataset.who || '') + '</b><i class="dot"></i>' +
            '<em>' + (n.dataset.role || '') + '</em></div>' +
            '<div class="spot-figs">' + (n.dataset.figs || '').split('|').filter(Boolean).map(function (f) {
              var p = f.split('~');
              return '<div><b>' + p[0] + '</b><em>' + (p[1] || '') + '</em></div>';
            }).join('') + '</div>';
          q.style.animation = 'none'; void q.offsetWidth; q.style.animation = '';
        }
        if (shot) {
          var img = n.dataset.img;
          shot.innerHTML = (img
            ? '<img src="' + img + '" alt="" loading="lazy" decoding="async">'
            : '<span class="gplate" style="--pa:' + (i * 37) + ';--pb:' + (i * 3) + '"></span>')
            + '<span class="badge mono">' + (n.dataset.badge || '') + '</span>';
        }
        n.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
      }
      names.forEach(function (b, i) {
        b.setAttribute('role', 'tab');
        b.addEventListener('click', function () { show(i); });
        b.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          var nx = (i + d + names.length) % names.length;
          names[nx].focus(); show(nx);
        });
      });
      show(0);
    });
  })();

  /* =========================================================
     16. TESTIMONIALS 04 — COVERFLOW
     ========================================================= */
  (function coverflow() {
    $$('.cf').forEach(function (host) {
      var cards = $$('.cf-c', host);
      if (!cards.length) return;
      var N = cards.length, cur = Math.floor(N / 2);
      var drag = false, lx = 0, moved = 0, gap = 0;
      var stage = host.closest('.lab-sec') || host.closest('.stage') || host;
      var prog = $('.cprog i', stage);
      var lbl = $('[data-cf-label]', stage);

      function measure() {
        gap = clamp(cards[0].offsetWidth * 0.56, 110, 230);
        paint();
      }

      function paint() {
        cards.forEach(function (c, i) {
          var d = i - cur;
          var ad = Math.abs(d);
          c.style.setProperty('--off', (d * gap).toFixed(1));
          c.style.setProperty('--dep', (-ad * 132).toFixed(1));
          c.style.setProperty('--turn', clamp(-d * 34, -46, 46).toFixed(1));
          c.style.setProperty('--sc', Math.max(0.72, 1 - ad * 0.09).toFixed(3));
          c.style.setProperty('--op', ad > 3 ? '0' : (1 - ad * 0.2).toFixed(2));
          c.style.setProperty('--zi', (100 - ad));
          c.classList.toggle('is-on', d === 0);
          c.setAttribute('aria-hidden', ad > 3 ? 'true' : 'false');
          c.tabIndex = d === 0 ? 0 : -1;
        });
        if (prog) prog.style.setProperty('--p', ((cur + 1) / N).toFixed(3));
        if (lbl) lbl.textContent = String(cur + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
      }
      function go(i) { cur = clamp(i, 0, N - 1); paint(); }

      measure();
      addEventListener('resize', measure, { passive: true });

      host.addEventListener('pointerdown', function (e) {
        drag = true; moved = 0; lx = e.clientX;
        host.classList.add('dragging');
        host.setPointerCapture && host.setPointerCapture(e.pointerId);
      });
      host.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - lx; moved += Math.abs(dx);
        if (Math.abs(e.clientX - lx) > gap * 0.55) {
          go(cur - (dx > 0 ? 1 : -1));
          lx = e.clientX;
        }
      });
      function end() { drag = false; host.classList.remove('dragging'); }
      host.addEventListener('pointerup', end);
      host.addEventListener('pointercancel', end);
      cards.forEach(function (c, i) {
        c.addEventListener('click', function () { if (moved < 8) go(i); });
        c.addEventListener('focus', function () { go(i); });
      });
      host.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault(); go(cur + d);
      });
      var p = $('[data-cf="prev"]', stage), n = $('[data-cf="next"]', stage);
      if (p) p.addEventListener('click', function () { go(cur - 1); });
      if (n) n.addEventListener('click', function () { go(cur + 1); });
    });
  })();

  /* =========================================================
     17. TESTIMONIALS 05 — LEDGER
     grid-template-rows 0fr -> 1fr, so the row opens to its real height
     without anyone measuring it.
     ========================================================= */
  (function ledger() {
    $$('.ledg').forEach(function (host) {
      var rows = $$('.ledg-r', host);
      rows.forEach(function (r, i) {
        var h = $('.ledg-h', r), b = $('.ledg-b', r);
        if (!h || !b) return;
        var id = 'ledg-' + i + '-' + Math.random().toString(36).slice(2, 6);
        b.id = id;
        h.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
        h.setAttribute('aria-controls', id);
        r.classList.toggle('on', i === 0);
        h.addEventListener('click', function () {
          var on = !r.classList.contains('on');
          rows.forEach(function (o) {
            o.classList.remove('on');
            var oh = $('.ledg-h', o); if (oh) oh.setAttribute('aria-expanded', 'false');
          });
          if (on) { r.classList.add('on'); h.setAttribute('aria-expanded', 'true'); }
        });
      });
    });
  })();

  /* =========================================================
     18. CTA — MARQUEE STAMP: the headline resolves out of noise
     ========================================================= */
  (function typeMorph() {
    $$('.tm-h[data-scramble]').forEach(function (h) {
      var glyphs = '█▓▒░/\\|<>*#$%&0123456789';
      var text = h.textContent;
      var em = (h.dataset.em || '').trim();
      h.textContent = '';
      var sr = document.createElement('span');
      sr.className = 'sr-only'; sr.textContent = text;
      var vis = document.createElement('span');
      vis.setAttribute('aria-hidden', 'true');
      var spans = [];
      text.split('').forEach(function (ch) {
        if (ch === ' ') { vis.appendChild(document.createTextNode(' ')); return; }
        var s = document.createElement('span');
        s.className = 'sc'; s.textContent = ch;
        vis.appendChild(s); spans.push(s);
      });
      h.appendChild(sr); h.appendChild(vis);

      /* emphasise the one word that carries the sentence */
      if (em) {
        var idx = text.indexOf(em);
        if (idx > -1) {
          var solid = 0;
          text.split('').forEach(function (ch, i) {
            if (ch === ' ') return;
            if (i >= idx && i < idx + em.length) spans[solid].classList.add('it');
            solid++;
          });
        }
      }
      if (reduce || !('IntersectionObserver' in window)) return;

      var run = false;
      new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting || run) return;
        run = true;
        spans.forEach(function (s, i) {
          var real = s.textContent;
          var end = 220 + i * 28 + Math.random() * 180;
          var t0 = performance.now();
          s.classList.add('noise');
          (function step(now) {
            var e = now - t0;
            if (e >= end) { s.textContent = real; s.classList.remove('noise'); return; }
            if (Math.random() > 0.55) s.textContent = glyphs[(Math.random() * glyphs.length) | 0];
            requestAnimationFrame(step);
          })(t0);
        });
      }, { threshold: 0.3 }).observe(h);
    });
  })();

  /* =========================================================
     19. TEAM 01 — ORBIT
     ========================================================= */
  (function orbitTeam() {
    $$('.ot').forEach(function (host) {
      var ring = $('.ot-ring:not(.dash)', host) || $('.ot-ring', host);
      var ms = $$('.ot-m', ring || host);
      var core = $('.ot-core .swap', host);
      if (!ring || !ms.length) return;
      var N = ms.length, step = 360 / N, cur = -1, timer = null, taken = false;

      function measure() {
        var r = host.getBoundingClientRect();
        var d = Math.min(r.width, r.height) * 0.72;
        $$('.ot-ring', host).forEach(function (rg) {
          rg.style.setProperty('--d', (rg.classList.contains('dash') ? d * 1.16 : d) + 'px');
        });
      }
      measure();
      addEventListener('resize', measure, { passive: true });
      ms.forEach(function (m, i) { m.style.setProperty('--a', (i * step) + 'deg'); });

      function show(i) {
        if (i === cur) return;
        cur = i;
        ring.style.setProperty('--spin', (-i * step) + 'deg');
        ms.forEach(function (m, j) { m.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
        if (core) {
          var m = ms[i], img = m.dataset.img;
          core.innerHTML =
            '<span class="shot">' + (img
              ? '<img src="' + img + '" alt="" loading="lazy" decoding="async">'
              : '<span class="gplate" style="--pa:' + (i * 53) + ';--pb:' + (i * 4) + '"></span>') + '</span>' +
            '<h3>' + (m.dataset.name || '') + '</h3>' +
            '<span class="mono role">' + (m.dataset.role || '') + '</span>' +
            '<p>' + (m.dataset.bio || '') + '</p>';
          core.style.animation = 'none'; void core.offsetWidth; core.style.animation = '';
        }
      }
      function tick() {
        clearTimeout(timer);
        if (taken || reduce) return;
        timer = setTimeout(function () { show((cur + 1) % N); tick(); }, 5400);
      }
      ms.forEach(function (m, i) {
        m.addEventListener('click', function () { taken = true; clearTimeout(timer); show(i); });
        m.addEventListener('focus', function () { taken = true; clearTimeout(timer); show(i); });
        m.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!d) return;
          e.preventDefault(); ms[(i + d + N) % N].focus();
        });
      });
      show(0); tick();
    });
  })();

  /* =========================================================
     20. TEAM 02 — ROSTER
     The portrait is fixed-position and rides the pointer. It sits
     outside #scroller for the reason the nav does: a fixed element
     inside a transformed ancestor resolves against that ancestor.
     ========================================================= */
  (function roster() {
    var host = $('.rost');
    if (!host || touch || reduce) return;
    var follow = document.createElement('figure');
    follow.className = 'rost-follow';
    follow.setAttribute('aria-hidden', 'true');
    follow.style.margin = '0';
    document.body.appendChild(follow);

    var tx = 0, ty = 0, cx = 0, cy = 0, on = false, raf = 0;
    function run() {
      raf = requestAnimationFrame(run);
      cx = lerp(cx, tx, 0.14); cy = lerp(cy, ty, 0.14);
      follow.style.left = cx.toFixed(1) + 'px';
      follow.style.top = cy.toFixed(1) + 'px';
      if (!on && Math.abs(cx - tx) < 0.5 && Math.abs(cy - ty) < 0.5) { cancelAnimationFrame(raf); raf = 0; }
    }
    $$('.rost-r', host).forEach(function (r, i) {
      r.addEventListener('pointerenter', function () {
        var img = r.dataset.img;
        follow.innerHTML = img
          ? '<img src="' + img + '" alt="" loading="lazy" decoding="async">'
          : '<span class="gplate" style="--pa:' + (i * 61) + ';--pb:' + (i * 5) + '"></span>';
        on = true; follow.classList.add('on');
        if (!raf) run();
      });
      r.addEventListener('pointerleave', function () { on = false; follow.classList.remove('on'); });
    });
    host.addEventListener('pointermove', function (e) {
      tx = e.clientX + 130; ty = e.clientY;
      if (!raf) run();
    }, { passive: true });
  })();

  /* =========================================================
     21. TEAM 03 — DISCIPLINE HELIX
     Plates on a screw: angle from the index, height from the same
     index, so the column reads as one continuous thread.
     ========================================================= */
  (function helix() {
    $$('.helix-sp').forEach(function (sp) {
      var ps = $$('.helix-p', sp);
      if (!ps.length) return;
      var turns = parseFloat(sp.dataset.turns || '2');
      function measure() {
        var host = sp.closest('.helix') || sp.parentNode;
        var r = host.getBoundingClientRect();
        var rad = clamp(r.width * 0.2, 130, 300);
        var spread = r.height * 0.72;
        ps.forEach(function (p, i) {
          var f = ps.length > 1 ? i / (ps.length - 1) : 0.5;
          p.style.setProperty('--a', (f * 360 * turns).toFixed(1) + 'deg');
          p.style.setProperty('--ty', ((f - 0.5) * spread).toFixed(1) + 'px');
          p.style.setProperty('--rad', rad.toFixed(0) + 'px');
        });
      }
      measure();
      addEventListener('resize', measure, { passive: true });
    });
  })();

  /* =========================================================
     23. SCENES — a rig of full-bleed grounds, each arriving over the
     last a different way.

     One scrubbed value drives the whole rig. Scene i is fully present
     at t = i, so its arrival occupies t = i-1 -> i and its departure
     t = i -> i+1. Both are clamped, which is why the first scene never
     arrives and the last never leaves.

     The transitions themselves are CSS, keyed off --a (arrival) and
     --o (departure). Adding a seventh way in is one selector, not one
     more branch in here.
     ========================================================= */
  (function scenes() {
    $$('[data-scenes]').forEach(function (host) {
      var pinEl = $('.scenes-pin', host);
      var list = $$('.scene', host);
      if (!pinEl || list.length < 2) return;
      var N = list.length;

      list.forEach(function (s, i) { s.style.setProperty('--zi', i + 1); });

      /* one screen of travel per transition, plus half a screen at the
         end so the last scene can be read rather than glimpsed */
      host.style.height = ((N + 0.5) * 100) + 'vh';

      var rail = $('.scenes-rail', host);
      var dots = rail ? $$('span', rail) : [];

      if (reduce) {
        list.forEach(function (s) {
          s.dataset.on = '1';
          s.style.setProperty('--a', '1');
          s.style.setProperty('--o', '0');
        });
        dots.forEach(function (d) { d.classList.add('on'); });
        return;
      }

      var drive = pin(host, pinEl);
      var lastIdx = -1;

      function paint() {
        drive();
        var k = progress(host, 'through');
        /* capped at N-1: past that the rig is holding on the last scene,
           and letting t run on would start it departing into nothing */
        var t = Math.min(k * (N - 0.5), N - 1);

        for (var i = 0; i < N; i++) {
          var a = clamp(t - (i - 1), 0, 1);
          var o = clamp(t - i, 0, 1);
          var el = list[i];
          var on = (a > 0.0005 && o < 0.9995) ? '1' : '0';
          if (el.dataset.on !== on) el.dataset.on = on;
          if (on === '0') continue;
          el.style.setProperty('--a', a.toFixed(4));
          el.style.setProperty('--o', o.toFixed(4));
        }

        var idx = clamp(Math.round(t), 0, N - 1);
        if (idx !== lastIdx) {
          lastIdx = idx;
          for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('on', d === idx);
        }
      }
      loop(host, paint);
      paint();
    });
  })();

  /* =========================================================
     24. SCROLL SET-PIECES — one rig, six treatments.

     A tall [data-pin] section holds a viewport-height stage. This drives
     the stage's pin offset and writes --k across the section; every
     treatment below it is CSS reading that one value. Adding a seventh
     is a block of CSS, not a branch in here.
     ========================================================= */
  (function setpieces() {
    /* words first: the cascade needs each one addressable, and stamping
       the offsets here means the markup stays a paragraph */
    $$('[data-words]').forEach(function (el) {
      var em = (el.dataset.em || '').toLowerCase();
      var words = el.textContent.trim().split(/\s+/);
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = words.join(' ');
      var vis = document.createElement('span');
      vis.setAttribute('aria-hidden', 'true');
      var spread = parseFloat(el.dataset.spread || '0.82');
      words.forEach(function (w, i) {
        var sp = document.createElement('span');
        sp.className = 'wc-w' + (em && w.toLowerCase().replace(/[^a-z]/g, '') === em ? ' em' : '');
        sp.style.setProperty('--th', (i / words.length * spread).toFixed(4));
        sp.textContent = w;
        vis.appendChild(sp);
        if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
      });
      el.textContent = '';
      el.appendChild(sr);
      el.appendChild(vis);
    });

    $$('[data-pin]').forEach(function (host) {
      var stage = $('.pin-stage', host);
      if (!stage) return;
      var outs = $$('[data-k-out]', host);

      function write(k) {
        host.style.setProperty('--k', k.toFixed(4));
        for (var i = 0; i < outs.length; i++) {
          var el = outs[i];
          var max = parseFloat(el.getAttribute('data-k-max') || '100');
          var pad = parseInt(el.getAttribute('data-k-pad') || '3', 10);
          var v = String(Math.round(k * max));
          while (v.length < pad) v = '0' + v;
          el.textContent = v;
        }
      }

      if (reduce) { write(1); return; }

      var drive = pin(host, stage), last = -1;
      loop(host, function () {
        drive();
        var k = progress(host, 'through');
        if (Math.abs(k - last) < 0.003) return;
        last = k;
        write(k);
      });
      write(0);
    });
  })();

  /* =========================================================
     25. DRAFTING LIGHT — the pointer treatment for a page that has
     dropped the shared cursor and trail. One lerped radial over the
     page ground: it lights the drawing rather than leaving a mark on it.
     ========================================================= */
  (function draftingLight() {
    var g = document.getElementById('labGround');
    if (!g || g.dataset.lamp !== 'on' || touch || reduce) return;
    var tx = 50, ty = 50, cx = 50, cy = 50, raf = 0;
    function run() {
      raf = requestAnimationFrame(run);
      cx = lerp(cx, tx, 0.085); cy = lerp(cy, ty, 0.085);
      g.style.setProperty('--lx', cx.toFixed(2) + '%');
      g.style.setProperty('--ly', cy.toFixed(2) + '%');
      if (Math.abs(cx - tx) < 0.05 && Math.abs(cy - ty) < 0.05) { cancelAnimationFrame(raf); raf = 0; }
    }
    addEventListener('pointermove', function (e) {
      tx = e.clientX / innerWidth * 100;
      ty = e.clientY / innerHeight * 100;
      g.classList.add('lit');
      if (!raf) run();
    }, { passive: true });
    addEventListener('pointerleave', function () { g.classList.remove('lit'); }, { passive: true });
  })();

  /* =========================================================
     26. THE DIE — marks placed around a rim whose radius is the disc's,
     measured rather than guessed so it survives the clamp().
     ========================================================= */
  (function die() {
    $$('.die').forEach(function (host) {
      var disc = $('.die-disc', host);
      var marks = $$('.die-m', host);
      if (!disc || !marks.length) return;
      var step = 360 / marks.length;
      function measure() {
        var rad = disc.getBoundingClientRect().width / 2 + 34;
        marks.forEach(function (m, i) {
          m.style.setProperty('--a', (i * step).toFixed(2) + 'deg');
          m.style.setProperty('--rad', rad.toFixed(1) + 'px');
        });
      }
      measure();
      addEventListener('resize', measure, { passive: true });
    });
  })();

  /* =========================================================
     22. LAB HOUSEKEEPING
     ========================================================= */
  (function housekeeping() {
    /* the specimen plates get their engraving angle from their position,
       so no two rosettes on a page are cut the same way */
    $$('.gplate:not([style*="--pa"])').forEach(function (p, i) {
      p.style.setProperty('--pa', (i * 37) % 360);
      p.style.setProperty('--pb', (i * 3) % 12);
    });

    /* smooth scroll is transform-based, so an in-page jump has to drive
       the native scrollbar. dt-craft wires that for a[href^="#"] — this
       covers the lab's own section index, which uses buttons. */
    $$('[data-jump]').forEach(function (b) {
      b.addEventListener('click', function () {
        var el = document.getElementById(b.getAttribute('data-jump'));
        if (!el) return;
        var top = el.getBoundingClientRect().top + (window.scrollY || 0);
        var sc = document.getElementById('scroller');
        if (document.body.classList.contains('sscroll') && sc) {
          var m = /translate3d\(0(?:px)?,\s*(-?[\d.]+)px/.exec(sc.style.transform || '');
          top = el.getBoundingClientRect().top + (m ? -parseFloat(m[1]) : 0);
        }
        scrollTo({ top: Math.max(0, top - 40), behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  })();
})();
