"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderStatus } from "@react-menu/contracts";
import { useHydrated } from "@/hooks/use-hydrated";
import { currentFid, enableWebPush, listenForFid, webPushAvailable } from "@/lib/web-push";
import { useSubscribeOrderReadyMutation, useUnsubscribeOrderReadyMutation } from "@/redux/features/public/publicApi";

/**
 * push: told by the server even with the phone locked; page: only while this
 * page is open; off: the customer said "não avisar" on this order.
 */
export type ReadyAlertMode = "push" | "page" | "off";

const storageKey = (token: string) => `ready-alert:${token}`;
/** "Avisar sempre" on this device: later orders subscribe by themselves. */
const ALWAYS_KEY = "ready-alert:always";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: for this visit only.
  }
}

function savedMode(token: string): ReadyAlertMode | null {
  const value = read(storageKey(token));
  return value === "push" || value === "page" || value === "off" ? value : null;
}

/** Orders still to be made: worth being told about. */
const WAITING = new Set<OrderStatus>(["pending_payment", "received", "preparing"]);

/**
 * "Avisar quando ficar pronto". The tap asks for notifications and, where
 * web push works (Android, an installed app on iPhone), subscribes this
 * browser to the order: the server tells it when the order is ready, even
 * with the phone locked. Either way, while the page is open it vibrates,
 * chimes (the tap unlocked audio) and flashes the tab title.
 *
 * Remembered on this device, not per customer (customers have no account
 * and their phone number isn't verified): once push is on, the next orders
 * placed here subscribe by themselves, with no prompt (permission given).
 * "Não avisar" turns it off for this order and the next ones.
 */
export function useReadyAlert(status: OrderStatus | undefined, orderNumber: number | undefined, token: string) {
  const hydrated = useHydrated();
  const [chosen, setChosen] = useState<ReadyAlertMode | null>(null);
  const [arming, setArming] = useState(false);
  const [subscribe] = useSubscribeOrderReadyMutation();
  const [unsubscribe] = useUnsubscribeOrderReadyMutation();
  const audio = useRef<AudioContext | null>(null);
  const previous = useRef<OrderStatus | undefined>(undefined);
  // Read after hydration: the server render has no storage.
  const mode = chosen ?? (hydrated ? savedMode(token) : null);
  const waiting = status !== undefined && WAITING.has(status);

  // A new order on a device that asked to always be told: subscribe it now.
  const autoTried = useRef(false);
  useEffect(() => {
    if (!hydrated || !waiting || mode !== null || autoTried.current) return;
    if (read(ALWAYS_KEY) !== "1" || !("Notification" in window) || Notification.permission !== "granted") return;
    autoTried.current = true;
    void (async () => {
      try {
        if (!(await webPushAvailable())) return;
        const fid = await enableWebPush();
        await subscribe({ token, fid }).unwrap();
        write(storageKey(token), "push");
        setChosen("push");
      } catch (error) {
        // Left to the button: the customer can still turn it on.
        console.info("ready alert: could not subscribe by itself", error);
      }
    })();
  }, [hydrated, mode, subscribe, token, waiting]);

  // While push is on: a new installation ID (refresh, restore) keeps this order subscribed.
  useEffect(() => {
    if (mode !== "push") return;
    return listenForFid((fid) => void subscribe({ token, fid }));
  }, [mode, subscribe, token]);

  // Sound needs a gesture in this page's life: after a reload (or when it was
  // turned on by itself), the first touch anywhere unlocks it.
  useEffect(() => {
    if ((mode !== "push" && mode !== "page") || audio.current) return;
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [mode]);

  const arm = async () => {
    // Asked right in the tap, before any await: Safari (iPhone) only shows the
    // prompt during the gesture.
    const asking =
      "Notification" in window && Notification.permission === "default"
        ? Notification.requestPermission().catch(() => "denied" as const)
        : null;
    audio.current ??= new AudioContext();
    setArming(true);
    let next: ReadyAlertMode = "page";
    try {
      await asking;
      if (await webPushAvailable()) {
        const fid = await enableWebPush();
        await subscribe({ token, fid }).unwrap();
        next = "push";
      }
    } catch (error) {
      // Refused or unavailable: this page still alerts while it is open (an
      // expected outcome, so not a warning).
      console.info("ready alert: push unavailable, alerting on this page", error);
    } finally {
      setArming(false);
    }
    write(storageKey(token), next);
    // Push works here: the next orders on this device subscribe by themselves.
    if (next === "push") write(ALWAYS_KEY, "1");
    setChosen(next);
  };

  /** "Não avisar": off for this order and for the next ones on this device. */
  const disarm = async () => {
    write(ALWAYS_KEY, null);
    write(storageKey(token), "off");
    setChosen("off");
    if (mode === "push") {
      try {
        await unsubscribe({ token, fid: await currentFid() }).unwrap();
      } catch {
        // The subscription goes anyway once the order is over.
      }
    }
  };

  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (!was || was === "ready" || status !== "ready") return;

    navigator.vibrate?.([250, 120, 250, 120, 400]);
    if (!mode || mode === "off") return;

    chime(audio.current);
    const title = `🔔 Pedido #${orderNumber} pronto!`;
    // With push the server's notification comes (same tag: never two).
    if (mode === "page" && document.hidden && "Notification" in window && Notification.permission === "granted") {
      void navigator.serviceWorker?.ready
        .then((registration) =>
          registration.showNotification(title, {
            body: "Pode vir buscar no balcão.",
            icon: "/icons/icon-192.png",
            tag: `order-ready-${token}`,
          })
        )
        .catch(() => new Notification(title, { body: "Pode vir buscar no balcão." }));
    }
    return flashTitle(title);
  }, [mode, orderNumber, status, token]);

  const supported = hydrated && "AudioContext" in window;
  return { mode, armed: mode === "push" || mode === "page", arming, arm, disarm, supported };
}

/** Three short rising tones. */
function chime(context: AudioContext | null) {
  if (!context) return;
  void context.resume();
  [660, 880, 1100].forEach((frequency, index) => {
    const start = context.currentTime + index * 0.18;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.25);
  });
}

/** Alternates the tab title until the customer looks at the page. */
function flashTitle(message: string) {
  const original = document.title;
  let on = false;
  const timer = setInterval(() => {
    on = !on;
    document.title = on ? message : original;
  }, 1000);
  const stop = () => {
    if (document.hidden) return;
    clearInterval(timer);
    document.title = original;
    document.removeEventListener("visibilitychange", stop);
  };
  document.addEventListener("visibilitychange", stop);
  if (!document.hidden) setTimeout(stop, 6000);
  return () => {
    clearInterval(timer);
    document.title = original;
    document.removeEventListener("visibilitychange", stop);
  };
}
