/**
 * "Agora não" on the invitation to set up the authenticator app: it rests for
 * a week on this device. Storage can be unavailable; then it simply shows.
 */
const KEY = "two-factor-prompt:snoozed";
const SNOOZE_DAYS = 7;

export function isTwoFactorPromptSnoozed() {
  try {
    const until = Number(localStorage.getItem(KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function snoozeTwoFactorPrompt() {
  try {
    localStorage.setItem(KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // Without storage it just shows again next time.
  }
}
