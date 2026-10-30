/* BlastExams round 12 (additive): load AFTER redesign.js. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* Profile menu: "Track: 100L" on one line, "Change" pushed right */
  var busy = false;
  function tidyTrackRow() {
    var menu = $('#user-dropdown-menu'); if (!menu || busy) return; busy = true;
    try {
      var all = menu.querySelectorAll('*'), row = null;
      for (var i = 0; i < all.length; i++) {
        /* document order lists a container before its children, so the first match is the whole row */
        if (/^\s*Track\s*:/i.test(all[i].textContent || '') && (all[i].textContent || '').length < 120) { row = all[i]; break; }
      }
      if (!row) return;
      row.classList.add('r-track-row');
      var w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null), n, re = /(?:UI\s*)?100[\s-]*(?:Level|L)(?:\s*Prep(?:aration)?)?/i;
      while ((n = w.nextNode())) {
        if (/^\s*Change\s*$/i.test(n.nodeValue)) {
          if (n.parentNode !== row) n.parentNode.classList.add('r-track-change');
          else { var sp = document.createElement('span'); sp.className = 'r-track-change'; sp.textContent = n.nodeValue.trim(); n.parentNode.replaceChild(sp, n); }
        }
        if (re.test(n.nodeValue) && n.nodeValue.replace(re, '100L') !== n.nodeValue) n.nodeValue = n.nodeValue.replace(re, '100L');
      }
    } finally { busy = false; }
  }

  /* Progress card button: drop the old inline white background so it follows the theme */
  function tidyGhost() {
    var b = document.querySelectorAll('#r-progress-body .cbt-launch-btn-primary');
    for (var i = 0; i < b.length; i++) { if (b[i].getAttribute('style')) b[i].removeAttribute('style'); b[i].classList.add('r-ghost'); }
  }

  function boot() {
    var menu = $('#user-dropdown-menu');
    if (menu) { tidyTrackRow(); if (window.MutationObserver) new MutationObserver(tidyTrackRow).observe(menu, { childList: true, subtree: true, characterData: true }); }
    var pb = $('#r-progress-body');
    if (pb) { tidyGhost(); if (window.MutationObserver) new MutationObserver(tidyGhost).observe(pb, { childList: true }); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', boot);
})();
