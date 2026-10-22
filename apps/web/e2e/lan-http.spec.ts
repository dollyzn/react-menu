import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login } from "./fixtures";
import { API_URL } from "../playwright.config";

/**
 * Opening the app by the machine's IP over http (testing on a phone in the
 * LAN) is not a secure context: crypto.randomUUID and navigator.clipboard
 * don't exist there. The suite runs on localhost (secure), so remove them.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", { get: () => false });
    Object.defineProperty(Crypto.prototype, "randomUUID", { value: undefined });
    Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined });
  });
});

test("the panel works without secure-context APIs (realtime, writes)", async ({ page }) => {
  await login(page);
  // The notifications popover starts the realtime (Transmit) client.
  await expect(page.getByRole("button", { name: /Notificações/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Notificações/ })).toBeVisible();
});

test("the Pix code can be copied without navigator.clipboard", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      lines: [{ itemId: menu.categories[0].items[0].id, quantity: 1 }],
      customer: { name: "Rede Local", phone: "11977776666" },
      paymentMethod: "pix",
    },
  });
  const token = (await placed.json()).data.publicToken as string;
  await api.dispose();

  await page.goto(`/pedido/${token}`, { timeout: 30_000 });
  const payment = page.getByRole("region", { name: "Pagamento" });
  await payment.getByLabel("Seu e-mail").fill("rede@example.com");
  await payment.getByRole("button", { name: "Gerar Pix" }).click();
  await payment.getByRole("button", { name: "Copiar" }).click();
  await expect(page.getByText("Código Pix copiado! Cole no app do banco.")).toBeVisible();
});
