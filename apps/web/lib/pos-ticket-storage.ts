import type { CartLine } from "@/redux/slices/cart";

/**
 * The POS ticket being built, kept on this device per store: a reload, or
 * going to another screen and back, doesn't lose the pastries already rung
 * up. Gone once the order is sent (or the ticket cleared), and ignored after
 * a few hours (yesterday's ticket isn't today's). Storage can be unavailable;
 * then the ticket simply isn't kept.
 */
export type SavedTicket = {
  lines: CartLine[];
  customerName: string;
  customerPhone: string;
  savedAt: number;
};

const key = (storeId: string) => `pos-ticket:${storeId}`;
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function readTicket(storeId: string): SavedTicket | null {
  try {
    const raw = localStorage.getItem(key(storeId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedTicket;
    if (!Array.isArray(saved.lines) || Date.now() - saved.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key(storeId));
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export function saveTicket(storeId: string, ticket: Omit<SavedTicket, "savedAt">) {
  try {
    if (ticket.lines.length === 0 && !ticket.customerName && !ticket.customerPhone) {
      localStorage.removeItem(key(storeId));
    } else {
      localStorage.setItem(key(storeId), JSON.stringify({ ...ticket, savedAt: Date.now() }));
    }
  } catch {
    // Without storage the ticket lives only on this screen.
  }
}

/** Signing out: a ticket (with a customer's name and phone) doesn't outlive the session on the device. */
export function clearSavedTickets() {
  try {
    for (const name of Object.keys(localStorage)) {
      if (name.startsWith("pos-ticket:")) localStorage.removeItem(name);
    }
  } catch {
    // Nothing kept, nothing to clear.
  }
}
