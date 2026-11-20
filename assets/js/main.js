/* ==========================================================================
   Rodriguez Lawn & Landscape — interaction layer
   Splash · native reveal · 3D stage · carousel · estimate builder · drawer
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     1. Brand splash — 1.0s, then cross-fade (CSS also auto-hides)
     --------------------------------------------------------------- */
  var splash = document.getElementById('splash');
  if (splash) {
    window.setTimeout(function () { splash.classList.add('is-hidden'); }, 1000);
  }

  /* ---------------------------------------------------------------
     2. Reveal on scroll — native IO + 500ms fail-safe
     --------------------------------------------------------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  function revealAll() { revealEls.forEach(function (el) { el.classList.add('is-revealed'); }); }
  if (revealEls.length) {
    if (!reduceMotion && 'IntersectionObserver' in window) {
      revealEls.forEach(function (el) { el.classList.add('reveal-armed'); });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
      window.setTimeout(revealAll, 500);
    } else {
      revealAll();
    }
  }

  /* ---------------------------------------------------------------
     3. Sticky app bar shadow
     --------------------------------------------------------------- */
  var appbar = document.getElementById('appbar');
  if (appbar) {
    var setScrolled = function () {
      appbar.style.boxShadow = window.scrollY > 8 ? '0 10px 24px -18px rgba(0,0,0,0.5)' : 'none';
    };
    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });
  }

  /* ---------------------------------------------------------------
     4. Hero 3D stage — drag/swipe to rotate, canvas + ResizeObserver
        Texture format: UNSIGNED_BYTE (8-bit, universally supported on
        Android/iOS — avoids float-texture blank-canvas bugs).
     --------------------------------------------------------------- */
  var stage = document.getElementById('heroStage');
  var scene = document.getElementById('heroScene');
  var canvas = document.getElementById('stageCanvas');
  if (stage && scene) {
    var rot = { x: -18, y: 12 };
    var target = { x: -18, y: 12 };
    var dragging = false;
    var lastX = 0, lastY = 0;

    function onDown(e) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      target.y += dx * 0.45;
      target.x -= dy * 0.45;
      target.x = Math.max(-42, Math.min(12, target.x));
      target.y = Math.max(-70, Math.min(70, target.y));
      lastX = e.clientX; lastY = e.clientY;
    }
    function onUp() { dragging = false; }

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('pointerleave', onUp);

    function tick() {
      rot.x += (target.x - rot.x) * 0.14;
      rot.y += (target.y - rot.y) * 0.14;
      scene.style.transform = 'rotateX(' + rot.x.toFixed(2) + 'deg) rotateY(' + rot.y.toFixed(2) + 'deg)';
      requestAnimationFrame(tick);
    }
    if (!reduceMotion) requestAnimationFrame(tick);
    else scene.style.transform = 'rotateX(-18deg) rotateY(12deg)';
  }

  /* Canvas — layered Houston lawn & garden scene, high-DPI via devicePixelRatio + ResizeObserver */
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function drawCanvas() {
      if (!ctx) return;
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      // --- 1. Sky / horizon gradient band ---
      var sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      sky.addColorStop(0, '#1a3a2c');
      sky.addColorStop(0.55, '#0f2418');
      sky.addColorStop(1, '#0B120E');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.55);
      // horizon glow
      var hg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.6);
      hg.addColorStop(0, 'rgba(226,192,125,0.18)');
      hg.addColorStop(1, 'rgba(226,192,125,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, w, h * 0.55);

      // --- 2. Distant tree line silhouette ---
      ctx.save();
      ctx.fillStyle = '#0a1a12';
      var baseY = h * 0.52;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      // jagged canopy
      var steps = 24;
      for (var i = 0; i <= steps; i++) {
        var x = (i / steps) * w;
        var amp = (i % 3 === 0) ? 0.09 : (i % 2 === 0 ? 0.05 : 0.03);
        var y = baseY - h * amp * (0.6 + 0.4 * Math.sin(i * 1.7));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, baseY + h * 0.04);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // --- 3. Manicured striped emerald grass lawn ---
      var lawnTop = h * 0.5;
      var lawn = ctx.createLinearGradient(0, lawnTop, 0, h);
      lawn.addColorStop(0, '#1f4a2e');
      lawn.addColorStop(0.5, '#143322');
      lawn.addColorStop(1, '#0a1f14');
      ctx.fillStyle = lawn;
      ctx.fillRect(0, lawnTop, w, h - lawnTop);
      // mowing stripes
      ctx.save();
      ctx.globalAlpha = 0.32;
      var stripeW = w / 16;
      for (var s = 0; s < 16; s++) {
        var sx = s * stripeW;
        ctx.fillStyle = (s % 2 === 0) ? 'rgba(52,211,153,0.35)' : 'rgba(8,24,14,0.55)';
        // perspective taper: stripes narrow toward horizon
        var topY = lawnTop + (s % 2 === 0 ? 0 : 0);
        ctx.beginPath();
        ctx.moveTo(sx, lawnTop);
        ctx.lineTo(sx + stripeW, lawnTop);
        ctx.lineTo(sx + stripeW * 1.05, h);
        ctx.lineTo(sx - stripeW * 0.05, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // --- 4. Curved stone garden path ---
      ctx.save();
      ctx.fillStyle = 'rgba(226,192,125,0.18)';
      ctx.strokeStyle = 'rgba(226,192,125,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      var px = w * 0.52, py = h * 0.55;
      ctx.moveTo(px, py);
      ctx.bezierCurveTo(w * 0.58, h * 0.68, w * 0.48, h * 0.82, w * 0.5, h);
      ctx.bezierCurveTo(w * 0.42, h * 0.82, w * 0.34, h * 0.68, w * 0.4, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // path stones
      ctx.fillStyle = 'rgba(226,192,125,0.28)';
      for (var k = 0; k < 7; k++) {
        var t = k / 6;
        var bx = w * 0.5 + (Math.sin(t * Math.PI) * 0.06 * w) * (t > 0.5 ? -1 : 1);
        var by = h * 0.55 + t * h * 0.42;
        ctx.beginPath();
        ctx.ellipse(bx, by, 6 + t * 2, 4 + t, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // --- 5. Sculpted bush / hedge on one side ---
      ctx.save();
      var hedgeX = w * 0.12;
      var hedgeY = h * 0.5;
      // hedge body
      ctx.fillStyle = '#0d2a1a';
      ctx.beginPath();
      ctx.ellipse(hedgeX + w * 0.06, hedgeY + h * 0.06, w * 0.11, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      // hedge highlights
      ctx.fillStyle = 'rgba(52,211,153,0.35)';
      ctx.beginPath();
      ctx.ellipse(hedgeX + w * 0.04, hedgeY, w * 0.07, h * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      // second hedge
      ctx.fillStyle = '#0a2216';
      ctx.beginPath();
      ctx.ellipse(hedgeX + w * 0.22, hedgeY + h * 0.08, w * 0.09, h * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- 6. Small patio / planter accent ---
      ctx.save();
      var patX = w * 0.78, patY = h * 0.72;
      ctx.fillStyle = 'rgba(226,192,125,0.12)';
      ctx.strokeStyle = 'rgba(226,192,125,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(patX - w * 0.09, patY - h * 0.05, w * 0.18, h * 0.12, 8);
      ctx.fill();
      ctx.stroke();
      // planter pot
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.roundRect(patX - 12, patY - 4, 24, 16, 4);
      ctx.fill();
      // planter plant
      ctx.fillStyle = '#2a6a3f';
      ctx.beginPath();
      ctx.ellipse(patX, patY - 12, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(52,211,153,0.5)';
      ctx.beginPath();
      ctx.ellipse(patX - 4, patY - 16, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- 7. Warm golden sunlight glints ---
      ctx.save();
      var glintPts = [[0.3, 0.42], [0.72, 0.38], [0.55, 0.6], [0.85, 0.55]];
      glintPts.forEach(function (pt) {
        var rg = ctx.createRadialGradient(w * pt[0], h * pt[1], 0, w * pt[0], h * pt[1], 40);
        rg.addColorStop(0, 'rgba(226,192,125,0.55)');
        rg.addColorStop(0.4, 'rgba(226,192,125,0.18)');
        rg.addColorStop(1, 'rgba(226,192,125,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      });
      ctx.restore();

      // --- 8. Floating pollen / sparkle motes ---
      ctx.save();
      var motes = 28;
      for (var m = 0; m < motes; m++) {
        var mx = (m * 97 + 13) % w;
        var my = (m * 53 + 7) % (h * 0.9) + h * 0.05;
        var mr = 0.8 + (m % 3) * 0.6;
        var alpha = 0.25 + (m % 5) * 0.12;
        ctx.fillStyle = (m % 2 === 0) ? 'rgba(226,192,125,' + alpha + ')' : 'rgba(52,211,153,' + alpha + ')';
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    function resizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCanvas();
    }
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(resizeCanvas);
      ro.observe(canvas);
    } else {
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();
    }
    // initial
    requestAnimationFrame(resizeCanvas);
  }

  /* ---------------------------------------------------------------
     5. Service carousel
     --------------------------------------------------------------- */
  var carSlides = Array.prototype.slice.call(document.querySelectorAll('.car-slide'));
  var carPills = Array.prototype.slice.call(document.querySelectorAll('.car-pill'));
  var carIndex = 0;
  var carViewport = document.getElementById('carViewport');

  function showSlide(i) {
    if (!carSlides.length) return;
    carIndex = (i + carSlides.length) % carSlides.length;
    carSlides.forEach(function (s, idx) { s.classList.toggle('is-active', idx === carIndex); });
    carPills.forEach(function (p, idx) { p.classList.toggle('is-active', idx === carIndex); });
  }
  var carPrev = document.getElementById('carPrev');
  var carNext = document.getElementById('carNext');
  if (carPrev) carPrev.addEventListener('click', function () { showSlide(carIndex - 1); });
  if (carNext) carNext.addEventListener('click', function () { showSlide(carIndex + 1); });
  carPills.forEach(function (p) {
    p.addEventListener('click', function () { showSlide(parseInt(p.getAttribute('data-go'), 10) || 0); });
  });

  // swipe on viewport
  if (carViewport) {
    var sx = 0, sy = 0, tracking = false;
    carViewport.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches[0]) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    carViewport.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - sx;
      var dy = t.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) showSlide(carIndex + 1); else showSlide(carIndex - 1);
      }
    }, { passive: true });
  }

  /* Lot size stepper labels per service */
  var YARD_LABELS = ['Small', 'Standard', 'Large Lot'];
  var serviceYard = {}; // service id -> index 0..2
  var serviceMult = [1, 1.15, 1.35];

  function updateStepperVal(svc) {
    var el = document.querySelector('.stepper[data-service="' + svc + '"] .stepper__val');
    if (el) el.textContent = YARD_LABELS[serviceYard[svc] || 0];
  }

  document.querySelectorAll('.stepper button[data-step]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var stepper = btn.closest('.stepper');
      if (!stepper) return;
      var svc = stepper.getAttribute('data-service');
      var idx = serviceYard[svc] || 0;
      var step = parseInt(btn.getAttribute('data-step'), 10) || 0;
      idx = Math.max(0, Math.min(2, idx + step));
      serviceYard[svc] = idx;
      updateStepperVal(svc);
      // recalc if selected
      render();
    });
  });

  /* ---------------------------------------------------------------
     6. Service catalog + instant estimate builder
     --------------------------------------------------------------- */
  var services = [
    { id: 'mowing', name: 'Precision Weekly / Bi-Weekly Lawn Mowing & Edging', price: 55 },
    { id: 'design', name: 'Custom Landscape Bed Design & Planting', price: 249 },
    { id: 'mulch', name: 'Premium Hardwood Mulch & Stone Edging', price: 175 },
    { id: 'trim', name: 'Ornamental Shrub, Hedge & Palm Pruning', price: 95 },
    { id: 'cleanup', name: 'Full Yard Leaf & Storm Debris Reset', price: 135 }
  ];

  var selected = {};
  var yard = 'small';
  var YARD_LABEL = { small: 'Small', standard: 'Standard', large: 'Large Lot' };
  var YARD_MULT = { small: 1, standard: 1.15, large: 1.35 };

  var bar = document.getElementById('estimateBar');
  var barText = document.getElementById('barText');
  var barBtn = document.getElementById('barBtn');
  var drawer = document.getElementById('drawer');
  var drawerList = document.getElementById('drawerList');
  var drawerYard = document.getElementById('drawerYard');
  var drawerTotal = document.getElementById('drawerTotal');
  var drawerSms = document.getElementById('drawerSms');
  var drawerWa = document.getElementById('drawerWa');

  function money(n) { return '$' + n.toFixed(2); }
  function priceFor(svcId) {
    var base = 0;
    services.forEach(function (s) { if (s.id === svcId) base = s.price; });
    var idx = serviceYard[svcId] || 0;
    return base * serviceMult[idx];
  }
  function selectedIds() { return Object.keys(selected).filter(function (k) { return selected[k]; }); }
  function count() { return selectedIds().length; }
  function total() {
    return selectedIds().reduce(function (sum, id) { return sum + priceFor(id); }, 0) * YARD_MULT[yard];
  }

  function buildMessage() {
    var lines = ['Hi Rodriguez Lawn & Landscape — I would like a free estimate.', ''];
    var picked = selectedIds();
    if (picked.length) {
      lines.push('Services:');
      picked.forEach(function (id) {
        var s = services.filter(function (x) { return x.id === id; })[0];
        lines.push('• ' + s.name + ' (' + money(priceFor(id)) + ')');
      });
    }
    lines.push('Yard size: ' + YARD_LABEL[yard]);
    lines.push('Estimated total: ' + money(total()));
    lines.push('');
    lines.push('Sent from the website estimate builder.');
    return lines.join('\n');
  }
  function syncDrawerLinks() {
    var msg = encodeURIComponent(buildMessage());
    if (drawerSms) drawerSms.href = 'sms:+18325747414?&body=' + msg;
    if (drawerWa) drawerWa.href = 'https://wa.me/18325747414?text=' + msg;
  }
  function renderDrawer() {
    if (!drawerList) return;
    drawerList.innerHTML = '';
    selectedIds().forEach(function (id) {
      var s = services.filter(function (x) { return x.id === id; })[0];
      var li = document.createElement('li');
      var label = document.createElement('strong');
      label.textContent = s.name;
      var price = document.createElement('span');
      price.textContent = money(priceFor(id));
      li.appendChild(label);
      li.appendChild(price);
      drawerList.appendChild(li);
    });
    if (drawerYard) drawerYard.textContent = YARD_LABEL[yard];
    if (drawerTotal) drawerTotal.textContent = money(total());
    syncDrawerLinks();
  }
  function render() {
    // update car-add buttons
    document.querySelectorAll('[data-add]').forEach(function (btn) {
      var id = btn.getAttribute('data-add');
      var on = !!selected[id];
      btn.classList.toggle('is-added', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? '✓ Added' : '+ Add to estimate';
    });

    var n = count();
    if (bar) {
      if (n > 0) {
        bar.hidden = false;
        if (barText) barText.textContent = n + (n === 1 ? ' service · ' : ' services · ') + money(total());
        window.requestAnimationFrame(function () { bar.classList.add('is-shown'); });
      } else {
        bar.classList.remove('is-shown');
        bar.hidden = true;
      }
    }
    renderDrawer();
  }

  document.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-add');
      selected[id] = !selected[id];
      render();
    });
  });

  /* Yard size global (not per-service) — keep standard stepper? The page uses per-service lot steppers.
     Also keep a global yard selector if present. */
  var yardButtons = Array.prototype.slice.call(document.querySelectorAll('.yard__opt'));
  yardButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      yard = btn.getAttribute('data-yard') || 'small';
      yardButtons.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      render();
    });
  });

  /* Booking drawer */
  function openDrawer() {
    if (!drawer || count() === 0) return;
    renderDrawer();
    drawer.hidden = false;
    window.requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    document.body.style.overflow = 'hidden';
    var closeBtn = drawer.querySelector('.drawer__close');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(function () { drawer.hidden = true; }, 350);
  }
  if (barBtn) barBtn.addEventListener('click', openDrawer);
  if (drawer) {
    drawer.querySelectorAll('[data-close-drawer]').forEach(function (el) {
      el.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
    });
  }

  /* ---------------------------------------------------------------
     7. Chapter parallax (scroll-linked)
     --------------------------------------------------------------- */
  var chapters = Array.prototype.slice.call(document.querySelectorAll('.chapter'));
  function onScroll() {
    if (reduceMotion) return;
    chapters.forEach(function (ch) {
      var bg = ch.querySelector('.chapter__bg');
      if (!bg) return;
      var r = ch.getBoundingClientRect();
      var center = r.top + r.height / 2 - window.innerHeight / 2;
      bg.style.transform = 'translateY(' + (center * 0.15) + 'px)';
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------
     8. Footer year
     --------------------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  render();
})();
