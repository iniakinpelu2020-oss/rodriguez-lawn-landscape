/* ==========================================================================
   Rodriguez Lawn & Landscape — interaction layer
   Splash · native reveal · service catalog · estimate builder · drawer
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     1. Brand splash — 1.0s, then cross-fade (CSS also auto-hides)
     --------------------------------------------------------------- */
  var splash = document.getElementById('splash');
  if (splash) {
    window.setTimeout(function () {
      splash.classList.add('is-hidden');
    }, 1000);
  }

  /* ---------------------------------------------------------------
     2. Reveal on scroll — native IO + 500ms fail-safe.
        Nothing is hidden unless JS arms it, and everything is
        force-revealed after 500ms so content can never stay invisible.
     --------------------------------------------------------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  function revealAll() {
    revealEls.forEach(function (el) { el.classList.add('is-revealed'); });
  }
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
      // Hard fail-safe: show everything after 500ms no matter what.
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
      appbar.style.boxShadow = window.scrollY > 8
        ? '0 10px 24px -18px rgba(16,35,26,0.4)'
        : 'none';
    };
    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });
  }

  /* ---------------------------------------------------------------
     4. Image fallbacks
     --------------------------------------------------------------- */
  document.addEventListener('error', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'IMG') return;
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
  }, true);

  /* ---------------------------------------------------------------
     5. Service catalog + instant estimate builder
     --------------------------------------------------------------- */
  var cards = Array.prototype.slice.call(document.querySelectorAll('.svc-card'));
  if (!cards.length) return;

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

  var searchInput = document.getElementById('svcSearch');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  var chipButtons = Array.prototype.slice.call(document.querySelectorAll('[data-chip-filter]'));
  var yardButtons = Array.prototype.slice.call(document.querySelectorAll('.yard__opt'));
  var activeFilter = 'all';

  function cardById(id) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute('data-id') === id) return cards[i];
    }
    return null;
  }
  function priceOf(card) { return parseFloat(card.getAttribute('data-price')) || 0; }
  function nameOf(card) { return card.getAttribute('data-name') || ''; }
  function money(n) { return '$' + n.toFixed(2); }
  function selectedCards() {
    return cards.filter(function (c) { return selected[c.getAttribute('data-id')]; });
  }
  function count() { return selectedCards().length; }
  function subtotal() {
    return selectedCards().reduce(function (sum, c) { return sum + priceOf(c); }, 0);
  }
  function total() { return subtotal() * YARD_MULT[yard]; }

  function buildMessage() {
    var lines = ['Hi Rodriguez Lawn & Landscape — I would like a free estimate.', ''];
    var picked = selectedCards();
    if (picked.length) {
      lines.push('Services:');
      picked.forEach(function (c) {
        lines.push('• ' + nameOf(c) + ' (' + money(priceOf(c)) + ')');
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
    selectedCards().forEach(function (c) {
      var li = document.createElement('li');
      var label = document.createElement('strong');
      label.textContent = nameOf(c);
      var price = document.createElement('span');
      price.textContent = money(priceOf(c));
      li.appendChild(label);
      li.appendChild(price);
      drawerList.appendChild(li);
    });
    if (drawerYard) drawerYard.textContent = YARD_LABEL[yard];
    if (drawerTotal) drawerTotal.textContent = money(total());
    syncDrawerLinks();
  }

  function render() {
    cards.forEach(function (c) {
      var id = c.getAttribute('data-id');
      var btn = c.querySelector('.add-btn');
      var on = !!selected[id];
      c.classList.toggle('is-selected', on);
      if (btn) {
        btn.classList.toggle('is-added', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.textContent = on ? '✓ Added' : '+ Add';
      }
    });

    var n = count();
    if (bar) {
      if (n > 0) {
        bar.hidden = false;
        if (barText) {
          barText.textContent = n + (n === 1 ? ' service · ' : ' services · ') + money(total());
        }
        // next frame so the transition runs
        window.requestAnimationFrame(function () { bar.classList.add('is-shown'); });
      } else {
        bar.classList.remove('is-shown');
        bar.hidden = true;
      }
    }
    renderDrawer();
  }

  function toggleService(id) {
    if (!cardById(id)) return;
    selected[id] = !selected[id];
    render();
  }

  cards.forEach(function (card) {
    var btn = card.querySelector('.add-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        toggleService(card.getAttribute('data-id'));
      });
    }
  });

  /* Search + category filters */
  function applyFilters() {
    var q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    cards.forEach(function (card) {
      var cat = card.getAttribute('data-category');
      var text = (card.textContent || '').toLowerCase();
      var matchCat = activeFilter === 'all' || cat === activeFilter;
      var matchQuery = !q || text.indexOf(q) !== -1;
      card.style.display = matchCat && matchQuery ? '' : 'none';
    });
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeFilter = btn.getAttribute('data-filter') || 'all';
      filterButtons.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      applyFilters();
    });
  });

  chipButtons.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var target = chip.getAttribute('data-chip-filter');
      var match = null;
      filterButtons.forEach(function (b) {
        if (b.getAttribute('data-filter') === target) match = b;
      });
      if (match) match.click();
      var catalog = document.getElementById('catalog');
      if (catalog) {
        catalog.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  /* Yard size stepper */
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
     6. Footer year
     --------------------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  render();
})();
