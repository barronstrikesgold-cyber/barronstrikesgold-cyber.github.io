/* Hunt accounts UI (demo mode). Routes: #/signup #/login #/check-email #/account.
   All auth calls go through window.HuntAuth (lib/auth.js). */
(function (root) {
  "use strict";
  var MIGRATE_KEYS = ["hunt-tracked", "hunt-alerts", "hunt-settings", "hunt-stores", "hunt-theme", "reseller-inventory-v2"];
  var ui = { ageOk: false, under13: false, error: "", deleting: false, deleteDone: "", busy: false };
  var hooks = { rerender: function () {}, exportData: null, wipeDevice: null };

  function A() { return root.HuntAuth.auth; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function readRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function session() { try { return JSON.parse(readRaw(root.HuntAuth.SESSION_KEY)); } catch (e) { return null; } }
  function go(hash) { if (location.hash !== hash) location.hash = hash; else hooks.rerender(); }

  function countFor(key) {
    var raw = readRaw(key);
    if (raw == null) return 0;
    try {
      var v = JSON.parse(raw);
      if (Array.isArray(v)) return v.length;
      if (v && Array.isArray(v.items)) return v.items.length;
      if (v && typeof v === "object") return Object.keys(v).length ? 1 : 0;
      return 1;
    } catch (e) { return raw ? 1 : 0; }
  }
  function migrationCounts() {
    var out = {};
    MIGRATE_KEYS.forEach(function (k) { out[k] = countFor(k); });
    return out;
  }
  var LABELS = { "hunt-tracked": "Tracked items", "hunt-alerts": "Alerts", "hunt-settings": "Settings", "hunt-stores": "Saved stores", "hunt-theme": "Theme", "reseller-inventory-v2": "Inventory items" };

  var badge = '<p class="demo-badge" role="note"><span aria-hidden="true">●</span> Demo mode · nothing leaves this device</p>';
  var legal = '<p class="fine acct-legal">By continuing you agree to the <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a> of Broken Beaker Labs LC. US only.</p>';
  function err() { return ui.error ? '<p class="acct-error" role="alert">' + esc(ui.error) + "</p>" : ""; }

  function methods(intent) {
    return '<div class="acct-methods">' +
      '<button type="button" class="acct-btn acct-google" data-acct="google">' +
      '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11h8" stroke="currentColor" stroke-width="2"/></svg> Continue with Google</button>' +
      '<button type="button" class="acct-btn acct-apple" disabled aria-disabled="true">Continue with Apple <span class="acct-soon">Coming soon</span></button>' +
      '<div class="acct-or" role="separator"><span>or use email</span></div>' +
      '<form id="acct-email-form" class="acct-email" novalidate>' +
      '<label class="field" for="acct-email"><span>Email</span><input id="acct-email" type="email" autocomplete="email" inputmode="email" required placeholder="you@example.com" aria-describedby="acct-email-help"></label>' +
      '<p id="acct-email-help" class="fine">We email you a sign-in link. No password to remember.</p>' +
      '<button type="submit" class="btn-primary">' + (intent === "signup" ? "Email me a sign-up link" : "Email me a sign-in link") + "</button></form></div>";
  }

  function renderSignup() {
    var body;
    if (ui.under13) {
      body = '<section class="tool acct-card"><h2>Hunt is for people 13 and older</h2><p>You can keep using Hunt as a guest. Nothing is sent to a server.</p><a class="btn-secondary acct-link-btn" href="#/home">Keep browsing as a guest</a></section>';
    } else if (!ui.ageOk) {
      body = '<section class="tool acct-card"><h2>First, how old are you?</h2><p>Accounts are for people in the US who are 13 or older.</p>' +
        '<div class="acct-stack"><button type="button" class="btn-primary" data-acct="age-yes">I am 13 or older</button>' +
        '<button type="button" class="btn-secondary" data-acct="age-no">I am under 13</button></div></section>';
    } else {
      body = '<section class="tool acct-card"><h2>Create your account</h2><p>Sync your watchlist, alerts and inventory across devices.</p>' + err() + methods("signup") + "</section>";
    }
    return '<div class="acct">' + badge + "<h1>Sign up</h1>" + body + '<p class="acct-switch">Already have an account? <a href="#/login">Log in</a></p>' + legal + "</div>";
  }

  function renderLogin() {
    return '<div class="acct">' + badge + "<h1>Log in</h1>" +
      '<section class="tool acct-card"><h2>Welcome back</h2>' + err() + methods("login") + "</section>" +
      '<p class="acct-switch">New to Hunt? <a href="#/signup">Create an account</a></p>' + legal + "</div>";
  }

  function renderCheckEmail() {
    var email = A().pendingEmail();
    if (!email) {
      return '<div class="acct">' + badge + '<h1>Check your email</h1><section class="tool acct-card"><p>No sign-in link is waiting.</p><a class="btn-primary acct-link-btn" href="#/login">Start again</a></section></div>';
    }
    return '<div class="acct">' + badge + "<h1>Check your email</h1>" +
      '<section class="tool acct-card"><p>We sent a sign-in link to <strong>' + esc(email) + "</strong>. It works for 15 minutes.</p>" + err() +
      '<div class="acct-stack"><button type="button" class="btn-primary" data-acct="open-link">Open the link (demo)</button>' +
      '<button type="button" class="btn-secondary" data-acct="resend">Send it again</button>' +
      '<a class="ghost acct-link-btn" href="#/login">Use a different email</a></div>' +
      '<p class="fine">In demo mode no email is sent. The first button stands in for tapping the link.</p></section></div>';
  }

  function migrationCard(s) {
    if (readRaw("hunt-migrated-uid") === s.user.id || readRaw("hunt-migrate-later") === s.user.id) return "";
    var c = migrationCounts();
    var total = MIGRATE_KEYS.reduce(function (n, k) { return n + c[k]; }, 0);
    if (!total) return "";
    return '<section class="tool acct-card acct-migrate" aria-labelledby="mig-h"><h2 id="mig-h">Bring your data?</h2>' +
      "<p>This device has Hunt data from before you signed in. Bring it into your account?</p>" +
      '<ul class="acct-counts">' + MIGRATE_KEYS.map(function (k) {
        return '<li><span>' + LABELS[k] + '</span><strong data-count="' + k + '">' + c[k] + "</strong></li>";
      }).join("") + "</ul>" +
      '<p class="fine">Coupons and owner settings stay on this device only.</p>' +
      '<div class="acct-stack"><button type="button" class="btn-primary" data-acct="migrate">Bring it</button>' +
      '<button type="button" class="btn-secondary" data-acct="migrate-later">Not now</button></div></section>';
  }

  function deletePanel() {
    if (!ui.deleting) return '<button type="button" class="danger full" data-acct="delete-open">Delete my data and account</button>';
    return '<section class="tool acct-card acct-danger" role="region" aria-labelledby="del-h"><h2 id="del-h">Delete account</h2>' +
      "<p>This deletes your Hunt account, your synced watchlist, alerts, inventory and settings, and turns off email alerts. It cannot be undone.</p>" +
      '<button type="button" class="btn-secondary" data-acct="export">Export my data first</button>' +
      '<fieldset class="acct-fieldset"><legend>Data on this device</legend>' +
      '<label class="acct-radio"><input type="radio" name="acct-keep" value="keep" checked> Keep a copy on this device</label>' +
      '<label class="acct-radio"><input type="radio" name="acct-keep" value="remove"> Remove it from this device too</label></fieldset>' +
      '<label class="field" for="acct-del-confirm"><span>Type DELETE to confirm</span><input id="acct-del-confirm" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' +
      '<div class="acct-stack"><button type="button" class="danger full" id="acct-del-go" data-acct="delete-confirm" disabled>Delete my account</button>' +
      '<button type="button" class="ghost full" data-acct="delete-cancel">Cancel</button></div>' +
      '<p class="fine">You can also <a href="delete-account.html">request deletion on the web</a>.</p></section>';
  }

  function renderAccount() {
    var s = session();
    if (!s) {
      return '<div class="acct">' + badge + "<h1>Account</h1>" +
        (ui.deleteDone ? '<p class="acct-ok" role="status">' + esc(ui.deleteDone) + "</p>" : "") +
        '<section class="tool acct-card"><h2>You are using Hunt as a guest</h2><p>Your data stays on this device. Sign in to sync it.</p>' +
        '<div class="acct-stack"><a class="btn-primary acct-link-btn" href="#/signup">Create an account</a><a class="btn-secondary acct-link-btn" href="#/login">Log in</a></div></section>' +
        '<section class="tool acct-card"><h2>Your data</h2><button type="button" class="btn-secondary" data-acct="export">Export my data</button></section>' +
        legal + "</div>";
    }
    var u = s.user;
    var name = (u.user_metadata && u.user_metadata.full_name) || u.email.split("@")[0];
    var provider = u.app_metadata.provider === "google" ? "Google" : "Email link";
    var synced = readRaw("hunt-migrated-uid") === u.id;
    return '<div class="acct">' + badge + "<h1>Account</h1>" +
      '<section class="tool acct-card acct-profile"><div class="acct-avatar" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + "</div>" +
      '<div><h2>' + esc(name) + '</h2><p class="fine">' + esc(u.email) + " · " + provider + "</p>" +
      '<p class="fine">Member since ' + esc(new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })) + "</p>" +
      '<p class="acct-sync">' + (synced ? "Synced (demo)" : "This device only") + "</p></div></section>" +
      migrationCard(s) +
      '<section class="tool acct-card"><h2>Your data</h2><p>Download everything Hunt keeps for you as a JSON file.</p>' +
      '<button type="button" class="btn-secondary" data-acct="export">Export my data</button></section>' +
      deletePanel() +
      '<button type="button" class="ghost full" data-acct="signout">Sign out</button>' +
      '<p class="fine acct-legal"><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="delete-account.html">Delete account</a></p>' +
      '<p class="legal">Broken Beaker Labs LC</p></div>';
  }

  function render(route) {
    if (route === "signup") return renderSignup();
    if (route === "login") return renderLogin();
    if (route === "check-email") return renderCheckEmail();
    return renderAccount();
  }

  function titleFor(route) {
    return { signup: "Sign up", login: "Log in", "check-email": "Check your email", account: "Account" }[route] || "Account";
  }

  function entryCard() {
    var s = session();
    return '<a class="tool acct-entry" href="#/account"><span><span class="kicker">Account</span><br>' +
      (s ? esc(s.user.email) : "Sign in to sync") + '</span><span aria-hidden="true">›</span></a>';
  }

  function afterSignIn() { ui.error = ""; ui.ageOk = false; go("#/account"); }

  function onClick(e) {
    var btn = e.target.closest("[data-acct]");
    if (!btn || btn.disabled) return;
    var a = btn.getAttribute("data-acct");
    ui.error = "";
    if (a === "age-yes") { ui.ageOk = true; hooks.rerender(); return; }
    if (a === "age-no") { ui.under13 = true; hooks.rerender(); return; }
    if (a === "google") {
      A().signInWithOAuth({ provider: "google", options: { data: { age_confirmed_at: new Date().toISOString(), email_opt_in: false } } }).then(function (r) {
        if (r.error) { ui.error = r.error.message; hooks.rerender(); return; }
        afterSignIn();
      });
      return;
    }
    if (a === "open-link") {
      A().verifyOtp({ type: "magiclink" }).then(function (r) { if (r.error) { ui.error = r.error.message; hooks.rerender(); return; } afterSignIn(); });
      return;
    }
    if (a === "resend") {
      A().signInWithOtp({ email: A().pendingEmail() }).then(function () { ui.error = ""; hooks.rerender(); var el = document.querySelector(".acct-card p"); if (el) el.setAttribute("data-resent", "1"); });
      return;
    }
    if (a === "migrate") { var s = session(); if (s) localStorage.setItem("hunt-migrated-uid", s.user.id); hooks.rerender(); return; }
    if (a === "migrate-later") { var s2 = session(); if (s2) localStorage.setItem("hunt-migrate-later", s2.user.id); hooks.rerender(); return; }
    if (a === "export") { if (hooks.exportData) hooks.exportData(); return; }
    if (a === "delete-open") { ui.deleting = true; hooks.rerender(); var f = document.getElementById("del-h"); if (f) { f.setAttribute("tabindex", "-1"); f.focus(); } return; }
    if (a === "delete-cancel") { ui.deleting = false; hooks.rerender(); return; }
    if (a === "delete-confirm") {
      var input = document.getElementById("acct-del-confirm");
      if (!input || input.value.trim() !== "DELETE") return;
      var keepEl = document.querySelector('input[name="acct-keep"]:checked');
      var keep = !keepEl || keepEl.value === "keep";
      A().deleteAccount().then(function () {
        try { localStorage.removeItem("hunt-migrate-later"); } catch (e2) {}
        if (!keep && hooks.wipeDevice) hooks.wipeDevice();
        ui.deleting = false;
        ui.deleteDone = keep ? "Your account was deleted. Your data is still on this device." : "Your account and the data on this device were deleted.";
        hooks.rerender();
      });
      return;
    }
    if (a === "signout") { A().signOut().then(function () { ui.deleteDone = ""; go("#/login"); }); return; }
  }

  function onInput(e) {
    if (e.target && e.target.id === "acct-del-confirm") {
      var go2 = document.getElementById("acct-del-go");
      if (go2) go2.disabled = e.target.value.trim() !== "DELETE";
    }
  }

  function onSubmit(e) {
    if (!e.target || e.target.id !== "acct-email-form") return;
    e.preventDefault();
    var email = document.getElementById("acct-email").value;
    A().signInWithOtp({ email: email, options: { data: { age_confirmed_at: new Date().toISOString(), email_opt_in: false } } }).then(function (r) {
      if (r.error) {
        ui.error = r.error.message; hooks.rerender();
        var el = document.getElementById("acct-email"); if (el) { el.value = email; el.setAttribute("aria-invalid", "true"); el.focus(); }
        return;
      }
      go("#/check-email");
    });
  }

  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("submit", onSubmit);

  root.HuntAccounts = {
    routes: ["signup", "login", "check-email", "account"],
    render: render, titleFor: titleFor, entryCard: entryCard, migrationCounts: migrationCounts, MIGRATE_KEYS: MIGRATE_KEYS,
    setHooks: function (h) { Object.keys(h).forEach(function (k) { hooks[k] = h[k]; }); },
    resetUi: function () { ui.error = ""; ui.under13 = false; },
  };
})(window);
