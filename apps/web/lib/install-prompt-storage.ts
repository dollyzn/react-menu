/**
 * Per-device memory for the install invitation: "not now" snoozes it, and the
 * customer menu waits for a returning visit. Storage can be unavailable
 * (private mode, blocked site data); then the invitation simply shows.
 */
export type InstallContext = "menu" | "staff";

const SNOOZE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;
const snoozeKey = (context: InstallContext) => `install-prompt:snoozed:${context}`;
const VISITS_KEY = "install-prompt:visits";
const SESSION_KEY = "install-prompt:counted";

export function isInstallSnoozed(context: InstallContext) {
  try {
    const until = Number(localStorage.getItem(snoozeKey(context)));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function snoozeInstall(context: InstallContext) {
  try {
    localStorage.setItem(snoozeKey(context), String(Date.now() + SNOOZE_DAYS * DAY));
  } catch {
    // Without storage the invitation just shows again next time.
  }
}

/** Counts this visit once per browser session and returns the total. */
export function countVisit() {
  try {
    const visits = Number(localStorage.getItem(VISITS_KEY)) || 0;
    if (sessionStorage.getItem(SESSION_KEY)) return visits;
    sessionStorage.setItem(SESSION_KEY, "1");
    localStorage.setItem(VISITS_KEY, String(visits + 1));
    return visits + 1;
  } catch {
    return 1;
  }
}
