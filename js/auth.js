/* auth.js
 * Live path: hardcoded user/123.
 * Dormant seams: Supabase email + Google OAuth (scaffolded, not wired).
 */
window.Auth = (function () {
  const SESSION_KEY = "ms_session";
  const HARDCODED = { user: "user", pass: "123" };

  function signIn(user, pass) {
    if (user === HARDCODED.user && pass === HARDCODED.pass) {
      const session = { user, at: Date.now(), via: "hardcoded" };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
      return { ok: true, session };
    }
    return { ok: false, error: "invalid" };
  }

  function current() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
    catch (e) { return null; }
  }

  function signOut() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  /* ---- DORMANT SEAMS (coming later) ---- */
  const supabase = {
    // configure({url, anonKey}) -> creates client when enabled
    signInWithEmail: async () => { throw new Error("Supabase email: coming later"); },
    signInWithGoogle: async () => { throw new Error("Google OAuth: coming later"); },
    enabled: false,
  };

  return { signIn, current, signOut, supabase };
})();
