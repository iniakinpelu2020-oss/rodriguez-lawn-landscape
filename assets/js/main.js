/* ==========================================================================
   Rodriguez Lawn & Landscape — interaction layer
   Curtain reveal · sticky header · 3D showcase tilt · AOS · estimate flow
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     1. Startup curtain — auto-completes, never traps scroll
     --------------------------------------------------------------- */
  var curtain = document.getElementById('curtain');
  if (curtain) {
    var dismissCurtain = function () {
      if (curtain.classList.contains('is-done')) return;
      curtain.classList.add('is-done');
      window.setTimeout(function () {
        if (curtain && curtain.parentNode) curtain.style.display = 'none';
      }, 900);
    };
    // CSS animation removes it even if JS never runs; this adds the class early.
    window.setTimeout(dismissCurtain, reduceMotion ? 0 : 1300);
    curtain.addEventListener('transitionend', function () {
      if (curtain.classList.contains('is-done')) curtain.style.display = 'none';
    });
  }

  /* ---------------------------------------------------------------
     2. Sticky header state + mobile navigation
     --------------------------------------------------------------- */
  var header = document.getElementById('siteHeader');
  if (header) {
    var setScrolled = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 20);
    };
    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });

    var toggle = document.getElementById('navToggle');
    var closeNav = function () {
      header.classList.remove('is-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    };

    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = header.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    header.querySelectorAll('.nav a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    document.addEventListener('click', function (e) {
      if (!header.classList.contains('is-open')) return;
      if (header.contains(e.target)) return;
      closeNav();
    });
  }

  /* ---------------------------------------------------------------
     3. AOS scroll reveals
     --------------------------------------------------------------- */
  if (window.AOS) {
    window.AOS.init({
      duration: 820,
      easing: 'ease-out-cubic',
      offset: 80,
      once: true,
      disable: reduceMotion
    });
  }
  root.classList.add('js-ready');

  /* ---------------------------------------------------------------
     4. 3D / parallax showcase stage
     --------------------------------------------------------------- */
  var stage = document.getElementById('stage');
  if (stage && !reduceMotion) {
    var current = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };
    var rafId = null;
    var touchStart = null;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

    var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };

    var paint = function () {
      current.x += (target.x - current.x) * 0.13;
      current.y += (target.y - current.y) * 0.13;

      stage.style.setProperty('--px', current.x.toFixed(4));
      stage.style.setProperty('--py', current.y.toFixed(4));
      stage.style.setProperty('--ry', (current.x * 7).toFixed(3) + 'deg');
      stage.style.setProperty('--rx', (-current.y * 5.5).toFixed(3) + 'deg');

      var settled =
        Math.abs(target.x - current.x) < 0.0015 &&
        Math.abs(target.y - current.y) < 0.0015 &&
        Math.abs(target.x) < 0.0015 &&
        Math.abs(target.y) < 0.0015;

      if (settled) {
        current.x = 0;
        current.y = 0;
        target.x = 0;
        target.y = 0;
        stage.style.setProperty('--px', '0');
        stage.style.setProperty('--py', '0');
        stage.style.setProperty('--ry', '0deg');
        stage.style.setProperty('--rx', '0deg');
        stage.classList.remove('is-tilting');
        rafId = null;
        return;
      }
      rafId = window.requestAnimationFrame(paint);
    };

    var kick = function () {
      if (rafId === null) rafId = window.requestAnimationFrame(paint);
    };

    // Desktop cursor perspective tilt
    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') {
        if (!touchStart) return;
        target.x = clamp((e.clientX - touchStart.x) / 78, -1, 1);
        target.y = clamp((e.clientY - touchStart.y) / 90, -1, 1);
        stage.classList.add('is-tilting');
        kick();
        return;
      }
      if (!finePointer.matches) return;
      var rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      target.x = clamp(((e.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      target.y = clamp(((e.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
      stage.classList.add('is-tilting');
      kick();
    });

    stage.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch') return;
      target.x = 0;
      target.y = 0;
      kick();
    });

    // Mobile touch-drag (vertical page scroll stays available via touch-action: pan-y)
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      touchStart = { x: e.clientX, y: e.clientY };
    });

    var endTouch = function () {
      if (!touchStart) return;
      touchStart = null;
      target.x = 0;
      target.y = 0;
      kick();
    };
    stage.addEventListener('pointerup', endTouch);
    stage.addEventListener('pointercancel', endTouch);
    stage.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch') endTouch();
    });

    // Keyboard users get a gentle invitation, then it settles.
    stage.addEventListener('focus', function () {
      target.x = 0.45;
      target.y = -0.3;
      stage.classList.add('is-tilting');
      kick();
      window.setTimeout(function () {
        target.x = 0;
        target.y = 0;
        kick();
      }, 1200);
    });
  }

  /* ---------------------------------------------------------------
     5. Image fallback handlers (styled crop-safe placeholders)
     --------------------------------------------------------------- */
  document.addEventListener(
    'error',
    function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'IMG') return;
      el.classList.add('img-failed');
      var wrap = el.closest('.media');
      if (wrap) wrap.classList.add('media--fallback');
    },
    true
  );

  /* ---------------------------------------------------------------
     6. "Request Quote" → pre-select service in estimate form
     --------------------------------------------------------------- */
  var form = document.getElementById('estimateForm');
  var formCard = document.querySelector('.form-card');
  var serviceSelect = document.getElementById('service');
  var serviceHint = document.getElementById('serviceHint');
  var formSuccess = document.getElementById('formSuccess');
  var formError = document.getElementById('formError');

  document.querySelectorAll('[data-service]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-service');
      if (serviceSelect && value) {
        serviceSelect.value = value;
        var chosen = serviceSelect.options[serviceSelect.selectedIndex];
        if (serviceHint && chosen) {
          serviceHint.textContent = 'Pre-selected: ' + chosen.textContent;
          serviceHint.hidden = false;
        }
        serviceSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var targetSection = document.getElementById('estimate');
      if (targetSection) {
        targetSection.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start'
        });
      }
      if (formCard) {
        formCard.classList.remove('is-prompted');
        // restart the highlight animation
        void formCard.offsetWidth;
        formCard.classList.add('is-prompted');
        window.setTimeout(function () {
          var nameField = document.getElementById('fullName');
          if (nameField && window.innerWidth > 960) nameField.focus({ preventScroll: true });
        }, reduceMotion ? 0 : 620);
      }
    });
  });

  /* ---------------------------------------------------------------
     7. Estimate form → instant SMS / WhatsApp quote
     --------------------------------------------------------------- */
  if (form) {
    var SERVICE_LABELS = {
      'lawn-maintenance': 'Weekly & Bi-Weekly Precision Lawn Maintenance',
      'landscape-design': 'Custom Landscape Design & Planting',
      'sod-installation': 'Fresh Sod Installation & Turf Restoration',
      'mulching-cleanup': 'Mulching, Bed Edging & Seasonal Cleanups',
      'tree-shrub-trimming': 'Tree & Shrub Trimming & Hedge Sculpting',
      'hardscaping-drainage': 'Hardscaping, Pavers & Drainage Solutions',
      'multiple': 'Multiple services / full yard transformation',
      'unsure': 'Not sure yet — please advise'
    };

    var value = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (formError) formError.hidden = true;

      if (!form.checkValidity()) {
        if (formError) {
          formError.textContent =
            'Please add your name, phone number, property address and the service you need so we can quote accurately.';
          formError.hidden = false;
        }
        if (typeof form.reportValidity === 'function') form.reportValidity();
        return;
      }

      var name = value('fullName');
      var phone = value('phone');
      var address = value('address');
      var service = SERVICE_LABELS[value('service')] || value('service');
      var notes = value('notes');

      var message =
        'Hi Rodriguez Lawn & Landscape — I would like a free estimate.\n\n' +
        'Name: ' + name + '\n' +
        'Phone: ' + phone + '\n' +
        'Property: ' + address + '\n' +
        'Service: ' + service + '\n' +
        'Notes: ' + (notes || '—') + '\n\n' +
        'Sent from the website estimate form.';

      var encoded = encodeURIComponent(message);
      var smsLink = document.getElementById('successSms');
      var waLink = document.getElementById('successWa');
      if (smsLink) smsLink.href = 'sms:+18325747414?&body=' + encoded;
      if (waLink) waLink.href = 'https://wa.me/18325747414?text=' + encoded;

      var firstName = name.split(/\s+/)[0];
      var successName = document.getElementById('successName');
      var successSummary = document.getElementById('successSummary');
      if (successName) successName.textContent = firstName || 'neighbor';
      if (successSummary) {
        successSummary.textContent =
          'Your ' + service.toLowerCase() + ' request for ' + address +
          ' is ready. Send it by text or WhatsApp and we will reply with a fixed, itemised quote — usually the same business day.';
      }

      form.hidden = true;
      if (formSuccess) {
        formSuccess.hidden = false;
        formSuccess.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center'
        });
      }
    });

    var resetBtn = document.getElementById('resetForm');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (formSuccess) formSuccess.hidden = true;
        form.hidden = false;
        if (serviceHint) serviceHint.hidden = true;
        var first = document.getElementById('fullName');
        if (first) first.focus({ preventScroll: true });
      });
    }
  }

  /* ---------------------------------------------------------------
     8. Footer year
     --------------------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
