/*! dt-craft - Digital Treasury craft layer
 *  See README.md for the markup hooks this expects.
 */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch  = matchMedia('(hover: none)').matches;

  /* =========================================================
     1. HERO SHADER — molten treasury field, cursor-reactive
     ========================================================= */
  (function shader() {
    var cv = document.getElementById('gl');
    var gl = cv.getContext('webgl', { antialias: false, alpha: true, powerPreference: 'high-performance' })
          || cv.getContext('experimental-webgl');
    if (!gl) { cv.style.display = 'none'; return; }

    var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

    var FS = [
      'precision highp float;',
      'uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uStr;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
      'float noise(vec2 p){',
      '  vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);',
      '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);',
      '}',
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}',
      'void main(){',
      '  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/min(uRes.x,uRes.y);',
      '  float t=uTime*0.055;',
      /* cursor displacement — a slow gravitational pull, not a gimmicky ripple */
      '  vec2 d=uv-uMouse;',
      '  float g=exp(-dot(d,d)*4.2)*uStr;',
      '  uv-=d*g*0.42;',
      '  vec2 sp=uv*1.55;',
      /* two-step domain warp = the marbled, poured-metal look */
      '  vec2 q=vec2(fbm(sp+t),fbm(sp+vec2(5.2,1.3)-t*0.8));',
      '  vec2 r=vec2(fbm(sp+3.4*q+vec2(1.7,9.2)+t*1.3),fbm(sp+3.4*q+vec2(8.3,2.8)-t*1.1));',
      '  float f=fbm(sp+3.2*r);',
      '  f=clamp(f,0.,1.);',
      '  vec3 ink   =vec3(0.031,0.035,0.051);',
      '  vec3 bronze=vec3(0.216,0.145,0.055);',
      '  vec3 gold  =vec3(0.780,0.596,0.286);',
      '  vec3 hot   =vec3(1.000,0.949,0.812);',
      '  vec3 col=mix(ink,bronze,smoothstep(0.24,0.56,f));',
      '  col=mix(col,gold,smoothstep(0.52,0.79,f));',
      '  col=mix(col,hot,smoothstep(0.80,0.97,f));',
      /* thin specular veins — the engraved highlight */
      '  float vein=pow(max(0.,length(r)-0.34),2.2)*1.5;',
      '  col+=gold*vein*0.45;',
      /* the cursor warms the metal where it passes */
      '  col+=vec3(0.62,0.46,0.20)*g*0.30;',
      '  float vig=1.0-smoothstep(0.42,1.28,length(uv));',
      '  col*=mix(0.30,1.0,vig);',
      '  gl_FragColor=vec4(col,1.0);',
      '}'
    ].join('\n');

    function mk(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
      return s;
    }
    var vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { cv.style.display = 'none'; return; }
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.style.display = 'none'; return; }
    gl.useProgram(pr);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(pr, 'uRes'),
        uTime = gl.getUniformLocation(pr, 'uTime'),
        uMouse = gl.getUniformLocation(pr, 'uMouse'),
        uStr = gl.getUniformLocation(pr, 'uStr');

    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    function size() {
      var w = cv.clientWidth, h = cv.clientHeight;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(uRes, cv.width, cv.height);
    }
    size();
    addEventListener('resize', size, { passive: true });

    var mx = 0, my = 0, tx = 0, ty = 0, str = 0, tstr = 0, vis = true, t0 = 0;

    if (!touch) {
      addEventListener('pointermove', function (e) {
        var r = cv.getBoundingClientRect();
        var mn = Math.min(r.width, r.height);
        tx = (e.clientX - r.left - r.width / 2) / mn;
        ty = (r.height / 2 - (e.clientY - r.top)) / mn;
        tstr = 1;
      }, { passive: true });
      addEventListener('pointerleave', function () { tstr = 0; }, { passive: true });
    }

    var io = new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }, { threshold: 0 });
    io.observe(cv);

    function frame(now) {
      requestAnimationFrame(frame);
      if (!vis) { t0 = now; return; }
      if (!t0) t0 = now;
      mx += (tx - mx) * 0.045; my += (ty - my) * 0.045;
      str += (tstr - str) * 0.035;
      gl.uniform1f(uTime, reduce ? 12.0 : (now - t0) * 0.001);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uStr, str);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  })();

  /* =========================================================
     1b. ATMOSPHERE — the hero's material, run dark, behind everything.
     Same fbm + domain warp as the hero so the page reads as one surface
     instead of a hero plus some blurred circles. Carries a cursor trail.
     ========================================================= */
  (function atmosphere() {
    var cv = document.getElementById('atmo');
    if (!cv) return;
    var gl = cv.getContext('webgl', { antialias: false, alpha: true, powerPreference: 'low-power' })
          || cv.getContext('experimental-webgl');
    if (!gl) { cv.style.display = 'none'; return; }

    var N = 16;                                  // trail samples
    var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var FS = [
      'precision mediump float;',
      'uniform vec2 uRes; uniform float uTime; uniform vec3 uTrail[16];',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
      ' return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}',
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}',
      'float seg(vec2 p, vec2 a, vec2 b, out float t){',
      ' vec2 pa=p-a,ba=b-a; float d=max(dot(ba,ba),1e-7);',
      ' t=clamp(dot(pa,ba)/d,0.0,1.0);',
      ' return length(pa-ba*t);}',
      'void main(){',
      '  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/min(uRes.x,uRes.y);',
      '  float t=uTime*0.021;',
      /* walk the ribbon once: gather both a glow and a displacement, so the
         cursor disturbs the metal like a fluid rather than just lighting it */
      '  float glow=0.0; vec2 push=vec2(0.0);',
      '  for(int i=0;i<15;i++){',
      '    vec3 A=uTrail[i]; vec3 B=uTrail[i+1];',
      '    if(A.z<=0.002 && B.z<=0.002) continue;',
      '    float k; float dd=seg(uv,A.xy,B.xy,k);',
      '    float str=mix(A.z,B.z,k);',
      /* older samples taper: tighter falloff and less light */
      '    float w=110.0+300.0*(1.0-str);',
      '    float g=exp(-dd*dd*w)*str;',
      '    glow+=g;',
      '    vec2 n=uv-mix(A.xy,B.xy,k);',
      '    push+=normalize(n+vec2(1e-5))*g*0.05;',
      '  }',
      '  glow=min(glow,1.6);',
      '  vec2 duv=uv-push;',
      '  vec2 q=vec2(fbm(duv*1.1+t),fbm(duv*1.1+vec2(4.3,1.7)-t*0.7));',
      '  float f=fbm(duv*1.1+2.4*q);',
      '  f=clamp(f,0.,1.);',
      '  vec3 ink   =vec3(0.031,0.035,0.051);',
      '  vec3 bronze=vec3(0.115,0.082,0.036);',
      '  vec3 warm  =vec3(0.230,0.170,0.072);',
      '  vec3 col=mix(ink,bronze,smoothstep(0.30,0.68,f));',
      '  col=mix(col,warm,smoothstep(0.70,0.96,f)*0.65);',
      '  col+=vec3(0.155,0.113,0.047)*glow;',
      '  gl_FragColor=vec4(col,1.0);',
      '}'
    ].join('\n');

    function mk(ty, src) {
      var sh = gl.createShader(ty); gl.shaderSource(sh, src); gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    }
    var vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { cv.style.display = 'none'; return; }
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.style.display = 'none'; return; }
    gl.useProgram(pr);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(pr, 'uRes'),
        uTime = gl.getUniformLocation(pr, 'uTime'),
        uTrail = gl.getUniformLocation(pr, 'uTrail');

    var dpr = Math.min(window.devicePixelRatio || 1, 1);
    function size() {
      cv.width = Math.max(1, Math.floor(cv.clientWidth * dpr));
      cv.height = Math.max(1, Math.floor(cv.clientHeight * dpr));
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(uRes, cv.width, cv.height);
    }
    size();
    addEventListener('resize', size, { passive: true });

    var trail = new Float32Array(N * 3);
    /* Sampling is paced by the FRAME, not by pointermove. A follower eases
       toward the raw cursor, so the gap between consecutive samples is bounded
       by the lerp — they always overlap, and the ribbon can never break.
       Throttling on pointermove was what made every tick visible. */
    var rawX = 0, rawY = 0, folX = 0, folY = 0, has = false;
    if (!touch && !reduce) {
      addEventListener('pointermove', function (e) {
        var mn = Math.min(cv.clientWidth, cv.clientHeight);
        rawX = (e.clientX - cv.clientWidth / 2) / mn;
        rawY = (cv.clientHeight / 2 - e.clientY) / mn;
        if (!has) { folX = rawX; folY = rawY; has = true; }
      }, { passive: true });
    }

    var t0 = 0, hidden = false;
    document.addEventListener('visibilitychange', function () { hidden = document.hidden; });

    function frame(now) {
      requestAnimationFrame(frame);
      if (hidden) { t0 = now; return; }
      if (!t0) t0 = now;

      if (has) {
        folX += (rawX - folX) * 0.30;
        folY += (rawY - folY) * 0.30;
        var dx = folX - trail[(N - 1) * 3], dy = folY - trail[(N - 1) * 3 + 1];
        // only lay a new sample once the follower has actually travelled
        if (dx * dx + dy * dy > 0.0000045) {
          for (var j = 0; j < (N - 1) * 3; j++) trail[j] = trail[j + 3];
          var e = (N - 1) * 3;
          trail[e] = folX; trail[e + 1] = folY; trail[e + 2] = 1;
        }
      }
      for (var i = 2; i < trail.length; i += 3) {
        if (trail[i] > 0) trail[i] = Math.max(0, trail[i] - 0.019);
      }

      gl.uniform1f(uTime, reduce ? 8.0 : (now - t0) * 0.001);
      gl.uniform3fv(uTrail, trail);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  })();

  /* the pointer-tracked highlight on lit surfaces */
  (function surfaceLight() {
    if (touch || reduce) return;
    var cards = [].slice.call(document.querySelectorAll('.quote, .inst'));
    if (!cards.length) return;
    addEventListener('pointermove', function (e) {
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i], r = c.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
        c.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      }
    }, { passive: true });
  })();

  /* =========================================================
     2. HEADLINE — per-character reveal (what SplitText does)
     ========================================================= */
  (function split() {
    var h = document.getElementById('h1');
    if (!h) return;
    var words = [], nodes = Array.prototype.slice.call(h.childNodes);
    h.textContent = '';
    var line = document.createElement('span'); line.className = 'line-mask'; h.appendChild(line);

    nodes.forEach(function (n) {
      var txt = n.textContent, italic = n.nodeType === 1 && n.classList.contains('it');
      txt.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { line.appendChild(document.createTextNode(' ')); return; }
        var ws = document.createElement('span');
        ws.style.display = 'inline-block'; ws.style.whiteSpace = 'nowrap';
        if (italic) ws.className = 'it';
        w.split('').forEach(function (c) {
          var s = document.createElement('span');
          s.className = 'ch'; s.textContent = c;
          s.style.opacity = '0';
          s.style.transform = 'translateY(0.9em) rotate(3deg)';
          ws.appendChild(s); words.push(s);
        });
        line.appendChild(ws);
      });
    });

    if (reduce) { words.forEach(function (s) { s.style.opacity = '1'; s.style.transform = 'none'; }); return; }
    words.forEach(function (s, i) {
      s.style.transition = 'opacity .8s cubic-bezier(.19,1,.22,1) ' + (i * 22 + 180) + 'ms, transform 1.15s cubic-bezier(.19,1,.22,1) ' + (i * 22 + 180) + 'ms';
    });
    requestAnimationFrame(function () {
      setTimeout(function () {
        words.forEach(function (s) { s.style.opacity = '1'; s.style.transform = 'none'; });
      }, 60);
    });
  })();

  /* =========================================================
     3a. SCRUB BANDS — split the text, then drive --k from scroll
     ========================================================= */
  (function scrub() {
    /* seeded, so the "random" offsets are identical on every load */
    function rng(seed) {
      var s = seed >>> 0;
      return function () { return (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    }

    var heads = [].slice.call(document.querySelectorAll('[data-split]'));
    heads.forEach(function (h, hi) {
      var text = h.textContent.trim();
      var mode = h.dataset.split;
      var spread = parseFloat(h.dataset.spread || '0.5');
      var em = (h.dataset.em || '').toLowerCase();
      var r = rng(9781 + hi * 733);

      var sr = document.createElement('span');
      sr.className = 'sr-only'; sr.textContent = text;

      var vis = document.createElement('span');
      vis.setAttribute('aria-hidden', 'true');

      var words = text.split(/\s+/);
      var totalChars = text.replace(/\s+/g, '').length;
      var ci = 0;

      words.forEach(function (w, wi) {
        var ws = document.createElement('span');
        ws.className = 'sw';

        if (mode === 'grid') {
          // characters slide in horizontally, in reading order
          w.split('').forEach(function (ch) {
            var c = document.createElement('span');
            c.className = 'sc'; c.textContent = ch;
            c.style.setProperty('--th', (ci / totalChars * spread + r() * 0.06).toFixed(3));
            c.style.setProperty('--jx', ((r() * 2 - 1) * 26).toFixed(1) + 'px');
            ws.appendChild(c); ci++;
          });
        } else {
          // word-level entrances (punch / rise)
          var p = document.createElement('span');
          p.className = 'sp' + (em && w.toLowerCase().replace(/[^a-z]/g, '') === em ? ' em' : '');
          p.textContent = w;
          p.style.setProperty('--th', (wi / words.length * spread).toFixed(3));
          ws.appendChild(p);
        }

        vis.appendChild(ws);
        if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
      });

      h.textContent = '';
      h.appendChild(sr);
      h.appendChild(vis);
    });

    /* the drive loop */
    var bands = [].slice.call(document.querySelectorAll('[data-band]')).map(function (el) {
      return { el: el, last: -1, ramp: parseFloat(el.dataset.ramp || '0.5') };
    });
    if (!bands.length) return;
    if (reduce) { bands.forEach(function (b) { b.el.style.setProperty('--k', '1'); }); return; }

    var vh = innerHeight;
    addEventListener('resize', function () { vh = innerHeight; }, { passive: true });

    (function loop() {
      requestAnimationFrame(loop);
      for (var i = 0; i < bands.length; i++) {
        var b = bands[i];
        var r = b.el.getBoundingClientRect();
        if (r.bottom < -vh * 0.5 || r.top > vh * 1.6) continue;
        // 0 as it enters from below, 1 once it has settled into the upper third
        var from = vh * 0.94, to = vh * (0.94 - b.ramp);
        var k = (from - r.top) / (from - to);
        k = k < 0 ? 0 : k > 1 ? 1 : k;
        // delta-gate: a settled band costs nothing
        if (Math.abs(k - b.last) > 0.008) {
          b.el.style.setProperty('--k', k.toFixed(3));
          b.last = k;
        }
      }
    })();
  })();

  /* =========================================================
     3. SCROLL REVEALS
     ========================================================= */
  (function reveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.rv'));
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); }); return;
    }
    var groups = new Map();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var p = e.target.parentElement;
        var n = groups.get(p) || 0; groups.set(p, n + 1);
        e.target.style.transitionDelay = Math.min(n, 5) * 85 + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.04 });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* =========================================================
     4. TICKER — duplicate track for a seamless loop
     ========================================================= */
  (function ticker() {
    document.querySelectorAll('.ticker-track').forEach(function (t) {
      var mover = document.createElement('div');
      mover.className = 'ticker-move';
      t.parentNode.insertBefore(mover, t);
      mover.appendChild(t);
      var clone = t.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      [].forEach.call(clone.querySelectorAll('a'), function (a) { a.tabIndex = -1; });
      mover.appendChild(clone);
    });
  })();

  /* =========================================================
     PARALLAX — depth planes drift against the scroll
     ========================================================= */
  (function parallax() {
    if (reduce) return;
    var els = [].slice.call(document.querySelectorAll('[data-depth]'));
    if (!els.length) return;
    var vh = innerHeight;
    addEventListener('resize', function () { vh = innerHeight; }, { passive: true });

    (function loop() {
      requestAnimationFrame(loop);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;   // skip well off-screen
        var off = (r.top + r.height / 2) - vh / 2;
        // `translate` composes with the drift keyframes' `transform` instead of fighting it
        el.style.translate = '0 ' + (-off * parseFloat(el.dataset.depth)).toFixed(1) + 'px';
      }
    })();
  })();

  /* =========================================================
     5. CURSOR + MAGNETIC BUTTONS
     ========================================================= */
  if (!touch && !reduce) {
    (function cursor() {
      var c = document.getElementById('cur');
      var cx = 0, cy = 0, px = 0, py = 0, has = false;
      addEventListener('pointermove', function (e) {
        cx = e.clientX; cy = e.clientY;
        if (!has) { px = cx; py = cy; has = true; c.classList.add('on'); }
      }, { passive: true });
      (function loop() {
        requestAnimationFrame(loop);
        px += (cx - px) * 0.18; py += (cy - py) * 0.18;
        c.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
      })();
      document.querySelectorAll('a, button, .svc, input[type=range]').forEach(function (el) {
        el.addEventListener('pointerenter', function () { c.classList.add('grow'); });
        el.addEventListener('pointerleave', function () { c.classList.remove('grow'); });
      });
    })();

    (function magnetic() {
      document.querySelectorAll('[data-mag]').forEach(function (el) {
        var rx = 0, ry = 0, tx = 0, ty = 0, raf = null;
        function run() {
          rx += (tx - rx) * 0.16; ry += (ty - ry) * 0.16;
          el.style.transform = 'translate(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px)';
          if (Math.abs(tx - rx) > 0.05 || Math.abs(ty - ry) > 0.05) { raf = requestAnimationFrame(run); }
          else { raf = null; el.style.transform = 'translate(' + tx + 'px,' + ty + 'px)'; }
        }
        function kick() { if (!raf) raf = requestAnimationFrame(run); }
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          tx = (e.clientX - (r.left + r.width / 2)) * 0.28;
          ty = (e.clientY - (r.top + r.height / 2)) * 0.42;
          kick();
        });
        el.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
      });
    })();
  }

  /* =========================================================
     6. SMOOTH SCROLL — the lerp Lenis performs for you
     ========================================================= */
  (function smooth() {
    if (reduce || touch || !('ResizeObserver' in window)) return;
    var vp = document.getElementById('vp'), sc = document.getElementById('scroller'), sp = document.getElementById('spacer');
    if (!vp || !sc || !sp) return;

    document.body.classList.add('sscroll');
    var cur = 0, tgt = 0, h = 0;

    function measure() { h = sc.scrollHeight; sp.style.height = h + 'px'; }
    measure();
    new ResizeObserver(measure).observe(sc);

    addEventListener('scroll', function () { tgt = window.scrollY || window.pageYOffset; }, { passive: true });

    (function loop() {
      requestAnimationFrame(loop);
      cur += (tgt - cur) * 0.088;
      if (Math.abs(tgt - cur) < 0.04) cur = tgt;
      sc.style.transform = 'translate3d(0,' + (-cur).toFixed(2) + 'px,0)';
    })();

    // in-page links must drive the native scrollbar, not the transform
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        // rect is the *visual* (transformed) position, so add the lerped offset
        var r = el.getBoundingClientRect();
        scrollTo({ top: Math.max(0, cur + r.top - 40), behavior: 'auto' });
      });
    });
  })();

  /* =========================================================
     7. THE INSTRUMENT — live ROI, with counted transitions
     ========================================================= */
  (function instrument() {
    var d = { 1: null, 2: null, 3: null, 4: null, 5: null };
    for (var k in d) d[k] = document.getElementById('d' + k);
    if (!d[1]) return;

    function fmt(n) { return Math.round(n).toLocaleString('en-AU'); }
    function money(n) { return '$' + fmt(n); }

    function paintTrack(el) {
      var pct = (el.value - el.min) / (el.max - el.min) * 100;
      el.style.setProperty('--pct', pct.toFixed(2) + '%');
    }

    /* --- Odometer: each digit is a 0–9 strip that slides to its target. --- */
    function Odo(el) { this.el = el; this.el.classList.add('odo'); this.cells = []; this.str = ''; }

    Odo.prototype.build = function (str) {
      this.el.textContent = '';
      this.cells = [];
      // screen readers get the plain value; the rolling columns are hidden from them
      this.sr = document.createElement('span');
      this.sr.className = 'odo-sr';
      this.sr.textContent = str;
      this.el.appendChild(this.sr);
      for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i);
        if (c >= '0' && c <= '9') {
          var d = document.createElement('span'); d.className = 'odo-d'; d.setAttribute('aria-hidden', 'true');
          var s = document.createElement('span'); s.className = 'odo-s';
          for (var n = 0; n < 10; n++) {
            var g = document.createElement('span'); g.className = 'odo-g'; g.textContent = n;
            s.appendChild(g);
          }
          d.appendChild(s); this.el.appendChild(d);
          this.cells.push({ t: 'd', node: d, strip: s, v: -1 });
        } else {
          var y = document.createElement('span'); y.className = 'odo-y'; y.textContent = c; y.setAttribute('aria-hidden', 'true');
          this.el.appendChild(y);
          this.cells.push({ t: 'y', node: y });
        }
      }
    };

    Odo.prototype.set = function (str, instant) {
      if (str === this.str) return;
      // a change in length (2,000 -> 45,000) needs new columns
      if (str.length !== this.cells.length) { this.build(str); instant = instant || false; }
      if (this.sr) this.sr.textContent = str;
      var moved = 0;
      for (var i = 0; i < str.length; i++) {
        var cell = this.cells[i], c = str.charAt(i);
        if (!cell) continue;
        if (cell.t === 'd') {
          var v = +c;
          if (cell.v !== v) {
            cell.strip.style.transitionDelay = (instant || reduce) ? '0ms' : Math.min(moved * 34, 200) + 'ms';
            cell.strip.style.transform = 'translateY(' + (-v * 10) + '%)';
            cell.v = v;
            moved++;
            if (!reduce && !instant) {
              cell.node.classList.add('hit');
              (function (n) { setTimeout(function () { n.classList.remove('hit'); }, 620); })(cell.node);
            }
          }
        } else if (cell.node.textContent !== c) {
          cell.node.textContent = c;
        }
      }
      this.str = str;
    };

    var odos = {};
    ['o1','o2','o3','o4','o5','o6'].forEach(function (id) { odos[id] = new Odo(document.getElementById(id)); });

    var big = document.getElementById('o5'), pulseT = null;
    function pulse() {
      if (reduce) return;
      big.classList.add('pulse');
      clearTimeout(pulseT);
      pulseT = setTimeout(function () { big.classList.remove('pulse'); }, 190);
    }

    function calc() {
      var visitors = +d[1].value, mult = +d[2].value, conv = +d[3].value, sales = +d[4].value, rev = +d[5].value;

      document.getElementById('v1').textContent = fmt(visitors);
      document.getElementById('v2').textContent = mult.toFixed(1) + '×';
      document.getElementById('v3').textContent = conv.toFixed(1) + '%';
      document.getElementById('v4').textContent = sales + '%';
      document.getElementById('v5').textContent = money(rev);
      [1,2,3,4,5].forEach(function (i) { paintTrack(d[i]); });

      var newV = visitors * mult;
      var addV = newV - visitors;
      var leads = addV * conv / 100;
      var sold = leads * sales / 100;
      var monthly = sold * rev;

      document.getElementById('stamp').textContent = mult > 1 ? 'Live' : 'Baseline';

      var prev = odos.o5.str;
      odos.o1.set(fmt(newV), seeding);
      odos.o2.set(fmt(addV), seeding);
      odos.o3.set(fmt(leads), seeding);
      odos.o4.set(fmt(sold), seeding);
      odos.o5.set(money(monthly), seeding);
      odos.o6.set(money(monthly * 12), seeding);
      if (!seeding && odos.o5.str !== prev) pulse();
    }

    /* the readouts spin up from zero the first time the panel is seen —
       a vault counter finding its number, rather than arriving pre-filled */
    function spinUp() {
      ['o1','o2','o3','o4','o5','o6'].forEach(function (id) {
        odos[id].set(odos[id].str.replace(/[0-9]/g, '0'), true);
      });
      // next frame, animate to the real figures
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { seeding = false; calc(); });
      });
    }
    if ('IntersectionObserver' in window && !reduce) {
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io2.disconnect(); spinUp(); } });
      }, { threshold: 0.35 });
      io2.observe(document.querySelector('.inst-r') || d[1]);
    }

    [1,2,3,4,5].forEach(function (i) {
      d[i].addEventListener('input', function () { seeding = false; calc(); });
      // scrolling the page over a dial must not nudge its value
      d[i].addEventListener('wheel', function (e) {
        e.preventDefault();
        window.scrollBy(0, e.deltaY);
      }, { passive: false });
    });

    // first paint lands without a roll; spinUp() releases it on first view,
    // and any dial input releases it too in case the observer never fires
    var seeding = true;
    calc();
    if (reduce || !('IntersectionObserver' in window)) seeding = false;
  })();

  /* =========================================================
     8. HOVER TEXT — re-type on buttons, tumbler scramble on the nav
     ========================================================= */
  (function hoverText() {

    /* ---- buttons and dropdown links: split into characters ---- */
    document.querySelectorAll('.btn-l, .mlink-t > b, .mfeat-n').forEach(function (lbl) {
      var txt = lbl.textContent;
      lbl.setAttribute('aria-label', txt);
      var frag = document.createDocumentFragment(), n = 0;
      txt.split('').forEach(function (c) {
        if (c === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
        var sp = document.createElement('span');
        sp.className = 'rc'; sp.textContent = c;
        sp.setAttribute('aria-hidden', 'true');
        sp.style.setProperty('--i', n);
        frag.appendChild(sp); n++;
      });
      lbl.textContent = '';
      lbl.appendChild(frag);
    });

    if (reduce || touch) return;

    /* ---- nav: characters cycle through cipher glyphs and resolve ---- */
    var GLYPHS = '0123456789#$%&*/\\|<>=+-';
    var targets = [].slice.call(document.querySelectorAll(
      '.nav-links a, .nav-trigger, .mega-hint, .foot-col a, .foot-legal a'));

    targets.forEach(function (el) {
      // only the element's own text is split; the chevron span is left alone
      var node = null;
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim()) { node = el.childNodes[i]; break; }
      }
      if (!node) return;
      var txt = node.textContent.trim();
      if (!txt) return;

      var sr = document.createElement('span');
      sr.className = 'sr-only'; sr.textContent = txt;

      var vis = document.createElement('span');
      vis.setAttribute('aria-hidden', 'true');
      var cells = [];
      txt.split('').forEach(function (c) {
        var sp = document.createElement('span');
        sp.className = 'sc-c'; sp.textContent = c;
        vis.appendChild(sp);
        cells.push({ el: sp, real: c });
      });

      node.parentNode.replaceChild(vis, node);
      el.insertBefore(sr, vis);

      /* Freeze each cell's width so the scramble cannot reflow proportional
         type. This MUST wait for the webfont: measuring against the fallback
         pins the wrong metrics and the label grows when the real face lands. */
      var pin = function () {
        cells.forEach(function (c) { c.el.style.width = ''; });
        cells.forEach(function (c) {
          var w = c.el.getBoundingClientRect().width;
          if (w > 0) { c.el.style.width = w.toFixed(2) + 'px'; }
        });
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(pin);
      else setTimeout(pin, 400);
      addEventListener('resize', pin, { passive: true });

      var raf = null, t0 = 0;
      var DUR = 460, STAGGER = 34;

      function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        cells.forEach(function (c) { c.el.textContent = c.real; c.el.removeAttribute('data-x'); });
      }

      function run(now) {
        if (!t0) t0 = now;
        var t = now - t0, done = true;
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i];
          if (c.real === ' ') continue;
          var settleAt = i * STAGGER + DUR * 0.45;
          if (t >= settleAt) {
            if (c.el.textContent !== c.real) { c.el.textContent = c.real; c.el.removeAttribute('data-x'); }
          } else {
            done = false;
            // re-roll roughly every other frame so it reads as tumbling, not noise
            if ((t / 55 | 0) % 2 === 0) {
              c.el.textContent = GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
              c.el.setAttribute('data-x', '1');
            }
          }
        }
        if (done) { stop(); return; }
        raf = requestAnimationFrame(run);
      }

      el.addEventListener('pointerenter', function () { stop(); t0 = 0; raf = requestAnimationFrame(run); });
      el.addEventListener('focus', function () { stop(); t0 = 0; raf = requestAnimationFrame(run); });
      el.addEventListener('pointerleave', stop);
      el.addEventListener('blur', stop);
    });
  })();


  /* =========================================================
     TESTIMONIAL RAIL — drag, arrows, progress
     ========================================================= */
  (function qrail() {
    var track = document.getElementById('qtrack');
    if (!track) return;
    var prev = document.getElementById('qprev'), next = document.getElementById('qnext');
    var bar = document.getElementById('qprogbar');

    function step() {
      var card = track.querySelector('.quote');
      return card ? card.getBoundingClientRect().width + 18 : 320;
    }
    function sync() {
      var max = track.scrollWidth - track.clientWidth;
      var frac = max > 0 ? track.scrollLeft / max : 0;
      var vis = track.clientWidth / track.scrollWidth;
      bar.style.width = Math.max(12, vis * 100) + '%';
      bar.style.transform = 'translateX(' + (frac * (100 / Math.max(vis, .0001) - 100)) + '%)';
      var atStart = track.scrollLeft <= 2;
      var atEnd = track.scrollLeft >= max - 2;
      prev.disabled = atStart;
      next.disabled = atEnd;
      // fade an edge only when a card is actually hidden behind it
      track.style.setProperty('--fade-l', atStart ? '0%' : '5%');
      track.style.setProperty('--fade-r', (atEnd || max <= 0) ? '0%' : '5%');
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left:  step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync, { passive: true });

    // wheel over the rail should scroll the page, not the rail sideways
    track.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;   // genuine horizontal intent
      e.preventDefault();
      window.scrollBy(0, e.deltaY);
    }, { passive: false });

    /* pointer drag */
    var down = false, sx = 0, sl = 0, moved = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; moved = 0;
      sx = e.clientX; sl = track.scrollLeft;
      track.classList.add('dragging');
    });
    addEventListener('pointermove', function (e) {
      if (!down) return;
      var d = e.clientX - sx;
      moved = Math.max(moved, Math.abs(d));
      track.scrollLeft = sl - d;
    });
    addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      track.classList.remove('dragging');
      // settle onto the nearest card
      var s = step();
      track.scrollTo({ left: Math.round(track.scrollLeft / s) * s, behavior: 'smooth' });
    });
    // a drag must not fire the link/hover underneath
    track.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);

    sync();
  })();

  /* =========================================================
     9. DISCIPLINES — hover/focus expands; auto-advances until you take over
     ========================================================= */
  (function disciplines() {
    var row = document.getElementById('drow');
    if (!row) return;
    var cards = [].slice.call(row.querySelectorAll('.dcard'));
    if (!cards.length) return;
    var dwell = parseInt(row.dataset.dwell, 10) || 7000;
    var i = 0, timer = null, taken = false, seen = false;

    function show(n, focusIt) {
      i = (n + cards.length) % cards.length;
      cards.forEach(function (c, k) {
        var on = k === i;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-selected', on ? 'true' : 'false');
        c.tabIndex = on ? 0 : -1;
        if (on && focusIt) c.focus();
      });
    }
    function queue() {
      clearTimeout(timer);
      if (reduce || taken || !seen) return;
      timer = setTimeout(function () { show(i + 1, false); queue(); }, dwell);
    }
    /* the first real interaction ends the rotation for good — nothing is more
       annoying than a panel that moves while you are reading it */
    function takeOver(n, focusIt) { taken = true; clearTimeout(timer); show(n, focusIt); }

    cards.forEach(function (c, k) {
      if (!touch) c.addEventListener('pointerenter', function () { takeOver(k, false); });
      c.addEventListener('click', function () { takeOver(k, false); });
      c.addEventListener('focus', function () { takeOver(k, false); });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); takeOver(k + 1, true); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); takeOver(k - 1, true); }
        else if (e.key === 'Home') { e.preventDefault(); takeOver(0, true); }
        else if (e.key === 'End') { e.preventDefault(); takeOver(cards.length - 1, true); }
        else if (e.key === 'Enter' || e.key === ' ') {
          var link = c.querySelector('.slink');
          if (link && c.classList.contains('is-on')) { e.preventDefault(); link.click(); }
        }
      });
    });

    /* the sheen follows the cursor across the open card */
    if (!touch && !reduce) {
      addEventListener('pointermove', function (e) {
        var open = row.querySelector('.dcard.is-on');
        if (!open) return;
        var sh = open.querySelector('.dsheen');
        if (!sh) return;
        var r = open.getBoundingClientRect();
        if (e.clientX < r.left - 80 || e.clientX > r.right + 80) return;
        sh.style.backgroundImage = 'radial-gradient(460px 340px at ' +
          (e.clientX - r.left).toFixed(0) + 'px ' + (e.clientY - r.top).toFixed(0) +
          'px, rgba(255,239,203,.09), transparent 68%)';
      }, { passive: true });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { seen = e.isIntersecting; if (seen) queue(); else clearTimeout(timer); });
      }, { threshold: 0.25 }).observe(row);
    } else { seen = true; }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer); else queue();
    });

    show(0, false);
  })();

  /* =========================================================
     13. DOT GRID — the calculator's ground. Each dot orbits on its own
     tilted plane when the pointer is near, and settles when it leaves.
     ========================================================= */
  (function dotGrid() {
    var cv = document.getElementById('dots');
    if (!cv || reduce) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var SPACING = 30, SIZE = 2.6, RADIUS = 130, HOVER_SCALE = 1.9, ORBIT = 1.4;

    var dots = [], W = 0, H = 0, mx = -9999, my = -9999, hovering = false, leaveTs = 0, prev = 0, angle = 0, raf = 0, vis = false;

    function smoothstep(t) { var c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); }

    function build() {
      dots = [];
      var cols = Math.ceil(W / SPACING) + 2, rows = Math.ceil(H / SPACING) + 2;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        dots.push({ bx: c * SPACING, by: r * SPACING,
          inc: Math.random() * Math.PI, asc: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2, spd: .7 + Math.random() * .6 });
      }
    }
    function size() {
      var r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    new ResizeObserver(size).observe(cv);
    size();

    var host = cv.parentNode;
    host.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top; hovering = true;
    }, { passive: true });
    host.addEventListener('pointerleave', function () {
      mx = my = -9999; hovering = false; leaveTs = performance.now();
    }, { passive: true });

    new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }, { threshold: 0 }).observe(cv);

    function loop(ts) {
      raf = requestAnimationFrame(loop);
      if (!vis || document.hidden) { prev = ts; return; }
      var dt = Math.min((ts - (prev || ts)) / 1000, .05); prev = ts;
      angle += ORBIT * dt;
      ctx.clearRect(0, 0, W, H);

      var since = hovering ? 0 : Math.max(0, ts - leaveTs) / 1000;
      var decay = hovering ? 1 : smoothstep(Math.max(0, 1 - since * 1.5));

      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var dx = d.bx - mx, dy = d.by - my;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var x = d.bx, y = d.by, scale = 1, alpha = .22;

        if (dist < RADIUS && dist > 0 && decay > 0) {
          var t = dist / RADIUS;
          var inf = smoothstep(1 - t) * decay;
          var orbitR = (1 - t) * SPACING * .7 * inf;
          var th = angle * d.spd + d.phase;
          var cosA = Math.cos(d.asc), sinA = Math.sin(d.asc);
          var lx = Math.cos(th), ly = Math.sin(th) * Math.cos(d.inc), lz = Math.sin(th) * Math.sin(d.inc);
          x = d.bx + (lx * cosA - ly * sinA) * orbitR;
          y = d.by + (lx * sinA + ly * cosA) * orbitR;
          var depth = .75 + .25 * ((lz + 1) * .5);
          scale = (1 + (HOVER_SCALE - 1) * inf) * depth;
          alpha = (.22 + .74 * inf) * depth;
        }
        ctx.beginPath();
        ctx.arc(x, y, SIZE / 2 * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(227,185,107,' + alpha.toFixed(3) + ')';
        ctx.fill();
      }
    }
    raf = requestAnimationFrame(loop);
  })();

  /* =========================================================
     14. MEGA MENU GROUND — a two-buffer water ripple drawn as glyphs,
     so the dropdown feels like a surface being disturbed.
     ========================================================= */
  /* One implementation, two surfaces: the mega menu and the footer.
     Two Float32 buffers propagate the wave; the result is drawn as glyphs. */
  function asciiRipple(cv, host, opts) {
    if (!cv || !host || reduce || touch) return;
    opts = opts || {};
    var ctx = cv.getContext('2d');
    var CHARS = ['\u00b7', '.', '-', '~', '=', '+', 'x', '*', 'o'];
    var LAST = CHARS.length - 1;
    var FONT = opts.font || 13, DAMP = opts.damping || .925, SPEED = .48;
    var MAXA = opts.maxAlpha || .3, STEPS = 14;
    var TINT = opts.tint || '227,185,107';
    var CSP = FONT * .85, RSP = FONT * 1.15;

    var pal = [];
    /* index 0 must not be fully transparent: most cells in a settled wave land
       there, and at alpha 0 the whole effect renders invisibly. Floor it. */
    for (var i = 0; i <= STEPS; i++) {
      pal.push('rgba(' + TINT + ',' + ((0.22 + 0.78 * (i / STEPS)) * MAXA).toFixed(3) + ')');
    }

    var W = 0, H = 0, cols = 0, rows = 0, b1, b2, raf = 0, sleeping = false, idle = 0;
    var mouse = { x: -1, y: -1, px: -1, py: -1 };

    function init() {
      var r = host.getBoundingClientRect();
      W = cv.width = Math.max(1, Math.round(r.width));
      H = cv.height = Math.max(1, Math.round(r.height));
      cols = Math.ceil(W / CSP) + 2; rows = Math.ceil(H / RSP) + 2;
      b1 = new Float32Array(cols * rows); b2 = new Float32Array(cols * rows);
      // seed here, not outside: init() re-runs on resize and reallocates both
      // buffers, which would wipe anything seeded before it
      if (opts.ambient) {
        for (var k = 0; k < 6; k++) drop(Math.random() * W, Math.random() * H, 4, 1.3);
      }
      /* Paint synchronously rather than calling wake(). init() re-runs from the
         ResizeObserver once the real height is known, and wake() no-ops while
         the loop is already awake — which left the corrected seed never drawn. */
      idle = 0; sleeping = false;
      if (raf) cancelAnimationFrame(raf);
      render();
    }
    new ResizeObserver(init).observe(host);

    function drop(x, y, rad, str) {
      var gx = Math.floor(x / CSP), gy = Math.floor(y / RSP);
      for (var r = -rad; r <= rad; r++) for (var c = -rad; c <= rad; c++) {
        var nx = gx + c, ny = gy + r;
        if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1) {
          var dd = c * c + r * r, rr = rad * rad;
          if (dd < rr) b1[ny * cols + nx] += str * (1 - dd / rr);
        }
      }
      wake();
    }
    function wake() { idle = 0; if (sleeping) { sleeping = false; render(); } }

    /* Ambient mode: the surface keeps a slow rain of drops going on its own, so
       the code is visibly there before anyone hovers. Only runs while on screen. */
    if (opts.ambient) {
      // a synchronous rect check decides whether to keep raining — no observer
      function onScreen() {
        var r = host.getBoundingClientRect();
        return r.top < innerHeight && r.bottom > 0;
      }
      setInterval(function () {
        if (document.hidden || !onScreen()) return;
        drop(Math.random() * W, Math.random() * H, 3 + (Math.random() * 2 | 0), 0.9 + Math.random() * 0.6);
      }, 850);
    }

    host.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      if (mouse.px === -1) { mouse.px = mouse.x; mouse.py = mouse.y; }
      var dx = mouse.x - mouse.px, dy = mouse.y - mouse.py;
      if (dx * dx + dy * dy > 4) { drop(mouse.x, mouse.y, 3, 1.5); mouse.px = mouse.x; mouse.py = mouse.y; }
    }, { passive: true });
    host.addEventListener('pointerleave', function () { mouse.px = mouse.py = -1; }, { passive: true });

    function render() {
      ctx.clearRect(0, 0, W, H);
      ctx.font = FONT + 'px "IBM Plex Mono", monospace';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      var active = 0;
      for (var y = 1; y < rows - 1; y++) {
        var ro = y * cols;
        for (var x = 1; x < cols - 1; x++) {
          var i = ro + x;
          b2[i] = (b1[i - 1] + b1[i + 1] + b1[i - cols] + b1[i + cols]) * SPEED - b2[i];
          b2[i] *= DAMP;
        }
      }
      var tmp = b1; b1 = b2; b2 = tmp;
      for (var y2 = 1; y2 < rows - 1; y2++) {
        var ro2 = y2 * cols, py = y2 * RSP;
        for (var x2 = 1; x2 < cols - 1; x2++) {
          var v = Math.abs(b1[ro2 + x2]);
          if (v > .014) {
            active++;
            ctx.fillStyle = pal[Math.min(v * 6 | 0, STEPS)];
            ctx.fillText(CHARS[Math.min(v * 2.2 | 0, LAST)], x2 * CSP, py);
          }
        }
      }
      // idle surfaces cost nothing
      if (!active) { if (++idle > 30) { sleeping = true; return; } } else idle = 0;
      raf = requestAnimationFrame(render);
    }
    init();   // seeds, paints, and starts the loop
  }

  asciiRipple(document.getElementById('megaFx'), document.getElementById('mega'), {});
  asciiRipple(document.getElementById('footFx'), document.querySelector('.site-foot'),
              { font: 14, maxAlpha: .38, ambient: true });

  /* =========================================================
     WORDMARK FIT — size the mark to its container, not the viewport.
     A vw-based clamp cannot know the container's padding, so at some
     widths the mark always overflowed and clipped.
     ========================================================= */
  (function fitWordmark() {
    var el = document.querySelector('.wordmark span');
    if (!el) return;
    var host = el.parentElement;
    function fit() {
      el.style.fontSize = '200px';
      var natural = el.scrollWidth;
      var avail = host.clientWidth;
      if (natural > 0 && avail > 0) {
        el.style.fontSize = Math.floor(200 * (avail / natural)) + 'px';
      }
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    else setTimeout(fit, 400);
    addEventListener('resize', fit, { passive: true });
  })();

  /* =========================================================
     16. PERF HUD — add ?perf=1 to the URL. Never runs otherwise.
     Frame time percentiles beat an average: the average hides the
     stalls people actually feel.
     ========================================================= */
  (function perfHud() {
    if (!/[?&]perf=1/.test(location.search)) return;

    var box = document.createElement('div');
    box.className = 'perf';
    box.innerHTML =
      '<h4>Performance</h4>' +
      '<div class="perf-row"><span>FPS</span><b id="pf-fps">--</b></div>' +
      '<div class="perf-row"><span>Frame p50</span><b id="pf-p50">--</b></div>' +
      '<div class="perf-row"><span>Frame p95</span><b id="pf-p95">--</b></div>' +
      '<div class="perf-row"><span>Worst</span><b id="pf-max">--</b></div>' +
      '<div class="perf-row"><span>Long tasks</span><b id="pf-lt">0</b></div>' +
      '<div class="perf-row"><span>JS heap</span><b id="pf-mem">n/a</b></div>' +
      '<div class="perf-row"><span>DPR / cores</span><b id="pf-dev">--</b></div>' +
      '<div class="perf-toggles">' +
        '<label><input type="checkbox" id="pf-fluid" checked> Fluid sim</label>' +
        '<label><input type="checkbox" id="pf-atmo" checked> Atmosphere</label>' +
        '<label><input type="checkbox" id="pf-hero" checked> Hero shader</label>' +
        '<label><input type="checkbox" id="pf-dots" checked> Dot grid</label>' +
        '<label><input type="checkbox" id="pf-grain" checked> Grain</label>' +
      '</div>' +
      '<p class="perf-note">Untick one, then move the pointer for 10s and watch p95. That difference is what the layer costs.</p>';
    document.body.appendChild(box);

    var $ = function (id) { return document.getElementById(id); };
    $('pf-dev').textContent = (devicePixelRatio || 1).toFixed(1) + ' / ' + (navigator.hardwareConcurrency || '?');

    /* toggles hide a layer AND stop its work, so the reading is honest */
    [['pf-fluid', '#fluid'], ['pf-atmo', '#atmo'], ['pf-hero', '#gl'], ['pf-dots', '#dots'], ['pf-grain', '.grain']]
      .forEach(function (p) {
        var cb = $(p[0]);
        if (!cb) return;
        cb.addEventListener('change', function () {
          var el = document.querySelector(p[1]);
          if (el) el.style.display = cb.checked ? '' : 'none';
        });
      });

    var longTasks = 0;
    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver(function (l) { longTasks += l.getEntries().length; })
          .observe({ entryTypes: ['longtask'] });
      } catch (e) { /* not supported everywhere */ }
    }

    var samples = [], last = 0, shownAt = 0;
    function tick(now) {
      requestAnimationFrame(tick);
      if (last) {
        var dt = now - last;
        samples.push(dt);
        if (samples.length > 180) samples.shift();
      }
      last = now;
      if (now - shownAt < 500 || samples.length < 20) return;
      shownAt = now;

      var sorted = samples.slice().sort(function (a, b) { return a - b; });
      var p50 = sorted[Math.floor(sorted.length * 0.5)];
      var p95 = sorted[Math.floor(sorted.length * 0.95)];
      var mx = sorted[sorted.length - 1];
      var fps = 1000 / p50;

      function set(id, v, warn, bad) {
        var el = $(id);
        el.textContent = v;
        el.className = v === '--' ? '' : (parseFloat(v) > bad ? 'bad' : parseFloat(v) > warn ? 'warn' : '');
      }
      $('pf-fps').textContent = fps.toFixed(0);
      $('pf-fps').className = fps < 45 ? 'bad' : fps < 55 ? 'warn' : '';
      set('pf-p50', p50.toFixed(1) + 'ms', 18, 25);
      set('pf-p95', p95.toFixed(1) + 'ms', 22, 34);
      set('pf-max', mx.toFixed(0) + 'ms', 50, 100);
      $('pf-lt').textContent = longTasks;
      $('pf-lt').className = longTasks > 8 ? 'bad' : longTasks > 3 ? 'warn' : '';
      if (performance.memory) {
        $('pf-mem').textContent = (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB';
      }
    }
    requestAnimationFrame(tick);
  })();

  /* =========================================================
     15. LIQUID FLUID — a real Navier-Stokes solver on the GPU.
     Splat velocity + dye where the pointer moves, advect, add vorticity,
     then project to a divergence-free field via Jacobi pressure iterations.
     Gated to four sections, so it only lives where it was asked for.
     ========================================================= */
  (function liquid() {
    if (reduce || touch) return;
    var cv = document.getElementById('fluid');
    if (!cv) return;
    var opts = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    var gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
    if (!gl) { cv.style.display = 'none'; return; }

    var half = gl.getExtension('OES_texture_half_float');
    var linear = gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('OES_texture_float');
    var TYPE = half ? half.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;
    var FILTER = (half && linear) ? gl.LINEAR : gl.NEAREST;

    /* ---------- plumbing ---------- */
    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    }
    var VERT = compile(gl.VERTEX_SHADER,
      'precision highp float;attribute vec2 a;varying vec2 vUv;varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;uniform vec2 px;' +
      'void main(){vUv=a*0.5+0.5;vL=vUv-vec2(px.x,0.);vR=vUv+vec2(px.x,0.);vT=vUv+vec2(0.,px.y);vB=vUv-vec2(0.,px.y);gl_Position=vec4(a,0.,1.);}');
    if (!VERT) { cv.style.display = 'none'; return; }

    function prog(fragSrc) {
      var fs = compile(gl.FRAGMENT_SHADER, fragSrc);
      if (!fs) return null;
      var p = gl.createProgram();
      gl.attachShader(p, VERT); gl.attachShader(p, fs); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      return { p: p, u: u };
    }

    var H = 'precision mediump float;precision mediump sampler2D;varying vec2 vUv;varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;';

    var pClear   = prog(H + 'uniform sampler2D uT;uniform float v;void main(){gl_FragColor=v*texture2D(uT,vUv);}');
    var pSplat   = prog(H + 'uniform sampler2D uT;uniform vec3 color;uniform vec2 point;uniform float radius;uniform float ratio;uniform float cap;' +
      'void main(){vec2 p=vUv-point;p.x*=ratio;vec3 splat=exp(-dot(p,p)/radius)*color;' +
      'gl_FragColor=vec4(min(texture2D(uT,vUv).xyz+splat,vec3(cap)),1.);}');
    var pAdvect  = prog(H + 'uniform sampler2D uVel;uniform sampler2D uSrc;uniform vec2 texel;uniform float dt;uniform float diss;' +
      'void main(){vec2 c=vUv-dt*texture2D(uVel,vUv).xy*texel;gl_FragColor=diss*texture2D(uSrc,c);gl_FragColor.a=1.;}');
    var pDiv     = prog(H + 'uniform sampler2D uVel;void main(){' +
      'float L=texture2D(uVel,vL).x;float R=texture2D(uVel,vR).x;float T=texture2D(uVel,vT).y;float B=texture2D(uVel,vB).y;' +
      'vec2 C=texture2D(uVel,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;' +
      'gl_FragColor=vec4(0.5*(R-L+T-B),0.,0.,1.);}');
    var pCurl    = prog(H + 'uniform sampler2D uVel;void main(){' +
      'float L=texture2D(uVel,vL).y;float R=texture2D(uVel,vR).y;float T=texture2D(uVel,vT).x;float B=texture2D(uVel,vB).x;' +
      'gl_FragColor=vec4(R-L-T+B,0.,0.,1.);}');
    var pVort    = prog(H + 'uniform sampler2D uVel;uniform sampler2D uCurl;uniform float curl;uniform float dt;void main(){' +
      'float L=texture2D(uCurl,vL).x;float R=texture2D(uCurl,vR).x;float T=texture2D(uCurl,vT).x;float B=texture2D(uCurl,vB).x;float C=texture2D(uCurl,vUv).x;' +
      'vec2 f=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+0.0001;f*=curl*C;f.y*=-1.;' +
      'vec2 v=texture2D(uVel,vUv).xy+f*dt;v=clamp(v,-1000.,1000.);gl_FragColor=vec4(v,0.,1.);}');
    var pPress   = prog(H + 'uniform sampler2D uPress;uniform sampler2D uDiv;void main(){' +
      'float L=texture2D(uPress,vL).x;float R=texture2D(uPress,vR).x;float T=texture2D(uPress,vT).x;float B=texture2D(uPress,vB).x;' +
      'float d=texture2D(uDiv,vUv).x;gl_FragColor=vec4((L+R+B+T-d)*0.25,0.,0.,1.);}');
    var pGrad    = prog(H + 'uniform sampler2D uPress;uniform sampler2D uVel;void main(){' +
      'float L=texture2D(uPress,vL).x;float R=texture2D(uPress,vR).x;float T=texture2D(uPress,vT).x;float B=texture2D(uPress,vB).x;' +
      'vec2 v=texture2D(uVel,vUv).xy-vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}');
    /* the composite is where the section gating happens */
    var pDraw    = prog(H + 'uniform sampler2D uT;uniform vec4 r0;uniform vec4 r1;uniform vec4 r2;uniform vec4 r3;uniform vec4 rEx;' +
      'float inRect(vec2 p, vec4 r){vec2 a=smoothstep(r.xy,r.xy+0.03,p);vec2 b=smoothstep(r.zw,r.zw-0.03,p);return a.x*a.y*b.x*b.y;}' +
      'void main(){vec3 c=texture2D(uT,vUv).rgb;' +
      'float m=max(max(inRect(vUv,r0),inRect(vUv,r1)),max(inRect(vUv,r2),inRect(vUv,r3)));' +
      /* the calculator is its own room and is subtracted outright, with a hard
         edge so nothing bleeds across its threshold */
      'float ex=inRect(vUv,rEx);' +
      'm*=(1.0-smoothstep(0.0,0.25,ex));' +
      'float lum=max(c.r,max(c.g,c.b));' +
      'float a=clamp(lum*1.35,0.0,1.0)*m*0.82;' +
      'gl_FragColor=vec4(c*1.05,a);}');

    if (!pClear || !pSplat || !pAdvect || !pDiv || !pCurl || !pVort || !pPress || !pGrad || !pDraw) {
      cv.style.display = 'none'; return;
    }

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
    var idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    function blit(target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function fbo(w, h, fmt) {
      gl.activeTexture(gl.TEXTURE0);
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, FILTER);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, FILTER);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt, TYPE, null);
      var f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex: tex, fbo: f, w: w, h: h,
        attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
    }
    function dbl(w, h, fmt) {
      var a = fbo(w, h, fmt), b = fbo(w, h, fmt);
      return { w: w, h: h, get read() { return a; }, get write() { return b; },
               swap: function () { var t = a; a = b; b = t; } };
    }

    var SIM = 160, DYE = 640;
    var simW, simH, dyeW, dyeH, vel, dye, div, curl, press;

    function initFBOs() {
      var ar = cv.width / cv.height;
      simW = Math.round(ar > 1 ? SIM * ar : SIM); simH = Math.round(ar > 1 ? SIM : SIM / ar);
      dyeW = Math.round(ar > 1 ? DYE * ar : DYE); dyeH = Math.round(ar > 1 ? DYE : DYE / ar);
      vel = dbl(simW, simH, gl.RGBA);
      dye = dbl(dyeW, dyeH, gl.RGBA);
      div = fbo(simW, simH, gl.RGBA);
      curl = fbo(simW, simH, gl.RGBA);
      press = dbl(simW, simH, gl.RGBA);
    }
    function size() {
      var w = Math.floor(cv.clientWidth * Math.min(devicePixelRatio || 1, 1));
      var h = Math.floor(cv.clientHeight * Math.min(devicePixelRatio || 1, 1));
      if (cv.width === w && cv.height === h) return;
      cv.width = Math.max(1, w); cv.height = Math.max(1, h);
      initFBOs();
    }
    size();
    addEventListener('resize', size, { passive: true });

    /* ---------- input ---------- */
    /* Queue every move and subdivide long jumps into several splats, so a fast
       flick lays a continuous stroke of force instead of two isolated dots. */
    var queue = [], lag = [[0, 0]], px = 0, py = 0, hasP = false;
    addEventListener('pointermove', function (e) {
      var nx = e.clientX / cv.clientWidth, ny = 1 - e.clientY / cv.clientHeight;
      if (!hasP) { px = nx; py = ny; hasP = true; return; }
      var dx = nx - px, dy = ny - py;
      var travel = Math.sqrt(dx * dx + dy * dy);
      if (travel < 0.006) return;              // holding still deposits nothing
      var steps = Math.min(8, Math.max(1, Math.ceil(travel / 0.012)));
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        queue.push([px + dx * t, py + dy * t, dx / steps * 900, dy / steps * 900]);
      }
      px = nx; py = ny;
      if (queue.length > 40) queue.splice(0, queue.length - 40);
    }, { passive: true });

    /* Velocity goes in at the pointer — that is the force. Dye goes in a step
       BEHIND it and is capped, so the brightest ink trails the cursor instead
       of sitting under it as a disc. */
    function splat(x, y, dx, dy, col, lagX, lagY) {
      gl.viewport(0, 0, simW, simH);
      gl.useProgram(pSplat.p);
      gl.uniform1i(pSplat.u.uT, vel.read.attach(0));
      gl.uniform1f(pSplat.u.ratio, cv.width / cv.height);
      gl.uniform2f(pSplat.u.point, x, y);
      gl.uniform3f(pSplat.u.color, dx, dy, 0);
      gl.uniform1f(pSplat.u.radius, 0.00065);
      gl.uniform1f(pSplat.u.cap, 1000.0);
      blit(vel.write); vel.swap();

      gl.viewport(0, 0, dyeW, dyeH);
      gl.uniform1i(pSplat.u.uT, dye.read.attach(0));
      gl.uniform2f(pSplat.u.point, lagX, lagY);
      gl.uniform3f(pSplat.u.color, col[0], col[1], col[2]);
      gl.uniform1f(pSplat.u.radius, 0.00085);
      gl.uniform1f(pSplat.u.cap, 0.26);
      blit(dye.write); dye.swap();
    }

    /* ---------- which sections it lives in ---------- */
    var sel = ['#services', '#work', '#clients', '#contact'];
    var rects = [[2,2,2,2],[2,2,2,2],[2,2,2,2],[2,2,2,2]];   // offscreen by default
    var exRect = [2,2,2,2];
    function norm(el) {
      var r = el.getBoundingClientRect();
      // normalised, y flipped to match GL uv
      return [r.left / innerWidth, 1 - r.bottom / innerHeight,
              r.right / innerWidth, 1 - r.top / innerHeight];
    }
    function measure() {
      for (var i = 0; i < 4; i++) {
        var el = document.querySelector(sel[i]);
        rects[i] = el ? norm(el) : [2,2,2,2];
      }
      var ex = document.querySelector('#instrument');
      exRect = ex ? norm(ex) : [2,2,2,2];
    }

    var last = 0, hidden = false;
    document.addEventListener('visibilitychange', function () { hidden = document.hidden; });

    function step(now) {
      requestAnimationFrame(step);
      if (hidden) { last = now; return; }
      var dt = Math.min((now - (last || now)) / 1000, 0.016) || 0.016;
      last = now;
      measure();

      gl.disable(gl.BLEND);

      // gold dye, so the fluid reads as molten metal rather than a rainbow
      var n = Math.min(queue.length, 12);
      for (var qi = 0; qi < n; qi++) {
        var q = queue.shift();
        lag.push([q[0], q[1]]);
        if (lag.length > 5) lag.shift();
        var L = lag[0];
        splat(q[0], q[1], q[2], q[3], [0.30, 0.215, 0.085], L[0], L[1]);
      }

      gl.viewport(0, 0, simW, simH);

      gl.useProgram(pCurl.p);
      gl.uniform2f(pCurl.u.px, 1 / simW, 1 / simH);
      gl.uniform1i(pCurl.u.uVel, vel.read.attach(0));
      blit(curl);

      gl.useProgram(pVort.p);
      gl.uniform2f(pVort.u.px, 1 / simW, 1 / simH);
      gl.uniform1i(pVort.u.uVel, vel.read.attach(0));
      gl.uniform1i(pVort.u.uCurl, curl.attach(1));
      gl.uniform1f(pVort.u.curl, 34);
      gl.uniform1f(pVort.u.dt, dt);
      blit(vel.write); vel.swap();

      gl.useProgram(pDiv.p);
      gl.uniform2f(pDiv.u.px, 1 / simW, 1 / simH);
      gl.uniform1i(pDiv.u.uVel, vel.read.attach(0));
      blit(div);

      gl.useProgram(pClear.p);
      gl.uniform1i(pClear.u.uT, press.read.attach(0));
      gl.uniform1f(pClear.u.v, 0.8);
      blit(press.write); press.swap();

      gl.useProgram(pPress.p);
      gl.uniform2f(pPress.u.px, 1 / simW, 1 / simH);
      gl.uniform1i(pPress.u.uDiv, div.attach(0));
      for (var i = 0; i < 18; i++) {
        gl.uniform1i(pPress.u.uPress, press.read.attach(1));
        blit(press.write); press.swap();
      }

      gl.useProgram(pGrad.p);
      gl.uniform2f(pGrad.u.px, 1 / simW, 1 / simH);
      gl.uniform1i(pGrad.u.uPress, press.read.attach(0));
      gl.uniform1i(pGrad.u.uVel, vel.read.attach(1));
      blit(vel.write); vel.swap();

      gl.useProgram(pAdvect.p);
      gl.uniform2f(pAdvect.u.px, 1 / simW, 1 / simH);
      gl.uniform2f(pAdvect.u.texel, 1 / simW, 1 / simH);
      gl.uniform1i(pAdvect.u.uVel, vel.read.attach(0));
      gl.uniform1i(pAdvect.u.uSrc, vel.read.attach(0));
      gl.uniform1f(pAdvect.u.dt, dt);
      gl.uniform1f(pAdvect.u.diss, 0.994);
      blit(vel.write); vel.swap();

      gl.viewport(0, 0, dyeW, dyeH);
      gl.uniform1i(pAdvect.u.uVel, vel.read.attach(0));
      gl.uniform1i(pAdvect.u.uSrc, dye.read.attach(1));
      gl.uniform1f(pAdvect.u.diss, 0.974);
      blit(dye.write); dye.swap();

      gl.viewport(0, 0, cv.width, cv.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(pDraw.p);
      gl.uniform1i(pDraw.u.uT, dye.read.attach(0));
      gl.uniform4fv(pDraw.u.r0, rects[0]);
      gl.uniform4fv(pDraw.u.r1, rects[1]);
      gl.uniform4fv(pDraw.u.r2, rects[2]);
      gl.uniform4fv(pDraw.u.r3, rects[3]);
      gl.uniform4fv(pDraw.u.rEx, exRect);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      blit(null);
    }
    requestAnimationFrame(step);
  })();

  /* =========================================================
     12. CURSOR IMAGE TRAIL — shots of the project you are over
     Distance-threshold spawning: a new frame is laid once the pointer has
     travelled far enough since the last one, cycling that card's shots.
     ========================================================= */
  (function cursorImages() {
    if (touch || reduce) return;
    var layer = document.getElementById('citrail');
    var sec = document.getElementById('work');
    if (!layer || !sec) return;

    var SHOTS = {"rto-pilot": ["https://cdn.prod.website-files.com/662b4731a3ded1e03b5c4ba8/67ca6cd29941ed286c5f380b_RTO%20Pilot-p-800.png", "https://cdn.prod.website-files.com/662b4731a3ded1e03b5c4ba8/68f070ea8bb0dd79abeb80f5_Case%20Studies%20Hero%20Banner%20(4)-p-800.png"], "airpin": ["https://cdn.prod.website-files.com/662b4731a3ded1e03b5c4ba8/682d8ca0f216d25240398269_Airpin%20(1)-p-800.png"], "education-horizons": ["https://cdn.prod.website-files.com/662b4731a3ded1e03b5c4ba8/67ca5149dc641e09321517c1_EHG-p-800.png"], "mepacs": ["https://cdn.prod.website-files.com/662b4731a3ded1e03b5c4ba8/67ca5a9ca7c9932f9ae33e36_MePACS-p-800.png"], "desert-to-coast": ["https://cdn.prod.website-files.com/662b4731a3ded1e03b5c4ba8/68db76d42662f92f1a556b73_D2C%20(1)-p-800.png"]};
    var THRESHOLD = 190;      // px of travel between frames
    var VISIBLE = 620;        // ms held before it starts leaving
    var GONE = 1500;          // ms before it is removed
    var MAX = 5;

    var lastX = null, lastY = null, idx = {}, live = [];

    /* No viewport gate is needed: the pointer can only resolve to a .wcard when
       that card is actually on screen, so slugOf is the gate. An
       IntersectionObserver here would add a second failure mode for nothing. */
    function slugOf(el) {
      var a = el && el.closest && el.closest('.wcard');
      if (!a) return null;
      var h = a.getAttribute('href') || '';
      var m = h.match(/case-studies\/([a-z0-9-]+)/);
      return m ? m[1] : null;
    }

    function spawn(x, y, slug) {
      var list = SHOTS[slug];
      if (!list || !list.length) return;
      idx[slug] = (idx[slug] == null ? 0 : (idx[slug] + 1) % list.length);

      var d = document.createElement('div');
      d.className = 'cit';
      d.style.setProperty('--r', ((Math.random() * 2 - 1) * 7).toFixed(1) + 'deg');
      var im = document.createElement('img');
      im.src = list[idx[slug]];
      im.alt = '';
      im.loading = 'eager';
      im.decoding = 'async';
      d.appendChild(im);
      layer.appendChild(d);

      // centre it on the pointer once its size is known
      var w = d.offsetWidth, h = d.offsetHeight;
      d.style.left = (x - w / 2) + 'px';
      d.style.top = (y - h / 2) + 'px';

      requestAnimationFrame(function () { d.classList.add('in'); });
      live.push(d);
      if (live.length > MAX) { var old = live.shift(); retire(old); }
      setTimeout(function () { retire(d); }, VISIBLE);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, GONE);
    }
    function retire(d) { d.classList.remove('in'); d.classList.add('out'); }

    addEventListener('pointermove', function (e) {
      var slug = slugOf(e.target);
      if (!slug) { lastX = lastY = null; return; }
      if (lastX === null) { lastX = e.clientX; lastY = e.clientY; return; }
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.sqrt(dx * dx + dy * dy) < THRESHOLD) return;
      lastX = e.clientX; lastY = e.clientY;
      spawn(e.clientX, e.clientY, slug);
    }, { passive: true });
  })();

  /* =========================================================
     11. COMMAND PALETTE — the K shortcut, actually wired up
     ========================================================= */
  (function palette() {
    var pal = document.getElementById('pal');
    var input = document.getElementById('palInput');
    var list = document.getElementById('palList');
    var empty = document.getElementById('palEmpty');
    var chip = document.getElementById('kbdChip');
    if (!pal || !input || !list) return;

    /* Windows and Linux send ctrlKey; macOS sends metaKey. Label the chip to
       match, so it never promises a key the visitor does not have. */
    var isMac = /mac|iphone|ipad|ipod/i.test(
      (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent);
    var lbl = document.getElementById('kbdLabel');
    if (lbl && !isMac) lbl.textContent = 'Ctrl K';

    /* the index is read out of the live DOM, so it cannot drift from the menu */
    var items = [];
    document.querySelectorAll('.mlink').forEach(function (a) {
      var pane = a.closest('.mpane');
      items.push({
        href: a.getAttribute('href'),
        title: (a.querySelector('b') || {}).textContent || '',
        desc: (a.querySelector('em') || {}).textContent || '',
        cat: pane ? (pane.querySelector('.mpane-lbl') || {}).textContent || '' : 'Services',
        icon: (a.querySelector('.mlink-i svg') || {}).outerHTML || ''
      });
    });
    [['#services','Our disciplines','Web, SEO and platforms','Section'],
     ['#work','Selected work','Case studies and client builds','Section'],
     ['#instrument','ROI calculator','What search is worth to you','Section'],
     ['#clients','Client results','What our clients say','Section'],
     ['#contact','Book a meeting','Start a project with us','Section']
    ].forEach(function (r) {
      items.push({ href: r[0], title: r[1], desc: r[2], cat: r[3], icon: '' });
    });

    var results = [], sel = 0, lastFocus = null;

    function score(it, q) {
      var t = it.title.toLowerCase(), d = it.desc.toLowerCase(), c = it.cat.toLowerCase();
      if (!q) return 1;
      if (t.indexOf(q) === 0) return 100;
      if (t.indexOf(q) > -1) return 60;
      if (c.indexOf(q) > -1) return 30;
      if (d.indexOf(q) > -1) return 20;
      return 0;
    }
    function mark(text, q) {
      if (!q) return text;
      var i = text.toLowerCase().indexOf(q);
      if (i < 0) return text;
      return text.slice(0, i) + '<mark>' + text.slice(i, i + q.length) + '</mark>' + text.slice(i + q.length);
    }

    function render() {
      var q = input.value.trim().toLowerCase();
      results = items.map(function (it) { return { it: it, s: score(it, q) }; })
                     .filter(function (r) { return r.s > 0; })
                     .sort(function (a, b) { return b.s - a.s; })
                     .map(function (r) { return r.it; })
                     .slice(0, 8);
      sel = 0;
      list.innerHTML = '';
      empty.hidden = results.length > 0;
      results.forEach(function (it, i) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        li.id = 'pal-opt-' + i;
        li.innerHTML = '<a href="' + it.href + '">' +
          '<span class="pal-k" aria-hidden="true">' + (it.icon || '&#8226;') + '</span>' +
          '<span class="pal-t"><b>' + mark(it.title, q) + '</b><em>' + it.desc + '</em></span>' +
          '<span class="pal-cat">' + it.cat + '</span></a>';
        li.addEventListener('pointerenter', function () { move(i); });
        list.appendChild(li);
      });
      input.setAttribute('aria-activedescendant', results.length ? 'pal-opt-0' : '');
    }

    function move(n) {
      if (!results.length) return;
      sel = (n + results.length) % results.length;
      [].forEach.call(list.children, function (li, i) {
        li.setAttribute('aria-selected', i === sel ? 'true' : 'false');
        if (i === sel) li.scrollIntoView({ block: 'nearest' });
      });
      input.setAttribute('aria-activedescendant', 'pal-opt-' + sel);
    }
    function go() {
      var li = list.children[sel];
      var a = li && li.querySelector('a');
      if (a) { close(); a.click(); }
    }

    function open() {
      if (!pal.hidden) return;
      lastFocus = document.activeElement;
      pal.hidden = false;
      requestAnimationFrame(function () { pal.classList.add('on'); });
      input.value = '';
      render();
      setTimeout(function () { input.focus(); }, 20);
    }
    function close() {
      if (pal.hidden) return;
      pal.classList.remove('on');
      var done = function () { pal.hidden = true; };
      reduce ? done() : setTimeout(done, 300);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      // Chrome binds Ctrl+K to the address bar; this is interceptable, unlike
      // Ctrl+T or Ctrl+W, so preventDefault is what makes it work on Windows
      if (k === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        pal.hidden ? open() : close();
        return;
      }
      if (pal.hidden) return;
      if (k === 'escape') { e.preventDefault(); close(); }
      else if (k === 'arrowdown') { e.preventDefault(); move(sel + 1); }
      else if (k === 'arrowup') { e.preventDefault(); move(sel - 1); }
      else if (k === 'home') { e.preventDefault(); move(0); }
      else if (k === 'end') { e.preventDefault(); move(results.length - 1); }
      else if (k === 'enter') { e.preventDefault(); go(); }
      else if (k === 'tab') { e.preventDefault(); }   // keep focus inside
    });

    input.addEventListener('input', render);
    document.getElementById('palScrim').addEventListener('click', close);
    if (chip) chip.addEventListener('click', open);
    document.querySelectorAll('.mega-hint').forEach(function (h) {
      h.style.cursor = 'pointer';
      h.addEventListener('click', open);
    });
  })();

  /* =========================================================
     10. NAV STATE + MEGA MENU
     ========================================================= */
  (function mega() {
    var nav = document.getElementById('nav');
    var trigger = document.getElementById('svcTrigger');
    var panel = document.getElementById('mega');
    var scrim = document.getElementById('scrim');
    var ind = document.getElementById('megaInd');
    if (!nav || !trigger || !panel) return;

    var cats  = [].slice.call(panel.querySelectorAll('.mcat'));
    var panes = [].slice.call(panel.querySelectorAll('.mpane'));
    var viss  = [].slice.call(panel.querySelectorAll('.mvis'));
    var open = false, openT = null, closeT = null;

    // stagger index for each link row
    panes.forEach(function (p) {
      [].slice.call(p.querySelectorAll('.mlinks li')).forEach(function (li, i) {
        li.style.setProperty('--i', i);
      });
    });

    /* ---- nav surface once past the fold ---- */
    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      nav.classList.toggle('stuck', y > 80);
      if (open && y > 40) close();
    }
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---- the sliding indicator ---- */
    function moveInd(el) {
      if (!el) return;
      ind.style.height = el.offsetHeight + 'px';
      ind.style.transform = 'translateY(' + el.offsetTop + 'px)';
      ind.style.opacity = '1';
    }

    /* ---- category switching ---- */
    function select(key, focusIt) {
      cats.forEach(function (c) {
        var on = c.dataset.cat === key;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-selected', on ? 'true' : 'false');
        c.tabIndex = on ? 0 : -1;
        if (on) { moveInd(c); if (focusIt) c.focus(); }
      });
      panes.forEach(function (p) {
        var on = p.dataset.pane === key;
        p.hidden = !on;
        p.classList.toggle('is-on', on);
        if (on) {
          // restart the row stagger each time the pane is shown
          [].slice.call(p.querySelectorAll('.mlinks li')).forEach(function (li) {
            li.style.animation = 'none';
            void li.offsetWidth;
            li.style.animation = '';
          });
        }
      });
      viss.forEach(function (v) { v.classList.toggle('is-on', v.dataset.vis === key); });
    }

    /* ---- open / close ---- */
    function doOpen() {
      if (open) return;
      open = true;
      nav.classList.add('open');
      scrim.classList.add('on');
      trigger.setAttribute('aria-expanded', 'true');
      // visibility:hidden elements still have layout, so measure synchronously —
      // rAF never fires in a backgrounded tab and would leave the indicator unset
      var on = panel.querySelector('.mcat.is-on') || cats[0];
      select(on.dataset.cat, false);
      moveInd(on);
    }
    function close() {
      if (!open) return;
      open = false;
      nav.classList.remove('open');
      scrim.classList.remove('on');
      trigger.setAttribute('aria-expanded', 'false');
      ind.style.opacity = '0';
    }
    function cancel() { clearTimeout(openT); clearTimeout(closeT); }

    /* ---- pointer: hover with intent on desktop, tap on touch ---- */
    if (!touch) {
      trigger.addEventListener('pointerenter', function () {
        cancel(); openT = setTimeout(doOpen, 90);
      });
      nav.addEventListener('pointerleave', function () {
        cancel(); closeT = setTimeout(close, 240);
      });
      nav.addEventListener('pointerenter', cancel);
      cats.forEach(function (c) {
        c.addEventListener('pointerenter', function () { select(c.dataset.cat, false); });
      });
    }

    trigger.addEventListener('click', function (e) {
      e.preventDefault(); cancel();
      open ? close() : doOpen();
    });
    cats.forEach(function (c) {
      c.addEventListener('click', function (e) { e.preventDefault(); select(c.dataset.cat, false); });
      c.addEventListener('focus', function () { if (open) select(c.dataset.cat, false); });
    });

    /* ---- keyboard ---- */
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) { close(); trigger.focus(); return; }
      if (!open || cats.indexOf(document.activeElement) === -1) return;
      var i = cats.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault(); select(cats[(i + 1) % cats.length].dataset.cat, true);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault(); select(cats[(i - 1 + cats.length) % cats.length].dataset.cat, true);
      } else if (e.key === 'Home') {
        e.preventDefault(); select(cats[0].dataset.cat, true);
      } else if (e.key === 'End') {
        e.preventDefault(); select(cats[cats.length - 1].dataset.cat, true);
      }
    });

    // click-away, and focus leaving the nav entirely
    addEventListener('pointerdown', function (e) {
      if (open && !nav.contains(e.target)) close();
    });
    addEventListener('focusin', function (e) {
      if (open && !nav.contains(e.target)) close();
    });
    scrim.addEventListener('click', close);

    addEventListener('resize', function () {
      if (open) moveInd(panel.querySelector('.mcat.is-on'));
    }, { passive: true });
  })();
})();
(function (C, A, L) {
  var p = function (a, ar) { a.q.push(ar); };
  var d = C.document;
  C.Cal = C.Cal || function () {
    var cal = C.Cal, ar = arguments;
    if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; }
    if (ar[0] === L) {
      var api = function () { p(api, arguments); };
      var ns = ar[1];
      api.q = api.q || [];
      if (typeof ns === 'string') { cal.ns[ns] = cal.ns[ns] || api; p(cal.ns[ns], ar); p(cal, ['initNamespace', ns]); }
      else { p(cal, ar); }
      return;
    }
    p(cal, ar);
  };
})(window, 'https://app.cal.com/embed/embed.js', 'init');

Cal('init', 'discovery', { origin: 'https://app.cal.com' });
Cal.ns.discovery('ui', {
  hideEventTypeDetails: false,
  layout: 'month_view',
  cssVarsPerTheme: { dark: { 'cal-brand': '#E3B96B' }, light: { 'cal-brand': '#8C6A2A' } }
});