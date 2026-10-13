/* Hunt auth adapter. Demo mode: a localStorage mock shaped like supabase-js v2 auth.
   To go live, replace createMockClient() with supabase.createClient(url, anonKey).auth
   and keep the same method names. Session key matches supabase-js: sb-auth-token. */
(function (root) {
  "use strict";
  var SESSION_KEY = "sb-auth-token";
  var PENDING_KEY = "hunt-auth-pending";
  var listeners = [];

  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function drop(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function uid() { return "demo-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim()); }
  function emit(event, session) { listeners.slice().forEach(function (fn) { try { fn(event, session); } catch (e) {} }); }

  function makeSession(user) {
    var now = Math.floor(Date.now() / 1000);
    return { access_token: "demo." + uid(), token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: uid(), user: user };
  }
  function makeUser(email, provider, meta) {
    return { id: uid(), aud: "authenticated", role: "authenticated", email: email,
      app_metadata: { provider: provider, providers: [provider] },
      user_metadata: meta || {}, created_at: new Date().toISOString() };
  }

  var auth = {
    mode: "demo",
    getSession: function () { return Promise.resolve({ data: { session: read(SESSION_KEY) }, error: null }); },
    getUser: function () { var s = read(SESSION_KEY); return Promise.resolve({ data: { user: s ? s.user : null }, error: null }); },
    signInWithOtp: function (opts) {
      var email = opts && String(opts.email || "").trim().toLowerCase();
      if (!validEmail(email)) return Promise.resolve({ data: null, error: { message: "Enter a valid email address." } });
      write(PENDING_KEY, { email: email, sent_at: Date.now(), meta: (opts.options && opts.options.data) || {} });
      return Promise.resolve({ data: { user: null, session: null }, error: null });
    },
    /* Demo only: stands in for the user tapping the emailed link. */
    verifyOtp: function () {
      var p = read(PENDING_KEY);
      if (!p) return Promise.resolve({ data: null, error: { message: "No sign-in link is waiting. Start again." } });
      if (Date.now() - p.sent_at > 15 * 60 * 1000) { drop(PENDING_KEY); return Promise.resolve({ data: null, error: { message: "That link expired. Send a new one." } }); }
      var s = makeSession(makeUser(p.email, "email", p.meta));
      write(SESSION_KEY, s); drop(PENDING_KEY); emit("SIGNED_IN", s);
      return Promise.resolve({ data: { session: s, user: s.user }, error: null });
    },
    signInWithOAuth: function (opts) {
      var provider = (opts && opts.provider) || "google";
      if (provider === "apple") return Promise.resolve({ data: null, error: { message: "Sign in with Apple is coming soon." } });
      var meta = (opts.options && opts.options.data) || {};
      meta.full_name = meta.full_name || "Demo Google user";
      var s = makeSession(makeUser("demo.user@gmail.com", provider, meta));
      write(SESSION_KEY, s); emit("SIGNED_IN", s);
      return Promise.resolve({ data: { provider: provider, url: null }, error: null });
    },
    signOut: function () { drop(SESSION_KEY); emit("SIGNED_OUT", null); return Promise.resolve({ error: null }); },
    onAuthStateChange: function (fn) {
      listeners.push(fn);
      return { data: { subscription: { unsubscribe: function () { listeners = listeners.filter(function (f) { return f !== fn; }); } } } };
    },
    pendingEmail: function () { var p = read(PENDING_KEY); return p ? p.email : ""; },
    /* Demo stand-in for the delete-account Edge Function. */
    deleteAccount: function () { drop(SESSION_KEY); drop(PENDING_KEY); drop("hunt-profile"); drop("hunt-migrated-uid"); emit("SIGNED_OUT", null); return Promise.resolve({ error: null }); },
  };

  root.HuntAuth = { auth: auth, SESSION_KEY: SESSION_KEY, validEmail: validEmail };
})(typeof window !== "undefined" ? window : globalThis);
