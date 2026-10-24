import type { Page } from "@playwright/test";
import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";
import { API_URL } from "../playwright.config";

/** A new store with three counter orders today: 3 meat + 1 cheese pastries, R$ 46,00. */
async function storeWithSales(page: Page) {
  const store = await createStoreViaApi(page, "Relatórios");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  const carne = await api.post(`/categories/${category.id}/items`, { name: "Pastel de carne", price: 12 });
  const queijo = await api.post(`/categories/${category.id}/items`, { name: "Pastel de queijo", price: 10 });
  const base = `${API_URL}/api/v1/stores/${store.id}`;
  await page.request.patch(`${base}/status`, { data: { status: "open" } });
  const { slug } = (await (await page.request.get(base)).json()).data;
  for (const lines of [
    [{ itemId: carne.id, quantity: 2 }],
    [{ itemId: carne.id, quantity: 1 }],
    [{ itemId: queijo.id, quantity: 1 }],
  ]) {
    const placed = await page.request.post(`${API_URL}/api/v1/public/menu/${slug}/orders`, {
      data: { lines, customer: { name: "Ana", phone: "11987654321" }, paymentMethod: "counter" },
    });
    expect(placed.ok()).toBeTruthy();
  }
  await page.context().clearCookies();
  await login(page);
  return store;
}

test("overview: today's sales, the live queue and the best sellers", async ({ page }) => {
  const store = await storeWithSales(page);
  await page.goto(`/app/stores/${store.id}/overview`, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Visão geral", level: 1 })).toBeVisible();
  await expect(page.getByText("R$ 46,00").first()).toBeVisible();
  await expect(page.getByText("Ritmo de vendas")).toBeVisible();
  const queue = page.getByRole("list", { name: "Pedidos por etapa" });
  await expect(queue.getByRole("listitem").filter({ hasText: "Recebidos" })).toContainText("3");
  await expect(page.getByRole("list", { name: "Itens mais pedidos hoje" }).getByRole("listitem").first()).toContainText(
    "Pastel de carne"
  );
  // New stores have items without photos.
  await expect(page.getByRole("list", { name: "Avisos do cardápio" })).toContainText("2 itens sem foto");
  await page.getByRole("link", { name: "Relatórios" }).last().click();
  await expect(page).toHaveURL(/\/reports$/);
});

test("reports: today's sales, best sellers, another period and the CSV export", async ({ page }) => {
  const store = await storeWithSales(page);
  await page.goto(`/app/stores/${store.id}/reports`, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Relatórios", level: 1 })).toBeVisible();
  const period = page.getByRole("button", { name: /^Período:/ });
  await expect(period).toHaveAccessibleName("Período: Últimos 30 dias");
  const pick = async (label: string) => {
    await period.click();
    await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
    await page.keyboard.press("Escape");
    await expect(period).toHaveAccessibleName(`Período: ${label}`);
  };
  await pick("Hoje");
  await expect(page.getByText("R$ 46,00").first()).toBeVisible();
  await expect(page.getByText("Pedidos por horário")).toBeVisible();

  const best = page.getByRole("list", { name: "Itens mais vendidos" });
  await expect(best.getByRole("listitem").first()).toContainText("Pastel de carne");
  await expect(best.getByRole("listitem").first()).toContainText("3 un");
  await expect(page.getByRole("list", { name: "Faturamento por canal" })).toContainText("100%");

  // Another period keeps the numbers (all sales are from today) and the URL.
  await pick("Últimos 7 dias");
  await expect(page).toHaveURL(/de=\d{4}-\d{2}-\d{2}&ate=/);
  await expect(page.getByText("Faturamento por dia")).toBeVisible();
  await expect(page.getByText("R$ 46,00").first()).toBeVisible();

  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Itens vendidos" }).click();
  expect((await download).suggestedFilename()).toMatch(/^itens-vendidos-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$/);

  // A store without sales says so instead of empty charts.
  await page.goto(`/app/stores/${store.id}/reports?de=2025-01-01&ate=2025-01-31`);
  await expect(page.getByText("Nenhuma venda neste período")).toBeVisible();
  await expect(period).toHaveAccessibleName("Período: 1 – 31 de jan. de 2025");
});
