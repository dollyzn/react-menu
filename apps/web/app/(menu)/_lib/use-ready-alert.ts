"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { OrderStatus } from "@react-menu/contracts";

/**
 * "Avisar quando ficar pronto": once the customer opts in (a tap, which also
 * unlocks audio), the page vibrates, chimes, flashes the tab title and, when
 * in the background, shows a system notification as the order turns ready.
 * Works while the page is open, the usual case while waiting at the beach.
 */
export function useReadyAlert(status: OrderStatus | undefined, orderNumber: number | undefined) {
  const [armed, setArmed] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const previous = useRef<OrderStatus | undefined>(undefined);

  const arm = async () => {
    audio.current ??= new AudioContext();
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => undefined);
    }
    setArmed(true);
    toast.success("Combinado! Vamos te avisar quando ficar pronto. Deixe esta página aberta.");
  };

  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (!was || was === "ready" || status !== "ready") return;

    navigator.vibrate?.([250, 120, 250, 120, 400]);
    if (!armed) return;

    chime(audio.current);
    const title = `🔔 Pedido #${orderNumber} pronto!`;
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      void navigator.serviceWorker?.ready
        .then((registration) =>
          registration.showNotification(title, {
            body: "Pode vir buscar no balcão.",
            icon: "/icons/icon-192.png",
            tag: `order-ready-${orderNumber}`,
          })
        )
        .catch(() => new Notification(title, { body: "Pode vir buscar no balcão." }));
    }
    return flashTitle(title);
  }, [armed, orderNumber, status]);

  const supported = typeof window !== "undefined" && "AudioContext" in window;
  return { armed, arm, supported };
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
