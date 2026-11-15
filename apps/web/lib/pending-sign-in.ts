/**
 * The login page finding a Google sign-in that finished where it couldn't
 * hear it (the installed app reopens on its start page after the browser tab).
 * It only looks after this device started one ("Entrar com Google", within
 * the challenge's 10 minutes), so a code step left by someone else on a shared
 * device isn't put on screen. A step turned down ("Voltar para o login")
 * stays down: in this tab's storage, and in memory when storage is blocked.
 */
const STARTED_KEY = "google-sign-in:started";
const DISMISSED_KEY = "two-factor:dismissed";
const WINDOW_MS = 10 * 60 * 1000;
let dismissedInMemory: string | null = null;

export function markGoogleSignInStarted() {
  try {
    localStorage.setItem(STARTED_KEY, String(Date.now()));
  } catch {
    // Without storage the page won't look by itself; ?etapa=codigo still works.
  }
}

export function googleSignInRecentlyStarted() {
  try {
    const at = Number(localStorage.getItem(STARTED_KEY));
    return Number.isFinite(at) && Date.now() - at < WINDOW_MS;
  } catch {
    return false;
  }
}

export function forgetGoogleSignIn() {
  try {
    localStorage.removeItem(STARTED_KEY);
  } catch {
    // Nothing kept.
  }
}

export function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) ?? dismissedInMemory;
  } catch {
    return dismissedInMemory;
  }
}

export function rememberDismissed(expiresAt: string) {
  dismissedInMemory = expiresAt;
  try {
    sessionStorage.setItem(DISMISSED_KEY, expiresAt);
  } catch {
    // Kept in memory for this page.
  }
}
