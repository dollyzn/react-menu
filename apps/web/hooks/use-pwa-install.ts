import { useSyncExternalStore } from "react";

/** Chromium's install prompt (not in the DOM typings). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    /** Captured by the inline script in the root layout, before hydration. */
    __installPrompt?: BeforeInstallPromptEvent | null;
  }
  interface Navigator {
    /** iOS Safari home screen apps. */
    standalone?: boolean;
  }
}

export type InstallState = {
  /** The browser can show its native install dialog now. */
  canPrompt: boolean;
  /** iOS: no prompt API, the user adds it from the Share menu. */
  needsManualSteps: boolean;
  /** Running as an installed app, or installed during this visit. */
  installed: boolean;
};

const SERVER_STATE: InstallState = { canPrompt: false, needsManualSteps: false, installed: false };

let state = SERVER_STATE;
let installedNow = false;
const listeners = new Set<() => void>();

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

/** iPhone/iPad browsers that can "Add to Home Screen" (in-app webviews can't). */
function isIosBrowser() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && !/FBAN|FBAV|Instagram|Line\/|Twitter|TikTok/.test(ua);
}

function compute(): InstallState {
  const installed = installedNow || isStandalone();
  const next: InstallState = {
    installed,
    canPrompt: !installed && Boolean(window.__installPrompt),
    needsManualSteps: !installed && !window.__installPrompt && isIosBrowser(),
  };
  const same =
    next.installed === state.installed &&
    next.canPrompt === state.canPrompt &&
    next.needsManualSteps === state.needsManualSteps;
  return same ? state : next;
}

function emit() {
  state = compute();
  listeners.forEach((listener) => listener());
}

function onPrompt(event: Event) {
  event.preventDefault();
  window.__installPrompt = event as BeforeInstallPromptEvent;
  emit();
}

function onInstalled() {
  installedNow = true;
  window.__installPrompt = null;
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
  }
  listeners.add(listener);
  state = compute();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    }
  };
}

/** Shows the native install dialog; resolves with the user's choice. */
async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = window.__installPrompt;
  if (!event) return "unavailable";
  // A prompt event can be used only once.
  window.__installPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  emit();
  return outcome;
}

/**
 * Install state of the PWA. Everything is false on the server and during
 * hydration, so it never changes the first render.
 */
export function usePwaInstall() {
  const current = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  return {
    ...current,
    /** Something to offer: a native prompt or the iOS steps. */
    available: current.canPrompt || current.needsManualSteps,
    promptInstall,
  };
}
