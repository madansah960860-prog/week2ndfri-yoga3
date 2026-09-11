/* ==========================================================================
   STILLPOINT - shared behavior
   Vanilla JavaScript, no dependencies, no build step.

   Every module below is defensive: if its markup is not present on the
   current page, the module returns quietly. One file ships to all pages.

   Modules:
     A  Boot flags and helpers
     B  Navigation (hamburger drawer + dropdowns)
     B2 Sticky header condensing on scroll
     C  Scroll reveals and line-by-line heading reveals
     D  Hero parallax (hero only, reduced-motion aware)
     E  Accordion
     F  Pose filter (difficulty / body area / prop)
     G  Sequence player (per-pose hold timers, pause, step controls)
     H  Breath pacer
     I  Form validation with inline error messages
     J  Cookie consent (Accept / Reject / Manage preferences)
     K  Back to top
     L  Dateline stamping
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* A  BOOT FLAGS AND HELPERS                                          */
  /* ------------------------------------------------------------------ */

  var docEl = document.documentElement;
  docEl.classList.add('has-js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function on(el, type, fn, opts) { if (el) el.addEventListener(type, fn, opts); }

  function prefersReduced() { return reduceMotion.matches; }

  /* Pad a number to two digits for clock display. */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* Format seconds as m:ss. */
  function clock(total) {
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + pad(s);
  }

  /* ------------------------------------------------------------------ */
  /* B  NAVIGATION                                                      */
  /* ------------------------------------------------------------------ */

  function initNav() {
    var toggle = $('.navtoggle');
    var list = $('#primary-navlist');
    if (!toggle || !list) return;

    var desktop = window.matchMedia('(min-width: 1024px)');

    /* Keep the navlist, the toggle button and <html> in sync so CSS can
       lock body scroll while the mobile drawer is open. */
    function setDrawer(open) {
      list.setAttribute('data-open', open ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { docEl.setAttribute('data-navopen', 'true'); }
      else { docEl.removeAttribute('data-navopen'); }
    }

    function closeDrawer() { setDrawer(false); }

    on(toggle, 'click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      setDrawer(!open);
    });

    /* Dropdown submenus. Click-driven so they work on touch as well as
       pointer, and so keyboard users get the same behavior. */
    $$('.has-sub > button', list).forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;

      function setOpen(open) {
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { panel.removeAttribute('hidden'); } else { panel.setAttribute('hidden', ''); }
      }

      on(btn, 'click', function (e) {
        e.stopPropagation();
        var open = btn.getAttribute('aria-expanded') === 'true';
        /* Only one submenu open at a time. */
        $$('.has-sub > button', list).forEach(function (other) {
          if (other !== btn) {
            var op = document.getElementById(other.getAttribute('aria-controls'));
            other.setAttribute('aria-expanded', 'false');
            if (op) op.setAttribute('hidden', '');
          }
        });
        setOpen(!open);
      });

      /* On desktop, hovering the parent opens the submenu; leaving closes it. */
      var parent = btn.parentNode;
      on(parent, 'mouseenter', function () { if (desktop.matches) setOpen(true); });
      on(parent, 'mouseleave', function () { if (desktop.matches) setOpen(false); });
    });

    /* Click outside or press Escape closes everything. */
    on(document, 'click', function (e) {
      if (!list.contains(e.target) && !toggle.contains(e.target)) {
        if (!desktop.matches) closeDrawer();
        $$('.has-sub > button', list).forEach(function (b) {
          var p = document.getElementById(b.getAttribute('aria-controls'));
          b.setAttribute('aria-expanded', 'false');
          if (p) p.setAttribute('hidden', '');
        });
      }
    });

    on(document, 'keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!desktop.matches) closeDrawer();
      $$('.has-sub > button', list).forEach(function (b) {
        var p = document.getElementById(b.getAttribute('aria-controls'));
        if (b.getAttribute('aria-expanded') === 'true') {
          b.setAttribute('aria-expanded', 'false');
          if (p) p.setAttribute('hidden', '');
          b.focus();
        }
      });
    });

    /* Reset drawer state when crossing into the desktop layout. */
    function syncBreakpoint() { if (desktop.matches) closeDrawer(); }
    if (desktop.addEventListener) { desktop.addEventListener('change', syncBreakpoint); }
    else if (desktop.addListener) { desktop.addListener(syncBreakpoint); }
  }

  /* ------------------------------------------------------------------ */
  /* B2  STICKY HEADER CONDENSING                                       */
  /* Marks .siteheader with data-scrolled once the page has moved past   */
  /* 8px, so CSS can style a condensed state. Passive scroll listener,   */
  /* throttled to one measurement per animation frame.                   */
  /* ------------------------------------------------------------------ */

  function initHeaderScroll() {
    var header = $('.siteheader');
    if (!header) return;

    var ticking = false;

    function update() {
      ticking = false;
      var scrolled = (window.pageYOffset || docEl.scrollTop || 0) > 8;
      header.dataset.scrolled = scrolled ? 'true' : 'false';
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    on(window, 'scroll', onScroll, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------ */
  /* C  SCROLL REVEALS                                                  */
  /* ------------------------------------------------------------------ */

  function initReveals() {
    var targets = $$('.js-reveal, .js-lines');
    if (!targets.length) return;

    /* Split display headings into lines so they can rise in sequence.
       Split happens on explicit <span class="line"> in markup, or on
       <br>-free single lines which simply become one line. */
    $$('.js-lines').forEach(function (el) {
      if (el.querySelector('.line')) return;
      var text = el.textContent.trim();
      el.textContent = '';
      var span = document.createElement('span');
      span.className = 'line';
      span.textContent = text;
      el.appendChild(span);
    });

    if (prefersReduced() || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    targets.forEach(function (el) { io.observe(el); });

    /* Safety net: anything still hidden after 3 seconds is shown anyway,
       so a headless renderer or a background tab never ships a blank page. */
    window.setTimeout(function () {
      targets.forEach(function (el) { el.classList.add('is-in'); });
    }, 3000);
  }

  /* ------------------------------------------------------------------ */
  /* D  HERO PARALLAX                                                   */
  /* Parallax is applied to the hero photograph only, per the design      */
  /* direction. Driven by a requestAnimationFrame loop that runs only     */
  /* while the hero is on screen.                                         */
  /* ------------------------------------------------------------------ */

  function initParallax() {
    var media = $('.hero__media');
    if (!media || prefersReduced() || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;

    var running = false;
    var frame = null;

    function step() {
      var rect = media.parentNode.getBoundingClientRect();
      var progress = rect.top / window.innerHeight;
      var shift = Math.max(-60, Math.min(60, progress * 70));
      media.style.transform = 'translate3d(0,' + shift.toFixed(2) + 'px,0)';
      if (running) frame = window.requestAnimationFrame(step);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !running) {
          running = true;
          frame = window.requestAnimationFrame(step);
        } else if (!entry.isIntersecting && running) {
          running = false;
          if (frame) window.cancelAnimationFrame(frame);
        }
      });
    }, { threshold: 0 });

    io.observe(media.parentNode);
  }

  /* ------------------------------------------------------------------ */
  /* E  ACCORDION                                                       */
  /* ------------------------------------------------------------------ */

  function initAccordions() {
    $$('.accordion__trigger').forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      on(btn, 'click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (open) { panel.setAttribute('hidden', ''); } else { panel.removeAttribute('hidden'); }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* F  POSE FILTER                                                     */
  /* Filters the pose index by difficulty, body area and prop required.  */
  /* Each index item carries data-level, data-area and data-prop, all     */
  /* space separated token lists.                                         */
  /* ------------------------------------------------------------------ */

  function initPoseFilter() {
    var root = $('[data-filter-root]');
    if (!root) return;

    var items = $$('[data-filter-item]', root);
    var status = $('[data-filter-status]', root);
    var empty = $('[data-filter-empty]', root);
    var reset = $('[data-filter-reset]', root);
    var search = $('[data-filter-search]', root);

    var state = { level: 'all', area: 'all', prop: 'all', q: '' };

    function tokens(el, key) {
      return (el.getAttribute('data-' + key) || '').toLowerCase().split(/\s+/);
    }

    function apply() {
      var shown = 0;
      items.forEach(function (item) {
        var okLevel = state.level === 'all' || tokens(item, 'level').indexOf(state.level) > -1;
        var okArea = state.area === 'all' || tokens(item, 'area').indexOf(state.area) > -1;
        var okProp = state.prop === 'all' || tokens(item, 'prop').indexOf(state.prop) > -1;
        var okQ = true;
        if (state.q) {
          okQ = (item.textContent || '').toLowerCase().indexOf(state.q) > -1;
        }
        var visible = okLevel && okArea && okProp && okQ;
        if (visible) { item.removeAttribute('hidden'); shown++; }
        else { item.setAttribute('hidden', ''); }
      });

      if (status) {
        status.textContent = shown === items.length
          ? 'Showing all ' + items.length + ' poses in the library.'
          : 'Showing ' + shown + ' of ' + items.length + ' poses.';
      }
      if (empty) {
        if (shown === 0) { empty.removeAttribute('hidden'); } else { empty.setAttribute('hidden', ''); }
      }
    }

    $$('.chip[data-group]', root).forEach(function (chip) {
      on(chip, 'click', function () {
        var group = chip.getAttribute('data-group');
        var value = chip.getAttribute('data-value');
        state[group] = value;
        $$('.chip[data-group="' + group + '"]', root).forEach(function (c) {
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        apply();
      });
    });

    if (search) {
      on(search, 'input', function () {
        state.q = search.value.trim().toLowerCase();
        apply();
      });
    }

    if (reset) {
      on(reset, 'click', function () {
        state = { level: 'all', area: 'all', prop: 'all', q: '' };
        if (search) search.value = '';
        $$('.chip[data-group]', root).forEach(function (c) {
          c.setAttribute('aria-pressed', c.getAttribute('data-value') === 'all' ? 'true' : 'false');
        });
        apply();
      });
    }

    apply();
  }

  /* ------------------------------------------------------------------ */
  /* G  SEQUENCE PLAYER                                                 */
  /* Reads the printed sequence order out of the page itself, so the     */
  /* player and the printed list can never drift apart.                  */
  /* ------------------------------------------------------------------ */

  function initPlayer() {
    var root = $('[data-player]');
    if (!root) return;

    var steps = $$('[data-hold]', root);
    if (!steps.length) return;

    var elClock = $('[data-player-clock]', root);
    var elName = $('[data-player-name]', root);
    var elSanskrit = $('[data-player-sanskrit]', root);
    var elCount = $('[data-player-count]', root);
    var elCue = $('[data-player-cue]', root);
    var elBar = $('[data-player-bar]', root);

    var btnPlay = $('[data-player-play]', root);
    var btnNext = $('[data-player-next]', root);
    var btnPrev = $('[data-player-prev]', root);
    var btnReset = $('[data-player-reset]', root);

    var index = 0;
    var remaining = 0;
    var ticking = false;
    var timer = null;

    var totalSeconds = steps.reduce(function (sum, s) {
      return sum + parseInt(s.getAttribute('data-hold'), 10);
    }, 0);

    function render() {
      var step = steps[index];
      var hold = parseInt(step.getAttribute('data-hold'), 10);

      steps.forEach(function (s) { s.setAttribute('aria-current', 'false'); });
      step.setAttribute('aria-current', 'true');

      if (elClock) elClock.textContent = clock(remaining);
      if (elName) elName.textContent = step.getAttribute('data-name') || '';
      if (elSanskrit) elSanskrit.textContent = step.getAttribute('data-sanskrit') || '';
      if (elCount) elCount.textContent = 'Step ' + (index + 1) + ' of ' + steps.length;
      if (elCue) elCue.textContent = step.getAttribute('data-cue') || '';
      if (elBar) {
        var done = hold > 0 ? ((hold - remaining) / hold) * 100 : 0;
        elBar.style.width = done.toFixed(1) + '%';
      }
    }

    function load(i) {
      index = Math.max(0, Math.min(steps.length - 1, i));
      remaining = parseInt(steps[index].getAttribute('data-hold'), 10);
      render();
    }

    function tick() {
      remaining -= 1;
      if (remaining <= 0) {
        if (index < steps.length - 1) {
          load(index + 1);
          return;
        }
        remaining = 0;
        stop();
        if (elCue) elCue.textContent = 'Practice complete. Rest for as long as you like before you get up.';
        render();
        return;
      }
      render();
    }

    function start() {
      if (ticking) return;
      ticking = true;
      if (btnPlay) {
        btnPlay.textContent = 'Pause';
        btnPlay.setAttribute('aria-pressed', 'true');
      }
      timer = window.setInterval(tick, 1000);
    }

    function stop() {
      ticking = false;
      if (btnPlay) {
        btnPlay.textContent = 'Start practice';
        btnPlay.setAttribute('aria-pressed', 'false');
      }
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    on(btnPlay, 'click', function () { if (ticking) { stop(); } else { start(); } });
    on(btnNext, 'click', function () { load(Math.min(steps.length - 1, index + 1)); });
    on(btnPrev, 'click', function () { load(Math.max(0, index - 1)); });
    on(btnReset, 'click', function () { stop(); load(0); });

    /* Clicking a printed step jumps the player to it. */
    steps.forEach(function (step, i) {
      on(step, 'click', function () { load(i); });
      step.style.cursor = 'pointer';
    });

    /* Pause when the tab is hidden so the clock never lies. */
    on(document, 'visibilitychange', function () {
      if (document.hidden && ticking) stop();
    });

    var elTotal = $('[data-player-total]', root);
    if (elTotal) elTotal.textContent = Math.round(totalSeconds / 60) + ' minutes';

    load(0);
  }

  /* ------------------------------------------------------------------ */
  /* H  BREATH PACER                                                    */
  /* A visual count for even breathing. No claims are made about what     */
  /* breathing does; this is a metronome, nothing more.                   */
  /* ------------------------------------------------------------------ */

  function initPacer() {
    var root = $('[data-pacer]');
    if (!root) return;

    var elPhase = $('[data-pacer-phase]', root);
    var elCount = $('[data-pacer-count]', root);
    var elFill = $('[data-pacer-fill]', root);
    var btn = $('[data-pacer-toggle]', root);
    var select = $('[data-pacer-pattern]', root);

    var pattern = [4, 0, 4, 0];   /* inhale, hold in, exhale, hold out */
    var labels = ['Inhale', 'Hold', 'Exhale', 'Hold'];
    var phase = 0;
    var elapsed = 0;
    var timer = null;

    function readPattern() {
      if (!select) return;
      var parts = select.value.split('-').map(function (n) { return parseInt(n, 10) || 0; });
      while (parts.length < 4) parts.push(0);
      pattern = parts;
    }

    function nextPhase() {
      var guard = 0;
      do {
        phase = (phase + 1) % 4;
        guard++;
      } while (pattern[phase] === 0 && guard < 8);
      elapsed = 0;
    }

    function paint() {
      var len = pattern[phase] || 1;
      if (elPhase) elPhase.textContent = labels[phase];
      if (elCount) elCount.textContent = (len - elapsed) + ' of ' + len;
      if (elFill) {
        /* Fill grows on inhale phases, shrinks on exhale phases. */
        var pct = (elapsed / len) * 100;
        if (phase === 2) pct = 100 - pct;
        if (phase === 3) pct = 4;
        if (phase === 1) pct = 100;
        elFill.style.width = Math.max(4, Math.min(100, pct)).toFixed(1) + '%';
      }
    }

    function tick() {
      elapsed += 1;
      if (elapsed >= pattern[phase]) { nextPhase(); }
      paint();
    }

    function stop() {
      if (timer) { window.clearInterval(timer); timer = null; }
      if (btn) { btn.textContent = 'Start the count'; btn.setAttribute('aria-pressed', 'false'); }
      if (elPhase) elPhase.textContent = 'Ready';
      if (elCount) elCount.textContent = 'Paused';
    }

    function start() {
      readPattern();
      phase = 0; elapsed = 0;
      paint();
      timer = window.setInterval(tick, 1000);
      if (btn) { btn.textContent = 'Pause the count'; btn.setAttribute('aria-pressed', 'true'); }
    }

    on(btn, 'click', function () { if (timer) { stop(); } else { start(); } });
    on(select, 'change', function () { if (timer) { stop(); start(); } else { readPattern(); } });
    on(document, 'visibilitychange', function () { if (document.hidden && timer) stop(); });

    readPattern();
  }

  /* ------------------------------------------------------------------ */
  /* I  FORM VALIDATION                                                 */
  /* Inline errors sit directly below the field they describe and are     */
  /* announced through aria-invalid and aria-describedby.                 */
  /* ------------------------------------------------------------------ */

  function initForms() {
    $$('form[data-validate]').forEach(function (form) {
      var status = $('[data-form-status]', form);

      function fieldError(field) {
        var id = field.getAttribute('data-error');
        return id ? document.getElementById(id) : null;
      }

      function setError(field, message) {
        var box = fieldError(field);
        field.setAttribute('aria-invalid', 'true');
        if (box) { box.textContent = message; box.removeAttribute('hidden'); }
      }

      function clearError(field) {
        var box = fieldError(field);
        field.setAttribute('aria-invalid', 'false');
        if (box) { box.textContent = ''; box.setAttribute('hidden', ''); }
      }

      function validate(field) {
        var value = (field.value || '').trim();
        var type = field.getAttribute('type');
        var label = field.getAttribute('data-label') || 'This field';

        if (field.hasAttribute('required')) {
          if (field.type === 'checkbox' && !field.checked) {
            setError(field, 'Please check this box to continue.');
            return false;
          }
          if (field.type !== 'checkbox' && !value) {
            setError(field, label + ' is required.');
            return false;
          }
        }
        if (!value && !field.hasAttribute('required')) { clearError(field); return true; }

        if (type === 'email' && value) {
          if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) {
            setError(field, 'Enter an email address in the format name@example.com.');
            return false;
          }
        }
        if (type === 'tel' && value) {
          if (!/^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(value)) {
            setError(field, 'Enter a US phone number, for example +1 (312) 555-0147.');
            return false;
          }
        }
        if (field.hasAttribute('minlength') && value.length < parseInt(field.getAttribute('minlength'), 10)) {
          setError(field, label + ' needs at least ' + field.getAttribute('minlength') + ' characters.');
          return false;
        }
        clearError(field);
        return true;
      }

      var fields = $$('[data-error]', form);

      fields.forEach(function (field) {
        on(field, 'blur', function () { validate(field); });
        on(field, 'input', function () {
          if (field.getAttribute('aria-invalid') === 'true') validate(field);
        });
        on(field, 'change', function () {
          if (field.type === 'checkbox') validate(field);
        });
      });

      on(form, 'submit', function (e) {
        e.preventDefault();
        var firstBad = null;
        fields.forEach(function (field) {
          if (!validate(field) && !firstBad) firstBad = field;
        });

        if (firstBad) {
          if (status) {
            status.textContent = 'Please correct the highlighted fields and send again.';
            status.removeAttribute('hidden');
          }
          firstBad.focus();
          return;
        }

        if (status) {
          status.textContent = form.getAttribute('data-success') ||
            'Thank you. Your message has been sent to our team.';
          status.removeAttribute('hidden');
          status.focus();
        }
        form.reset();
        fields.forEach(clearError);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* J  COOKIE CONSENT                                                  */
  /* No non-essential cookie or tag is set before an explicit Accept.     */
  /* The stored choice lives in localStorage, which is strictly           */
  /* necessary for honoring the visitor's own preference.                 */
  /* ------------------------------------------------------------------ */

  var CONSENT_KEY = 'stillpoint-consent-v1';

  function readConsent() {
    try { return JSON.parse(window.localStorage.getItem(CONSENT_KEY)); }
    catch (err) { return null; }
  }

  function writeConsent(value) {
    try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify(value)); }
    catch (err) { /* storage blocked; the banner will simply ask again */ }
  }

  function initCookies() {
    var banner = $('#cookie-banner');
    if (!banner) return;

    var prefs = $('#cookie-prefs', banner);
    var btnAccept = $('[data-cookie-accept]', banner);
    var btnReject = $('[data-cookie-reject]', banner);
    var btnManage = $('[data-cookie-manage]', banner);
    var btnSave = $('[data-cookie-save]', banner);
    var chkAnalytics = $('#cookie-analytics', banner);
    var chkAds = $('#cookie-ads', banner);

    function show() {
      banner.removeAttribute('hidden');
      window.setTimeout(function () { banner.setAttribute('data-shown', 'true'); }, 60);
    }

    function hide() {
      banner.setAttribute('data-shown', 'false');
      window.setTimeout(function () { banner.setAttribute('hidden', ''); }, 520);
    }

    function settle(choice) {
      writeConsent({
        analytics: !!choice.analytics,
        advertising: !!choice.advertising,
        stamped: new Date().toISOString()
      });
      hide();
    }

    on(btnAccept, 'click', function () { settle({ analytics: true, advertising: true }); });
    on(btnReject, 'click', function () { settle({ analytics: false, advertising: false }); });
    on(btnManage, 'click', function () {
      if (!prefs) return;
      var open = !prefs.hasAttribute('hidden');
      if (open) { prefs.setAttribute('hidden', ''); }
      else { prefs.removeAttribute('hidden'); }
      btnManage.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    on(btnSave, 'click', function () {
      settle({
        analytics: chkAnalytics ? chkAnalytics.checked : false,
        advertising: chkAds ? chkAds.checked : false
      });
    });

    /* Any page can offer a link that reopens the banner. */
    $$('[data-cookie-reopen]').forEach(function (link) {
      on(link, 'click', function (e) {
        e.preventDefault();
        if (prefs) prefs.removeAttribute('hidden');
        show();
      });
    });

    if (!readConsent()) show();
  }

  /* ------------------------------------------------------------------ */
  /* K  BACK TO TOP                                                     */
  /* ------------------------------------------------------------------ */

  function initBackToTop() {
    var btn = $('.backtotop');
    if (!btn) return;

    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:640px;left:0;width:1px;height:1px;';
    document.body.appendChild(sentinel);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          btn.setAttribute('data-shown', entry.isIntersecting ? 'false' : 'true');
        });
      });
      io.observe(sentinel);
    } else {
      btn.setAttribute('data-shown', 'true');
    }

    on(btn, 'click', function () {
      window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });
      var skip = $('.skip-link');
      if (skip) skip.focus();
    });
  }

  /* ------------------------------------------------------------------ */
  /* K2  PRINT A SEQUENCE                                               */
  /* The print stylesheet strips the chrome and keeps the pose order,    */
  /* hold times and modifications so the page works on paper.            */
  /* ------------------------------------------------------------------ */

  function initPrint() {
    $$('[data-print]').forEach(function (btn) {
      on(btn, 'click', function () { window.print(); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* L  DATELINE STAMPING                                               */
  /* The footer signature carries a live copyright year. Other footer     */
  /* labels are authored per page and never generated.                    */
  /* ------------------------------------------------------------------ */

  function initDateline() {
    var year = String(new Date().getFullYear());
    $$('[data-year]').forEach(function (el) { el.textContent = year; });
  }

  /* ------------------------------------------------------------------ */
  /* BOOT                                                               */
  /* ------------------------------------------------------------------ */

  function boot() {
    initNav();
    initHeaderScroll();
    initReveals();
    initParallax();
    initAccordions();
    initPoseFilter();
    initPlayer();
    initPacer();
    initForms();
    initCookies();
    initBackToTop();
    initPrint();
    initDateline();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
