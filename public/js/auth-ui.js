/* Sign-in modal: Google, email + password, sign-up with emailed code, forgot password.
   Replaces the content of #signin-modal at runtime; the app's own open/close code is unchanged. */
(function () {
  var card, state = { view: "signin", email: "", note: "", error: "", busy: false, resendAt: 0 };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function api(path, body) {
    return fetch("/api/auth/email/" + path, { method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); })
      .catch(function () { return { success: false, message: "Network problem. Check your connection and try again." }; });
  }

  var GOOGLE = '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>';

  function field(id, label, type, extra) {
    return '<div class="be-field"><label class="be-label" for="' + id + '">' + label + '</label>' +
      '<input class="be-input ' + ((extra && extra.cls) || "") + '" id="' + id + '" type="' + type + '" ' +
      ((extra && extra.attrs) || "") + '></div>';
  }
  function passField(id, label, auto) {
    return '<div class="be-field"><label class="be-label" for="' + id + '">' + label + '</label><div class="be-pass">' +
      '<input class="be-input" id="' + id + '" type="password" autocomplete="' + auto + '" minlength="8" maxlength="128">' +
      '<button type="button" class="be-link" data-act="toggle" data-for="' + id + '">Show</button></div></div>';
  }
  function msg() {
    return (state.error ? '<div class="be-alert be-alert-error" role="alert">' + esc(state.error) + '</div>' : "") +
      (state.note ? '<div class="be-alert be-alert-ok" role="status">' + esc(state.note) + '</div>' : "");
  }
  function head(eyebrow, title) {
    return '<div class="be-head"><div><span class="be-eyebrow">' + eyebrow + '</span><h3 class="be-title">' + title +
      '</h3></div><button type="button" class="be-x" aria-label="Close" data-act="close">&times;</button></div>';
  }
  function submit(label) {
    return '<button class="be-btn be-btn-primary" type="submit"' + (state.busy ? " disabled" : "") + '>' + (state.busy ? "Please wait..." : label) + '</button>';
  }

  var views = {
    signin: function () {
      return head("Academic Access", "Sign in to continue") + msg() +
        '<p class="be-sub">Sign in to unlock verified course outlines, past questions and department guides.</p>' +
        '<a href="/api/auth/google/login" class="be-btn be-btn-outline" data-act="google">' + GOOGLE + 'Continue with Google</a>' +
        '<div class="be-divider">or use your email</div>' +
        '<form data-form="signin" novalidate>' + field("be-email", "Email", "email", { attrs: 'autocomplete="email" value="' + esc(state.email) + '"' }) +
        passField("be-pass", "Password", "current-password") +
        '<div style="text-align:right;margin:-.3rem 0 .9rem"><button type="button" class="be-link" data-act="go" data-view="forgot">Forgot password?</button></div>' +
        submit("Sign in") + '</form>' +
        '<p class="be-foot">New here? <button type="button" class="be-link" data-act="go" data-view="signup">Create an account</button></p>';
    },
    signup: function () {
      return head("Join BlastExams", "Create your account") + msg() +
        '<form data-form="signup" novalidate>' + field("be-name", "Full name", "text", { attrs: 'autocomplete="name" maxlength="80"' }) +
        field("be-email", "Email", "email", { attrs: 'autocomplete="email" value="' + esc(state.email) + '"' }) +
        passField("be-pass", "Password (at least 8 characters)", "new-password") + submit("Create account") + '</form>' +
        '<div class="be-divider">or</div><a href="/api/auth/google/login" class="be-btn be-btn-outline" data-act="google">' + GOOGLE + 'Continue with Google</a>' +
        '<p class="be-foot">Already have an account? <button type="button" class="be-link" data-act="go" data-view="signin">Sign in</button></p>';
    },
    verify: function () {
      return head("Almost there", "Confirm your email") + msg() +
        '<p class="be-sub">We sent a 6-digit code to <b>' + esc(state.email) + '</b>. It expires in 15 minutes.</p>' +
        '<form data-form="verify" novalidate>' + field("be-code", "Verification code", "text", { cls: "be-code", attrs: 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"' }) +
        submit("Verify and continue") + '</form>' +
        '<p class="be-foot">No code? <button type="button" class="be-link" data-act="resend">Send a new one</button></p>';
    },
    forgot: function () {
      return head("Password help", "Forgot your password?") + msg() +
        '<p class="be-sub">Enter your email and we will send you a 6-digit code to reset it.</p>' +
        '<form data-form="forgot" novalidate>' + field("be-email", "Email", "email", { attrs: 'autocomplete="email" value="' + esc(state.email) + '"' }) +
        submit("Send reset code") + '</form>' +
        '<p class="be-foot"><button type="button" class="be-link" data-act="go" data-view="signin">Back to sign in</button></p>';
    },
    reset: function () {
      return head("Password help", "Set a new password") + msg() +
        '<p class="be-sub">Enter the code sent to <b>' + esc(state.email) + '</b> and choose a new password.</p>' +
        '<form data-form="reset" novalidate>' + field("be-code", "Reset code", "text", { cls: "be-code", attrs: 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"' }) +
        passField("be-pass", "New password (at least 8 characters)", "new-password") + submit("Change password") + '</form>' +
        '<p class="be-foot"><button type="button" class="be-link" data-act="go" data-view="forgot">Send a new code</button></p>';
    }
  };

  function render() {
    card.innerHTML = views[state.view]();
    var first = card.querySelector("input");
    if (first) first.focus();
  }
  function go(view, note, error) { state.view = view; state.note = note || ""; state.error = error || ""; state.busy = false; render(); }
  function val(id) { var el = card.querySelector("#" + id); return el ? el.value.trim() : ""; }
  function done() { var h = location.hash; location.reload(); if (h) location.hash = h; }

  var handlers = {
    signin: function () {
      state.email = val("be-email");
      return api("login", { email: state.email, password: card.querySelector("#be-pass").value }).then(function (r) {
        if (r.success) return done();
        if (r.error === "EMAIL_NOT_VERIFIED") return go("verify", r.message);
        go("signin", "", r.message || "Could not sign in.");
      });
    },
    signup: function () {
      state.email = val("be-email");
      return api("signup", { fullName: val("be-name"), email: state.email, password: card.querySelector("#be-pass").value }).then(function (r) {
        if (r.success) return go("verify", "We sent you a code. Check your inbox (and spam).");
        go("signup", "", r.message || "Could not create the account.");
      });
    },
    verify: function () {
      return api("verify-email", { email: state.email, code: val("be-code") }).then(function (r) {
        if (r.success) return done();
        go("verify", "", r.message || "That code did not work.");
      });
    },
    forgot: function () {
      state.email = val("be-email");
      return api("forgot-password", { email: state.email }).then(function (r) {
        go(r.success ? "reset" : "forgot", r.success ? r.message : "", r.success ? "" : r.message);
      });
    },
    reset: function () {
      return api("reset-password", { email: state.email, code: val("be-code"), newPassword: card.querySelector("#be-pass").value }).then(function (r) {
        if (r.success) return go("signin", r.message);
        go("reset", "", r.message || "Could not change the password.");
      });
    }
  };

  function onClick(e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.getAttribute("data-act");
    if (act === "google") { e.preventDefault(); if (window.handleGoogleBtnClick) window.handleGoogleBtnClick(e); else location.href = "/api/auth/google/login"; }
    else if (act === "go") go(t.getAttribute("data-view"));
    else if (act === "close") { if (window.closeSignInModal) window.closeSignInModal(); }
    else if (act === "toggle") { var i = card.querySelector("#" + t.getAttribute("data-for")); var show = i.type === "password"; i.type = show ? "text" : "password"; t.textContent = show ? "Hide" : "Show"; }
    else if (act === "resend") {
      if (Date.now() < state.resendAt) return go("verify", "", "Please wait a few seconds before asking for another code.");
      state.resendAt = Date.now() + 45000;
      api("resend-code", { email: state.email }).then(function (r) { go("verify", r.message || "If a code is needed, we sent one."); });
    }
  }
  function onSubmit(e) {
    var name = e.target.getAttribute("data-form"); if (!name) return;
    e.preventDefault(); if (state.busy) return;
    state.busy = true; state.error = ""; state.note = "";
    var btn = e.target.querySelector("button[type=submit]"); if (btn) { btn.disabled = true; btn.textContent = "Please wait..."; }
    handlers[name]();
  }

  function init() {
    var modal = document.getElementById("signin-modal"); if (!modal) return;
    card = modal.querySelector(".onboarding-card"); if (!card) return;
    card.style.textAlign = "center";
    card.addEventListener("click", onClick); card.addEventListener("submit", onSubmit);
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
