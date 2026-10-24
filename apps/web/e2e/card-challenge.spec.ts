import { request as playwrightRequest } from "@playwright/test";
import type { PublicOrder } from "@react-menu/contracts";
import { test, expect } from "./fixtures";
import { API_URL } from "../playwright.config";

const BANK = "https://bank.example/3ds/challenge";

/**
 * 3-D Secure (ADR 0017): Mercado Pago can't be reached from the tests, so
 * the API's answers are played back: a card attempt waiting for the bank's
 * challenge, the bank's page (which posts COMPLETE like the real one), and
 * the sync that finds it approved.
 */
test("a card the bank wants to confirm: the challenge, then the paid order", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      lines: [{ itemId: menu.categories[0].items[0].id, quantity: 1 }],
      customer: { name: "Desafio", phone: "11955554444" },
      paymentMethod: "counter",
    },
  });
  const real = (await placed.json()).data as PublicOrder;
  await api.dispose();

  const payment = { method: "card" as const, amount: real.total, pix: null, simulated: false };
  const waiting: PublicOrder = {
    ...real,
    status: "pending_payment",
    paymentMethod: "card",
    paymentStatus: "pending",
    checkout: { methods: ["card"], mercadoPagoPublicKey: "TEST-0b7c6a2e-3d4f-4a1b-9c8d-123456789abc", maxInstallments: 1 },
    payment: {
      ...payment,
      status: "pending",
      statusDetail: "pending_challenge",
      challenge: { url: BANK, expiresAt: new Date(Date.now() + 40 * 60_000).toISOString() },
    },
  };
  const paid: PublicOrder = {
    ...real,
    status: "received",
    paymentMethod: "card",
    paymentStatus: "paid",
    checkout: null,
    payment: { ...payment, status: "approved", statusDetail: "accredited", challenge: null },
  };

  let synced = 0;
  let current = waiting;
  const json = (data: PublicOrder) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data }),
  });
  await page.route(`${API_URL}/api/v1/public/orders/${real.publicToken}`, (route) =>
    route.request().method() === "GET" ? route.fulfill(json(current)) : route.fallback()
  );
  await page.route(`${API_URL}/api/v1/public/orders/${real.publicToken}/payments/sync`, (route) => {
    synced++;
    current = paid;
    return route.fulfill(json(paid));
  });
  // The bank's page: a code to confirm, then the message the real challenge sends.
  await page.context().route(BANK, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body style="font-family:sans-serif">
        <h1>Banco Exemplo</h1><p>Digite o código enviado por SMS.</p>
        <button onclick="parent.postMessage({ status: 'COMPLETE' }, '*')">Confirmar</button>
      </body></html>`,
    })
  );

  await page.goto(`/pedido/${real.publicToken}`, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Confirme a compra com o seu banco" })).toBeVisible();
  const bank = page.frameLocator('iframe[title="Confirmação do banco"]');
  await expect(bank.getByRole("heading", { name: "Banco Exemplo" })).toBeVisible();

  // A message from anywhere but the bank's frame is ignored.
  await page.evaluate(() => window.postMessage({ status: "COMPLETE" }, "*"));
  await page.waitForTimeout(300);
  expect(synced).toBe(0);

  await bank.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("heading", { name: "Confirme a compra com o seu banco" })).toBeHidden();
  expect(synced).toBe(1);
  await expect(page.getByText(/recebido/i).first()).toBeVisible();
});
