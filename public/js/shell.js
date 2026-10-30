/* App shell behaviour: header Sign in opens the new sign-in modal; admin menu shows only for admins. */
(function () {
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("#header-google-signin-btn");
    if (!btn || typeof window.openSignInModal !== "function") return;
    e.preventDefault(); e.stopImmediatePropagation();
    window.openSignInModal();
  }, true);

  fetch("/api/auth/me", { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var u = (j && (j.data || j.user)) || j || {};
      document.body.classList.toggle("is-admin", u.isAdmin === true);
    })
    .catch(function () { /* stay hidden */ });
})();
