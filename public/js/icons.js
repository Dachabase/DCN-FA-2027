/* BlastExams icon layer: turns :ic-name: tokens (and any stray emoji / text arrows in server content) into inline SVG icons,
   and removes em dashes and en dashes from everything shown on screen. Runs on the whole document, including text added later. */
(function () {
  'use strict';
  var P = {
    'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'timer': '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    'hourglass': '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4A2 2 0 0 0 7 17.8V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>',
    'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    'bar-chart': '<path d="M12 20V10M18 20V4M6 20v-4"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'clipboard': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h4"/>',
    'layers': '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    'shuffle': '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    'rotate': '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    'backspace': '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><path d="m18 9-6 6M12 9l6 6"/>',
    'circle': '<circle cx="12" cy="12" r="9"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'x': '<path d="M18 6 6 18M6 6l12 12"/>',
    'alert': '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    'moon': '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'library': '<path d="m16 6 4 14M12 6v14M8 8v12M4 4v16"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    'scroll': '<path d="M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
    'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    'flask': '<path d="M10 2v7.3L4 20a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 20l-6-10.7V2M8.5 2h7M7 16h10"/>',
    'flag': '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 8 2a6 6 0 0 0 4-1.5v10a6 6 0 0 1-4 1.5c-3 0-5-2-8-2a6 6 0 0 0-4 1.5"/>',
    'share': '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
    'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
    'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>'
  };
  var EMO = { '\u26A1': 'zap', '\u23F1': 'timer', '\u23F3': 'hourglass', '\uD83D\uDCD6': 'book-open', '\uD83D\uDCCA': 'bar-chart', '\uD83D\uDD0D': 'search', '\uD83D\uDCCB': 'clipboard',
    '\uD83D\uDDC2': 'layers', '\uD83D\uDD00': 'shuffle', '\uD83D\uDCC8': 'trending-up', '\u21BB': 'rotate', '\u21B7': 'rotate', '\u232B': 'backspace', '\u25CB': 'circle', '\u2713': 'check', '\u2714': 'check',
    '\u2705': 'check', '\u2715': 'x', '\u2717': 'x', '\u274C': 'x', '\u26A0': 'alert', '\u2600': 'sun', '\uD83C\uDF19': 'moon', '\uD83C\uDFAF': 'target', '\uD83D\uDCDA': 'library',
    '\uD83D\uDCDD': 'file-text', '\uD83D\uDCDC': 'scroll', '\uD83D\uDCD8': 'book', '\uD83D\uDD2C': 'flask', '\uD83D\uDEA9': 'flag', '\uD83C\uDFF3': 'flag', '\u238B': 'share',
    '\u2192': 'arrow-right', '\u2190': 'arrow-left', '\u2197': 'arrow-up-right', '\u2193': 'arrow-down' };
  var keys = Object.keys(EMO).map(function (k) { return k.replace(/[\u0000-\uFFFF]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); }); });
  var RE = new RegExp(':ic-([a-z0-9-]+):|(' + keys.join('|') + ')\\uFE0F?', 'g');
  var STRAY = /[\uD83C-\uD83E][\uDC00-\uDFFF]\uFE0F?|[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D]/g;
  function svg(name) {
    var p = P[name]; if (!p) return null;
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '1em'); s.setAttribute('height', '1em'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'be-ic'); s.innerHTML = p; return s;
  }
  function dashes(t) {
    return t.replace(/\s*\u2014\s*/g, ', ').replace(/(\d)\s*\u2013\s*(\d)/g, '$1 to $2').replace(/\s*\u2013\s*/g, ' - ');
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 0 };
  var PLAIN = { OPTION: 1, TITLE: 1 };
  function fix(node) {
    var t = node.nodeValue; if (!t) return;
    var par = node.parentNode; if (!par || SKIP[par.nodeName]) return;
    var o = t; t = dashes(t);
    var hasTok = RE.test(t); RE.lastIndex = 0;
    var stray = STRAY.test(t); STRAY.lastIndex = 0;
    if (!hasTok && !stray) { if (t !== o) node.nodeValue = t; return; }
    if (PLAIN[par.nodeName]) { node.nodeValue = t.replace(RE, '').replace(STRAY, ''); return; }
    var frag = document.createDocumentFragment(), last = 0, m;
    while ((m = RE.exec(t))) {
      var name = m[1] || EMO[m[2]]; var el = name && svg(name);
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index).replace(STRAY, '')));
      if (el) frag.appendChild(el);
      last = m.index + m[0].length;
    }
    RE.lastIndex = 0;
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last).replace(STRAY, '')));
    par.replaceChild(frag, node);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { fix(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fix);
    if (root.getAttribute) ['title', 'placeholder', 'aria-label', 'alt'].forEach(function (a) {
      var v = root.getAttribute(a); if (v && /[\u2014\u2013]|:ic-|[\u2190-\u2193\u2197\u26A1\u2600-\u27BF]/.test(v)) root.setAttribute(a, dashes(v).replace(RE, '').replace(STRAY, '').replace(/[\u2190-\u2193\u2197]/g, '').trim());
    });
    if (root.querySelectorAll) root.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(function (e) { walk.attr(e); });
  }
  walk.attr = function (e) {
    ['title', 'placeholder', 'aria-label', 'alt'].forEach(function (a) {
      var v = e.getAttribute(a); if (v && /[\u2014\u2013]|:ic-|[\u2190-\u2193\u2197\u2600-\u27BF]|[\uD83C-\uD83E]/.test(v)) e.setAttribute(a, dashes(v).replace(RE, '').replace(STRAY, '').replace(/[\u2190-\u2193\u2197]/g, '').replace(/\s+/g, ' ').trim());
    });
  };
  var busy = false;
  var mo = new MutationObserver(function (muts) {
    if (busy) return; busy = true;
    try { muts.forEach(function (m) {
      if (m.type === 'characterData') fix(m.target);
      else if (m.type === 'attributes') walk.attr(m.target);
      else m.addedNodes.forEach(function (n) { walk(n); });
    }); } finally { busy = false; }
  });
  function start() { walk(document.body); if (document.title) document.title = dashes(document.title); mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.BEIcons = { svg: svg, clean: function (s) { return dashes(String(s)); } };
})();
