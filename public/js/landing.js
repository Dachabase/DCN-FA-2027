/* Landing page for signed-out visitors. The server also refuses data to signed-out requests, so this is the front door, not the lock. */
(function () {
  'use strict';
  var root = document.documentElement, signedIn = false, built = false, page = null;
  var ce = function (t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var LOCK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  var BADGE = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var GSVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>';
  var PHOTOS = ['218A7798', '218A7749', '218A7838'];
  /* Where the photos live: 'behind' = a photo backdrop behind the hero text (default), 'below' = a photo collage under the hero text. */
  var PHOTO_MODE = 'behind';
  var PICS = PHOTOS.map(function (n, i) { var b = '/images/freshers-awakening/' + n + '-web'; return '<picture class="bl-ph p' + (i + 1) + '"><source type="image/webp" srcset="' + b + '.webp"><img src="' + b + '.jpg" alt="" ' + (i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async"></picture>'; }).join('');
  var BG = '<div class="bl-bg" aria-hidden="true"><div class="bl-glow"></div></div>';
  var SLIDES = '<div class="bl-slides" aria-hidden="true">' + PICS + '<div class="bl-scrim"></div></div>';
  var COLLAGE = '<div class="bl-collage" aria-hidden="true">' + PICS + '</div>';
  var SUN = '<svg class="r-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>';
  var MOON = '<svg class="r-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
  var CAP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg>';
  var CARDS = [
    { n: 'c1', k: 'the 100L CBT exams', h: '<div class="bl-top2"><b>COS 101</b><span class="bl-pill">24:10</span></div><div class="bl-muted">Question 7 of 40</div><div class="bl-opt">A. Assembly</div><div class="bl-opt on">B. Python</div><div class="bl-opt">C. Machine code</div>' },
    { n: 'c2', k: 'instant results', h: '<div class="bl-row"><svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--r-line,#E2E8F0)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="#7C3AED" stroke-width="7" stroke-dasharray="134 163" stroke-linecap="round" transform="rotate(-90 32 32)"/></svg><div><b style="font-size:20px">82%</b><div class="bl-muted">33 of 40 correct</div></div></div>' },
    { n: 'c3', k: 'the JAMB UTME mock', h: '<div class="bl-top2"><b>JAMB UTME</b><span class="bl-pill">Mock</span></div><div class="bl-muted">Full simulation</div><div class="bl-chips"><span>180 questions</span><span>120 minutes</span></div>' },
    { n: 'c4', k: 'the Course Vault', h: '<div class="bl-top2"><b>MAT111 Vault</b><span class="bl-pill">Drive</span></div><div class="bl-muted">Slides, tutorial sheets and past papers</div><div class="bl-chips"><span>PDF</span><span>PPT</span><span>Past questions</span></div>' },
    { n: 'c5', k: 'the survival guides', h: '<div class="bl-top2"><span class="bl-pill">Grading System</span><span class="bl-ver" style="color:#7C3AED">' + BADGE + '</span></div><b>Understanding the UI 5.0 CGPA Grading System</b><div class="bl-muted" style="margin-top:4px">5 min read</div>' },
    { n: 'c6', k: 'the course catalog', h: '<div class="bl-top2"><span class="bl-pill">Computing</span><span class="bl-muted">5 depts</span></div><b>Computer Science and AI</b><div class="bl-chips"><span>Cybersecurity</span><span>Software Engineering</span></div>' },
    { n: 'c7', k: 'search', h: '<div class="bl-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><b>MAT101</b></div><div class="bl-muted" style="margin-top:8px">Courses, guides and past questions</div>' },
    { n: 'c8', k: 'FAQ and AI help', h: '<div class="bl-top2"><b>FAQ and AI</b><span class="bl-pill">Ask</span></div><div class="bl-opt">How many units can I register?</div><div class="bl-bar"><i style="width:68%"></i></div>' }
  ];
  function ico(d) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var FI = [
    ico('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="m9 10 2 2 4-4"/>'),
    ico('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'),
    ico('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>'),
    ico('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
    ico('<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
    ico('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    ico('<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>'),
    ico('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')
  ];
  var FEATS = [
    ['100L CBT exams', 'Timed practice under real UI hall conditions, with instant scoring and explained answers.', '<strong data-stat="questions">3,826</strong>'],
    ['JAMB UTME mock', 'Full simulations of 180 questions in 120 minutes, plus quick drills by subject.', '<strong data-stat="utmeQuestions">UTME</strong>'],
    ['Course Vault', 'Lecture slides, textbooks, tutorial sheets and past papers in one searchable place.', '<strong data-stat="materials">1,866</strong>'],
    ['Survival guides', 'Verified guides on registration, CGPA, hostels, lecture venues and campus life.', '<strong><span class="bl-vb">' + BADGE + '</span>Verified</strong>'],
    ['Course catalog', 'Departmental course packages across every faculty, with the courses that matter most.', '<strong>Every faculty</strong>'],
    ['Search', 'Find any course code, guide or material in seconds, with your own recent searches.', '<strong>Instant</strong>'],
    ['FAQ and AI help', 'Quick answers about courses and campus life, with an AI assistant when you need more.', '<strong>Ask anything</strong>'],
    ['Made for you', 'Your faculty, department and level shape what you see first.', '<strong>Personal</strong>']
  ];
  var GUIDES = [
    ['Course Registration', '100L Course Registration & Subject Combination Guide', 'Step-by-step walkthrough for registering 100L compulsory and elective courses at UI, credit load limits, and course adviser validation.'],
    ['Grading System', 'Understanding the UI 5.0 CGPA Grading System & Academic Standing', "Comprehensive guide to grade points, semester GPA calculation, probation limits, and degree classifications on UI's 5.0 scale."],
    ['Lecture Venues', 'Lecture Venues & Campus Navigation Map', 'Locate Large Lecture Theatres (LLT), ICT Center, Science Lecture Theater, Faculty labs, and campus complexes.'],
    ['Faculty Survival', 'Faculty Freshers Survival Guides', 'A survival guide for freshers in every faculty, from Agriculture to Basic Medical Sciences and Computing.']
  ];

  function fnGoogle(e) { if (typeof window.handleGoogleBtnClick === 'function') window.handleGoogleBtnClick(e); else location.href = '/api/auth/google/login'; }
  function fnSignIn() { if (typeof window.openSignInModal === 'function') window.openSignInModal(); }

  function build(note) {
    page = ce('div'); page.id = 'be-landing';
    page.className = 'bl-mode-' + PHOTO_MODE;
    page.innerHTML =
      '<header class="bl-head"><div class="bl-head-in">' +
      '<a class="bl-brand" href="#/home" id="bl-brand" aria-label="BlastExams home"><span class="bl-logo">' + CAP + '</span><span class="bl-bt">BlastExams<i>.</i></span></a>' +
      '<div class="bl-head-r"><button type="button" class="bl-icon-btn" id="bl-theme">' + SUN + MOON + '</button><button type="button" class="bl-btn p bl-sm" id="bl-signin">Sign in</button></div>' +
      '</div></header>' +
      '<div class="bl-wrap">' +
      (note ? '<p class="bl-note" role="status">' + esc(note) + '</p>' : '') +
      '<main id="bl-main"><section class="bl-hero" aria-labelledby="bl-h1"><div class="bl-copy">' + (PHOTO_MODE === 'behind' ? SLIDES : '') + '<div class="bl-copy-in"><span class="bl-eyebrow">University of Ibadan freshers and JAMB candidates</span>' +
      '<h1 id="bl-h1">Your first year, one sign-in away.</h1><p class="lead">Past questions, course materials and survival guides, all in one place. Everything you can see floating here opens the moment you sign in.</p>' +
      '<div class="bl-cta"><button class="bl-btn p" id="bl-google" type="button"><span class="bl-g">' + GSVG + '</span>Continue with Google</button><button class="bl-btn s" id="bl-email" type="button">Use email instead</button></div>' +
      (PHOTO_MODE === 'below' ? COLLAGE : '') + '</div>' +
      '</div>' +
      '<div class="bl-stage" id="bl-stage">' + BG +
      CARDS.map(function (c) { return '<button type="button" class="bl-card ' + c.n + '" data-k="' + esc(c.k) + '" aria-label="Preview of ' + esc(c.k) + ' (sign in to open)"><span class="bl-in" aria-hidden="true"><span class="bl-lock">' + LOCK + '</span>' + c.h + '</span></button>'; }).join('') +
      '<div class="bl-bubble" id="bl-bubble" role="status" hidden></div></div></section>' +
      '<section class="bl-sec" aria-labelledby="bl-h2"><h2 id="bl-h2">What opens when you sign in</h2><p class="sub">One account unlocks every tool below, on your phone or your laptop.</p><ul class="bl-feats">' +
      FEATS.map(function (f, i) { return '<li><div class="bl-fh"><span class="bl-fi">' + FI[i] + '</span>' + f[2] + '</div><h3>' + esc(f[0]) + '</h3><p>' + esc(f[1]) + '</p></li>'; }).join('') + '</ul></section>' +
      '<section class="bl-sec" aria-labelledby="bl-h3"><div class="bl-folder-wrap"><div><h2 id="bl-h3">A whole folder of survival guides</h2><p class="sub">Course registration, the 5.0 CGPA system, hostels, lecture venues and every faculty\u2019s survival tips, all kept in one folder. Open it and sign in to read everything inside.</p><button class="bl-btn s bl-gnext" id="bl-gnext" type="button">' + LOCK + 'Open the folder</button></div>' +
      '<button type="button" class="bl-folder" id="bl-folder" aria-label="Open the Guides folder (sign in required)"><span class="bl-fback" aria-hidden="true"><span class="bl-fpapers">' +
      GUIDES.map(function (g, i) { return '<span class="bl-paper k' + (i + 1) + '"><span class="bl-pill">' + esc(g[0]) + '</span><span class="bl-pt">' + esc(g[1]) + '</span></span>'; }).join('') +
      '</span></span><span class="bl-ffront" aria-hidden="true"><span class="bl-ft">Survival Guides</span><span class="bl-fs">Tap to open</span></span><span class="bl-flock" aria-hidden="true">' + LOCK + '</span></button></div></section>' +
      '<section class="bl-final" aria-labelledby="bl-h4"><h2 id="bl-h4">Ready to catch it all?</h2><p>Sign in and everything above is yours.</p><div class="bl-cta"><button class="bl-btn w" id="bl-google2" type="button">' + GSVG + 'Continue with Google</button><button class="bl-btn o" id="bl-email2" type="button">Create an account</button></div></section></main>' +
      '</div>' +
      '<footer class="bl-foot2"><div class="bl-foot2-in"><div class="bl-foot2-top"><div class="bl-foot2-brand"><div class="bl-foot2-logo">BlastExams<span>.</span></div>' +
      '<p>Free exam practice, course materials and survival guides for University of Ibadan students.</p><p class="by">Powered by <strong>Disciples Christian Network</strong></p></div>' +
      '<div class="bl-social"><a href="https://t.me/UIDCNComputingFreshersBot" target="_blank" rel="noopener noreferrer" aria-label="Open the Telegram study assistant"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg></a>' +
      '<a href="https://chat.whatsapp.com/KNFYXP7nTlZApyHOgHr5oJ?mode=gi_t" target="_blank" rel="noopener noreferrer" aria-label="Join the WhatsApp community"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg></a></div></div>' +
      '<div class="bl-foot2-bot">&copy; 2026 <strong>BlastExams</strong>. Grounded in official University of Ibadan Senate regulations.</div></div></footer>' +
      '<button type="button" class="bl-top" id="bl-top" aria-label="Back to top"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>' +
      '<div class="bl-modal" id="bl-modal" role="dialog" aria-modal="true" aria-labelledby="bl-mt" hidden><div class="bl-sheet"><span class="bl-eyebrow" id="bl-mc"></span><h3 id="bl-mt"></h3><p id="bl-md"></p><ul class="bl-ml" id="bl-ml"></ul><div class="bl-cta"><button class="bl-btn p" id="bl-mgo" type="button">Sign in to read it</button><button class="bl-btn s" id="bl-mx" type="button">Close</button></div></div></div>';
    document.body.appendChild(page);
    wire(); stats(); folder(); fadeNote();
  }

  function wire() {
    var top = $('#bl-top');
    if (top) { top.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }; var onS = function () { top.classList.toggle('show', window.scrollY > 700); }; window.addEventListener('scroll', onS, { passive: true }); onS(); }
    $('#bl-signin').onclick = fnSignIn;
    $('#bl-brand').onclick = function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    var tb = $('#bl-theme');
    function paintTheme() { var d = root.getAttribute('data-theme') === 'dark'; tb.setAttribute('aria-label', d ? 'Switch to light theme' : 'Switch to dark theme'); tb.title = tb.getAttribute('aria-label'); tb.setAttribute('aria-pressed', d ? 'true' : 'false'); }
    tb.onclick = function () {
      var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', t); try { localStorage.setItem('be_theme', t); } catch (e) {}
      var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t === 'dark' ? '#0D0B14' : '#ffffff');
      paintTheme();
    };
    paintTheme();
    if (window.MutationObserver) new MutationObserver(paintTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    $('#bl-email').onclick = fnSignIn; $('#bl-email2').onclick = fnSignIn;
    $('#bl-google').onclick = fnGoogle; $('#bl-google2').onclick = fnGoogle;
    var stage = $('#bl-stage'), cards = Array.prototype.slice.call(stage.querySelectorAll('.bl-card')), bubble = $('#bl-bubble'), timer;
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function say(card) {
      var r = card.getBoundingClientRect(), s = stage.getBoundingClientRect();
      bubble.innerHTML = 'Sign in to open ' + esc(card.getAttribute('data-k')) + '.<br><button type="button" id="bl-bgo">Sign in</button>';
      bubble.hidden = false; bubble.style.left = Math.max(8, Math.min(r.left - s.left, s.width - 240)) + 'px'; bubble.style.top = (r.bottom - s.top + 8) + 'px';
      $('#bl-bgo').onclick = fnSignIn; clearTimeout(timer); timer = setTimeout(function () { bubble.hidden = true; }, 5000);
    }
    cards.forEach(function (c) { c.addEventListener('click', function () { say(c); }); });
    if (!calm) {
      stage.addEventListener('pointermove', function (e) {
        var near = false;
        cards.forEach(function (c) {
          var r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = cx - e.clientX, dy = cy - e.clientY, d = Math.sqrt(dx * dx + dy * dy) || 1, in_ = c.firstElementChild;
          if (d < 150) { var k = (150 - d) / 150 * 70; in_.style.setProperty('--dx', (dx / d * k) + 'px'); in_.style.setProperty('--dy', (dy / d * k) + 'px'); near = true; }
          else { in_.style.setProperty('--dx', '0px'); in_.style.setProperty('--dy', '0px'); }
        });
      });
      stage.addEventListener('pointerleave', function () { cards.forEach(function (c) { c.firstElementChild.style.setProperty('--dx', '0px'); c.firstElementChild.style.setProperty('--dy', '0px'); }); });
    }
    $('#bl-mx').onclick = closeModal; $('#bl-mgo').onclick = function () { closeModal(); fnSignIn(); };
    $('#bl-modal').addEventListener('click', function (e) { if (e.target.id === 'bl-modal') closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }
  function fadeNote() {
    var n = $('.bl-note'); if (!n) return;
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () {
      if (calm) { n.remove(); return; }
      n.style.maxHeight = n.offsetHeight + 'px'; void n.offsetHeight; n.classList.add('gone');
      setTimeout(function () { if (n.parentNode) n.remove(); }, 700);
    }, 2000);
  }
  function closeModal() { var m = $('#bl-modal'); if (m) m.hidden = true; }

  function folder() {
    function open() {
      $('#bl-mc').textContent = 'Survival Guides';
      $('#bl-mt').textContent = 'This folder opens when you sign in';
      $('#bl-md').textContent = 'Inside you will find verified guides like these, plus more for every faculty:';
      $('#bl-ml').innerHTML = GUIDES.map(function (g) { return '<li>' + esc(g[1]) + '</li>'; }).join('');
      $('#bl-mgo').textContent = 'Sign in to open it';
      var m = $('#bl-modal'); m.hidden = false; $('#bl-mx').focus();
    }
    $('#bl-folder').onclick = open; $('#bl-gnext').onclick = open;
  }

  function stats() {
    fetch('/api/public/landing', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var d = j && j.data; if (!d) return;
      Object.keys(d).forEach(function (k) { var el = $('[data-stat="' + k + '"]'); if (el && typeof d[k] === 'number' && d[k] > 0) el.textContent = d[k].toLocaleString('en-NG'); });
    }).catch(function () {});
  }

  function remember() { var h = location.hash; if (h && !/^#\/?(home)?$/.test(h)) { try { sessionStorage.setItem('be_return', h); } catch (e) {} } }
  function mount(note) {
    if (built) return; built = true; remember(); build(note);
    root.classList.add('be-landing-on'); root.classList.remove('be-checking');
    document.addEventListener('click', function (e) {
      if (!root.classList.contains('be-landing-on') || !e.target.closest('#header-google-signin-btn')) return;
      e.preventDefault(); e.stopImmediatePropagation(); fnSignIn();
    }, true);
    var poll = setInterval(function () { if (typeof appData !== 'undefined' && appData.currentUser) { clearInterval(poll); location.reload(); } }, 700);
  }
  function enter() {
    signedIn = true; root.classList.remove('be-checking');
    var back = null; try { back = sessionStorage.getItem('be_return'); sessionStorage.removeItem('be_return'); } catch (e) {}
    if (back) setTimeout(function () { location.hash = back; }, 0);
  }
  function expire() { if (!signedIn) return; signedIn = false; mount('Your session ended. Please sign in to continue.'); }

  var nativeFetch = window.fetch;
  window.fetch = function (input) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    return nativeFetch.apply(this, arguments).then(function (res) {
      try {
        if (signedIn && /\/api\//.test(url)) {
          if (res.status === 401 && !/\/api\/auth\//.test(url)) expire();
          else if (/\/api\/auth\/me/.test(url) && res.ok) res.clone().json().then(function (j) { if (j && j.authenticated === false) expire(); }).catch(function () {});
        }
      } catch (e) {}
      return res;
    });
  };

  nativeFetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : { authenticated: false }; })
    .then(function (j) { if (j && j.authenticated === true) enter(); else mount(); })
    .catch(function () { root.classList.remove('be-checking'); });
})();
