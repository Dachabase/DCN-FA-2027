/* BlastExams redesign: layout + UX layer. Loads after the app's own script, never replaces its logic. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ce = function (t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '<'.replace('<', '&lt;'), '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var chev = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  /* ---------- 1. Dashboard layout ---------- */
  function greetingWord() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function userFirstName() {
    var A = (typeof appData !== 'undefined') ? appData : null; var u = (A && A.currentUser) || null;
    var n = (u && (u.firstName || u.name || u.fullName)) || ($('#user-name-display') && $('#user-name-display').textContent) || '';
    n = String(n).trim().split(/\s+/)[0];
    return (!n || n === 'Fresher') ? '' : n;
  }
  var NUDGES = [
    'Small steps every day beat one long night before the exam.',
    'Recall beats rereading. Close the book and test yourself.',
    'Sleep is part of studying. Protect it this week.',
    'Start with the hardest topic while your mind is fresh.',
    'Ten focused questions today is better than none.',
    'Explain one idea out loud, as if you were teaching a friend.',
    'Past questions repeat patterns. Learn to spot them.',
    'Review yesterday\u2019s mistakes for five minutes before anything new.',
    'Phone away, timer on. Twenty-five minutes of full focus.',
    'Plan tomorrow tonight so you wake up with a clear start.',
    'You do not need to feel ready to begin. Begin, and the feeling follows.',
    'Drink water, stretch, then open your notes.',
    'One topic fully understood is worth five skimmed.',
    'Ask for help early. Every top student does.',
    'Write down three things you will finish today.',
    'Mistakes in practice are cheap. Mistakes in the exam hall are not.',
    'Study in short rounds and rest between them.',
    'Teach it, test it, then move on.',
    'Your future self is counting on the work you do today.',
    'Read the question twice before you look at the options.',
    'Consistency is quieter than motivation, and it lasts longer.',
    'Revise the topics you avoid first.',
    'A tidy desk is a small win that makes the next hour easier.',
    'Time yourself on practice papers so the real clock feels familiar.',
    'Finish what you start, even if it is only one section.',
    'Group study works when everyone prepares first.',
    'Notice progress, not just the distance left.',
    'Breathe. You have prepared more than you think.',
    'Today\u2019s drill is next week\u2019s confidence.',
    'Rest is not wasted time. It is when learning settles.'
  ];
  function dayIndex() { var d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
  function todaysNudge() { return NUDGES[dayIndex() % NUDGES.length]; }
  var LIVE = null;
  var bulb = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>';
  function signedIn() { var A = (typeof appData !== 'undefined') ? appData : null; return !!(A && A.currentUser); }
  function fmt(n) { return (typeof n === 'number' && isFinite(n)) ? n.toLocaleString('en-NG') : null; }
  function liveHtml() {
    if (!LIVE) return '';
    var t = [];
    var on = fmt(LIVE.online); if (on) t.push('<div><b><i class="r-dot"></i>' + on + '</b><span>Studying now</span></div>');
    var st = fmt(LIVE.students); if (st) t.push('<div><b>' + st + '</b><span>Students on BlastExams</span></div>');
    var ex = fmt(LIVE.examsToday); if (ex) t.push('<div><b>' + ex + '</b><span>Practice exams today</span></div>');
    return t.length ? '<div class="r-live" role="group" aria-label="Live activity" style="grid-template-columns:repeat(' + t.length + ',minmax(0,1fr))">' + t.join('') + '</div>' : '';
  }
  var lastKey = '';
  function paintGreeting() {
    var box = $('#r-glass'); if (!box) return;
    var n = userFirstName(), si = signedIn();
    var sub = ($('#home-greeting-title') && $('#home-greeting-title').textContent) || '';
    var key = [si, n, sub, LIVE && [LIVE.online, LIVE.students, LIVE.examsToday].join(), greetingWord()].join('|');
    if (key === lastKey) return; lastKey = key;
    var head;
    if (si) {
      head = '<h1 id="r-greet">' + esc(greetingWord() + (n ? ', ' + n : '')) + '</h1>' + (sub ? '<p class="r-sub">' + esc(sub) + '</p>' : '') +
        '<p class="r-nudge-line">' + bulb + '<span>' + esc(todaysNudge()) + '</span></p>';
    } else {
      head = '<p class="r-eyebrow">' + bulb + 'Daily nudge</p><h1 id="r-greet" class="r-nudge-h">' + esc(todaysNudge()) + '</h1>' +
        '<div class="r-cta"><button type="button" class="r-btn p" onclick="switchTab(\'cbt\',event)">Take a practice drill</button><button type="button" class="r-btn s" onclick="openSignInModal()">Sign in</button><button type="button" class="r-link" onclick="openAudienceSwitchModal()">Change track</button></div>';
    }
    box.innerHTML = head + liveHtml();
  }
  /* hero photo slideshow: crossfades, can be paused, stays still for people who prefer reduced motion */
  var SLIDES = ['218A7798', '218A7749', '218A7799', '218A7838', '218A8039'];
  function mountSlides(hero) {
    var wrap = ce('div', 'r-slides'); wrap.setAttribute('aria-hidden', 'true');
    SLIDES.forEach(function (n, i) {
      var b = '/images/freshers-awakening/' + n + '-web';
      wrap.appendChild(ce('div', 'r-slide' + (i ? '' : ' on'), '<picture><source type="image/webp" srcset="' + b + '.webp"><img src="' + b + '.jpg" alt="" decoding="async"' + (i ? ' loading="lazy"' : '') + '></picture>'));
    });
    hero.insertBefore(wrap, hero.firstChild);
    var cur = 0, timer = null, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, paused = reduce;
    var ctl = ce('div', 'r-hero-ctl'); ctl.setAttribute('role', 'group'); ctl.setAttribute('aria-label', 'Hero photos');
    var pb = ce('button', 'r-hero-pause'); pb.type = 'button';
    var dots = SLIDES.map(function (n, i) { var d = ce('button', 'r-dot-btn'); d.type = 'button'; d.setAttribute('aria-label', 'Show photo ' + (i + 1)); d.addEventListener('click', function () { go(i); }); return d; });
    var ico = { pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>', play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>' };
    function paint() {
      Array.prototype.forEach.call(wrap.children, function (s, i) { s.classList.toggle('on', i === cur); });
      dots.forEach(function (d, i) { d.classList.toggle('on', i === cur); d.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
      pb.innerHTML = paused ? ico.play : ico.pause; pb.setAttribute('aria-label', paused ? 'Play photo slideshow' : 'Pause photo slideshow');
    }
    function go(i) { cur = (i + SLIDES.length) % SLIDES.length; paint(); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() { stop(); if (!paused && !document.hidden) timer = setInterval(function () { go(cur + 1); }, 6000); }
    pb.addEventListener('click', function () { paused = !paused; paint(); start(); });
    document.addEventListener('visibilitychange', start);
    ctl.appendChild(pb); dots.forEach(function (d) { ctl.appendChild(d); }); hero.appendChild(ctl);
    paint(); start();
  }
  function buildHero(banner) {
    if (!banner || $('#r-glass')) return;
    var hero = ce('section', 'r-hero', '<div class="r-glass" id="r-glass" aria-live="polite"></div>');
    hero.setAttribute('aria-label', 'Welcome');
    banner.appendChild(hero);
    mountSlides(hero);
    paintGreeting();
  }
  /* live activity: anonymous presence ping + public counters (hidden if the endpoint is unavailable) */
  function visitorId() {
    try { var v = localStorage.getItem('be_vid'); if (!v) { v = 'v' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('be_vid', v); } return v; } catch (e) { return 'v' + Math.random().toString(36).slice(2, 12) + 'anon'; }
  }
  function pingAndLoad() {
    if (document.hidden) return;
    fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vid: visitorId() }) }).catch(function () {})
      .then(function () { return fetch('/api/stats/live'); })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.success && j.data) { LIVE = j.data; lastKey = ''; paintGreeting(); } })
      .catch(function () {});
  }
  function buildDashboard() {
    var home = $('#tab-home'); if (!home || home.getAttribute('data-r-built')) return;
    home.setAttribute('data-r-built', '1');
    var banner = $('#home-context-banner'), search = $('#academic-search-anchor'), hero = $('#home-primary-hero-wrap'),
        quick = $('#home-quick-launchpad'), cbt = $('#home-cbt-launchpad-section'), carousel = $('#fa-hero-carousel'),
        guides = $('#home-featured-guides'), hub = $('#personalized-hub-section');

    buildHero(banner);
    /* search sits directly under the greeting */
    if (search && banner) banner.insertAdjacentElement('afterend', search);

    /* two-column grid */
    var grid = ce('div', 'r-dash'), main = ce('div', 'r-col'), side = ce('div', 'r-col');
    grid.appendChild(main); grid.appendChild(side);
    (search || banner || home).insertAdjacentElement('afterend', grid);
    if (hero) main.appendChild(hero);
    if (cbt) main.appendChild(cbt);
    if (quick) {
      var ex = ce('section', 'r-card', '<h2>Explore</h2>'); ex.setAttribute('aria-label', 'Explore');
      ex.appendChild(quick); quick.style.marginTop = '20px'; main.appendChild(ex);
    }

    /* progress card */
    var prog = ce('section', 'r-card', '<h2>Your progress</h2><div id="r-progress-body"></div>');
    side.appendChild(prog); paintProgress();

    /* popular guides card */
    var pg = ce('section', 'r-card', '<div class="r-row"><h2>Popular guides</h2><button class="r-link" type="button" onclick="switchTab(\'guides\',event)">All guides</button></div><div id="r-guides-list" style="margin-top:12px"></div>');
    side.appendChild(pg);
    if (guides) guides.style.display = 'none';
    paintPopularGuides();

    /* event card (the Freshers Awakening carousel keeps working inside it) */
    var ev = ce('section', 'r-card r-event', '');
    ev.setAttribute('aria-labelledby', 'r-ev-title');
    if (carousel) { carousel.removeAttribute('style'); ev.appendChild(carousel); }
    ev.appendChild(ce('div', 'r-event-body',
      '<p class="r-eyebrow">Upcoming event</p><h2 id="r-ev-title">Freshers Awakening</h2><p>Locked In: The First-Class Mindset</p>' +
      '<p class="r-meta">ICC, University of Ibadan<br>All 100L &amp; DE freshers · Free entry</p>' +
      '<a class="btn-white" target="_blank" rel="noopener noreferrer" href="https://chat.whatsapp.com/KNFYXP7nTlZApyHOgHr5oJ?mode=gi_t">Join the community</a>'));
    side.appendChild(ev);

    /* leftover marketing blocks stay hidden by CSS; make sure the heading row above the old guides grid goes too */
    if (guides && guides.previousElementSibling) guides.previousElementSibling.classList.add('r-hide');
    if (hub) hub.style.display = 'none';
  }

  /* ---------- 2. Progress ---------- */
  function paintProgress() {
    var b = $('#r-progress-body'); if (!b) return;
    var isUtme = typeof window.getActiveAudience === 'function' && window.getActiveAudience() === 'UTME_STUDENT';
    var empty = '<div class="r-prog-empty"><b>No attempts yet</b><p>Take a 10-question drill and your scores will show up here.</p>' +
      '<button class="r-btn s" type="button" onclick="switchTab(\'cbt\',event);' + (isUtme ? "switchCbtMode('UTME')" : "switchCbtMode('100L')") + '">Take a drill</button></div>';
    b.innerHTML = empty;
    if (!isUtme) return;
    fetch('/api/utme/progress/dashboard', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var d = j && j.data; if (!d) return;
      var list = d.recentAttempts || d.attempts || d.recent || [];
      if (!list.length) return;
      b.innerHTML = list.slice(0, 4).map(function (a) {
        var pct = Math.round(a.percentage != null ? a.percentage : (a.score != null && a.total ? a.score / a.total * 100 : 0));
        return '<div class="r-score-row"><div style="flex:1"><span>' + esc(a.title || a.subject || a.subjectCode || 'Mock exam') + '</span><div class="r-bar"><i style="width:' + pct + '%"></i></div></div><b style="margin-left:14px">' + pct + '%</b></div>';
      }).join('');
    }).catch(function () {});
  }

  /* ---------- 3. Popular guides (list instead of cards) ---------- */
  function paintPopularGuides() {
    var c = $('#r-guides-list'); if (!c) return;
    var A = (typeof appData !== 'undefined') ? appData : null; var g = (A && A.guides) || [];
    if (!g.length) { c.innerHTML = '<p style="color:var(--r-soft);font-size:15px;padding:8px 0">Guides are loading…</p>'; return; }
    c.innerHTML = g.slice(0, 5).map(function (x) {
      return '<button type="button" class="r-list-item" onclick="openGuideDetail(\'' + esc(x.id) + '\')"><span>' + esc(x.title) + (x.readTime ? '<small>' + esc(x.readTime) + '</small>' : '') + '</span>' + chev + '</button>';
    }).join('');
  }
  var _rh = window.renderHome;
  window.renderHome = function () { if (_rh) try { _rh.apply(this, arguments); } catch (e) {} paintPopularGuides(); };

  /* ---------- 4. Navigation polish ---------- */
  var TITLES = { home: 'Dashboard', catalog: 'Course Catalog', guides: 'Survival Guides', 'guide-detail': 'Guide', resources: 'Courses & Vault', opportunities: 'Opportunities', cbt: 'CBT Practice', faqs: 'FAQ & AI' };
  var _sw = window.switchTab;
  if (_sw) window.switchTab = function (tabId) {
    var r = _sw.apply(this, arguments);
    try {
      document.title = (TITLES[tabId] || 'BlastExams') + ' · BlastExams';
      var t = $('#tab-' + tabId); if (t) { t.style.animation = 'rfade .25s ease-out'; }
      window.scrollTo({ top: 0, behavior: 'auto' });
      paintGreeting();
    } catch (e) {}
    return r;
  };
  var st = ce('style', '', '@keyframes rfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'); document.head.appendChild(st);

  /* keyboard: "/" focuses search, Esc closes results */
  document.addEventListener('keydown', function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag)) {
      var i = $('#global-search-input'); if (i) { e.preventDefault(); if (window.switchTab && !$('#tab-home.active')) window.switchTab('home'); i.focus(); }
    }
    if (e.key === 'Escape' && typeof window.closeGlobalSearchResults === 'function') window.closeGlobalSearchResults();
  });

  /* skip link + main landmark */
  var skip = ce('a', 'r-skip', 'Skip to content'); skip.href = '#main-content';
  document.body.insertBefore(skip, document.body.firstChild);
  var m = $('main'); if (m && !m.id) m.id = 'main-content';

  /* search input label + placeholder */
  var si = $('#global-search-input');
  if (si) { si.setAttribute('aria-label', 'Search courses, guides and past questions'); si.placeholder = 'Search courses, guides, past questions'; si.setAttribute('type', 'search'); si.setAttribute('autocomplete', 'off'); }


  /* ---------- 5. Search suggestions: only the person's own earlier searches, only while typing ---------- */
  (function () {
    var inp = $('#global-search-input'), box = $('.search-box'); if (!inp || !box) return;
    var wrap = box.parentNode, MAX = 8, items = [], idx = -1;
    var clock = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    function key() { var A = (typeof appData !== 'undefined') ? appData : null; return 'be_search_history:' + ((A && A.currentUser && A.currentUser.id) || 'guest'); }
    function load() { try { return JSON.parse(localStorage.getItem(key()) || '[]'); } catch (e) { return []; } }
    function save(a) { try { localStorage.setItem(key(), JSON.stringify(a.slice(0, MAX))); } catch (e) {} }
    function remember(q) { q = String(q || '').trim(); if (q.length < 2) return; var a = load().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); }); a.unshift(q); save(a); }
    var list = ce('div', 'r-suggest'); list.id = 'r-suggest'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Your recent searches'); list.hidden = true; wrap.appendChild(list);
    inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-controls', 'r-suggest'); inp.setAttribute('aria-autocomplete', 'list'); inp.setAttribute('aria-expanded', 'false');
    function hide() { list.hidden = true; idx = -1; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); }
    function mark() { Array.prototype.forEach.call(list.querySelectorAll('.r-sg'), function (el, i) { el.classList.toggle('on', i === idx); el.setAttribute('aria-selected', i === idx); }); if (idx >= 0) inp.setAttribute('aria-activedescendant', 'r-sg-' + idx); else inp.removeAttribute('aria-activedescendant'); }
    function show() {
      var v = inp.value.trim().toLowerCase(); if (!v) return hide();
      items = load().filter(function (x) { var l = x.toLowerCase(); return l !== v && l.indexOf(v) !== -1; }).slice(0, 5);
      if (!items.length) return hide();
      list.innerHTML = items.map(function (x, i) { return '<div role="option" id="r-sg-' + i + '" class="r-sg" data-i="' + i + '">' + clock + '<span>' + esc(x) + '</span></div>'; }).join('') + '<button type="button" class="r-sg-clear">Clear search history</button>';
      list.style.top = (box.offsetTop + box.offsetHeight + 8) + 'px';
      list.hidden = false; idx = -1; inp.setAttribute('aria-expanded', 'true');
    }
    function pick(i) { inp.value = items[i]; hide(); if (window.executeGlobalSearch) window.executeGlobalSearch(); }
    var _ex = window.executeGlobalSearch;
    window.executeGlobalSearch = function () { remember(inp.value); hide(); return _ex ? _ex.apply(this, arguments) : undefined; };
    inp.addEventListener('input', show);
    inp.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; mark(); }
      else if (e.key === 'Escape') { hide(); }
      else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); e.stopImmediatePropagation(); pick(idx); }
    }, true);
    list.addEventListener('mousedown', function (e) {
      e.preventDefault();
      if (e.target.closest('.r-sg-clear')) { try { localStorage.removeItem(key()); } catch (x) {} return hide(); }
      var o = e.target.closest('.r-sg'); if (o) pick(+o.getAttribute('data-i'));
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) hide(); });
    var ov = $('#global-search-results-overlay'); if (ov) ov.addEventListener('click', function () { remember(inp.value); });
  })();

  /* short track label in the profile menu (one line: "Track: 100L  Change") */
  (function () {
    var map = { 'UTME Prep': 'UTME', 'UI 100-Level': '100L' };
    function fix() { var el = $('#audience-badge-label'); if (el && map[el.textContent.trim()]) el.textContent = map[el.textContent.trim()]; }
    fix(); var el = $('#audience-badge-label');
    if (el) new MutationObserver(fix).observe(el, { childList: true, characterData: true, subtree: true });
  })();

  /* profile menu: keyboard and screen-reader support */
  (function () {
    var pill = $('.user-profile-pill'), menu = $('#user-dropdown-menu'); if (!pill || !menu) return;
    pill.setAttribute('role', 'button'); pill.tabIndex = 0; pill.setAttribute('aria-haspopup', 'true'); pill.setAttribute('aria-expanded', 'false');
    new MutationObserver(function () { pill.setAttribute('aria-expanded', String(menu.classList.contains('show'))); }).observe(menu, { attributes: true, attributeFilter: ['class'] });
    pill.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pill.click(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('show')) { menu.classList.remove('show'); pill.focus(); } });
  })();

  /* theme toggle + back to top */
  function sunMoon() {
    var a = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    return '<svg class="r-sun" ' + a + '><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg><svg class="r-moon" ' + a + '><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('be_theme', t); } catch (e) {}
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t === 'dark' ? '#0D0B14' : '#ffffff');
    var b = $('#r-theme'); if (b) { b.setAttribute('aria-pressed', t === 'dark'); b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); b.title = b.getAttribute('aria-label'); }
  }
  function mountThemeToggle() {
    if ($('#r-theme')) return;
    var hc = $('.header-container'); if (!hc) return;
    var b = ce('button', 'r-theme-btn', sunMoon()); b.id = 'r-theme'; b.type = 'button';
    b.addEventListener('click', function () { setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });
    var rg = $('.header-right-group'), au = $('#auth-nav-container');
    if (rg) rg.insertBefore(b, au && au.parentNode === rg ? au : null); else hc.appendChild(b);
    setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) { try { if (!localStorage.getItem('be_theme')) setTheme(e.matches ? 'dark' : 'light'); } catch (x) {} });
  }
  function mountTop() {
    var t = $('#r-top'); if (!t) return;
    t.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var on = function () { t.classList.toggle('show', window.scrollY > 600); };
    window.addEventListener('scroll', on, { passive: true }); on();
  }

  /* ---------- boot ---------- */
  function boot() { mountThemeToggle(); mountTop(); buildDashboard(); paintGreeting(); pingAndLoad(); setInterval(pingAndLoad, 60000); setInterval(paintGreeting, 1500); document.addEventListener('visibilitychange', function () { if (!document.hidden) pingAndLoad(); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  /* keep greeting + progress in sync with auth / track changes */
  var un = $('#user-name-display'); if (un && window.MutationObserver) new MutationObserver(paintGreeting).observe(un, { childList: true, characterData: true, subtree: true });
  var ab = $('#audience-badge-label'); if (ab && window.MutationObserver) new MutationObserver(paintProgress).observe(ab, { childList: true, characterData: true, subtree: true });
  /* Visitors who are not signed in used to see empty Guides/FAQ/Home lists: those endpoints are public, so load them. */
  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
        if (typeof appData !== 'undefined' && !appData.currentUser && !(appData.guides || []).length && typeof fetchAllData === 'function') {
          fetchAllData().then(function () { paintPopularGuides(); }).catch(function () {});
        }
      } catch (e) {}
      paintPopularGuides(); paintGreeting();
    }, 600);
  });
  setInterval(function () { if ($('#r-guides-list') && /loading/i.test($('#r-guides-list').textContent)) paintPopularGuides(); }, 1200);
})();
