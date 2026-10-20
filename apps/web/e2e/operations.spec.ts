import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login, DEMO_STAFF } from "./fixtures";
import { API_URL, E2E_ADMIN } from "../playwright.config";

/** Marks every pending kitchen unit as done so this test owns the queue. */
async function clearKitchen() {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await api.post("/api/v1/auth/login", { data: E2E_ADMIN });
  const menu = await (await api.get("/api/v1/public/menu?preview=1")).json();
  const storeId = menu.data.store.id as string;
  const queue = await (await api.get(`/api/v1/stores/${storeId}/kitchen/queue`)).json();
  const units = (queue.data as { units: { lineId: number; quantity: number }[] }[]).flatMap((b) => b.units);
  if (units.length) await api.post(`/api/v1/stores/${storeId}/kitchen/prepare`, { data: { units } });
  await api.dispose();
}

test("POS → kitchen → pickup: the whole shop floor flow", async ({ page, browser }) => {
  await clearKitchen();
  const note = `sem cebola ${Date.now()}`;

  // Attendant lands on the orders board and opens the POS.
  await login(page, DEMO_STAFF.attendant);
  await expect(page).toHaveURL(/\/orders$/);
  await page.getByRole("link", { name: "Novo pedido" }).first().click();
  await expect(page).toHaveURL(/\/pos$/);

  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("pastel de carne");
  await page.getByRole("button", { name: /^Pastel de Carne R\$/ }).click();
  const customizer = page.getByRole("dialog");
  await customizer.getByRole("textbox", { name: /observação/i }).fill(note);
  await customizer.getByRole("button", { name: "Aumentar quantidade" }).click();
  await customizer.getByRole("button", { name: /Adicionar/ }).click();

  await page.getByLabel("Nome do cliente").fill("Mesa 4");
  await page.getByRole("button", { name: "Enviar para a cozinha" }).click();
  const toastText = await page.getByText(/Pedido #\d+ enviado para a cozinha/).textContent();
  const number = toastText!.match(/#(\d+)/)![1];

  // The cook sees it as the current batch, with the note and the ingredients.
  const kitchenContext = await browser.newContext();
  const kitchenPage = await kitchenContext.newPage();
  await login(kitchenPage, DEMO_STAFF.kitchen);
  await expect(kitchenPage).toHaveURL(/\/kitchen$/);
  const now = kitchenPage.getByRole("region", { name: "Fazer agora" });
  await expect(now).toContainText("2×");
  await expect(now).toContainText("Pastel de Carne");
  await expect(now).toContainText(note);
  await expect(now).toContainText("Carne moída");
  await expect(now).toContainText(`#${number}`);
  await kitchenPage.screenshot({ path: "test-results/kitchen.png", caret: "initial" });

  await now.getByRole("button", { name: "Fiz 1" }).click();
  await expect(kitchenPage.getByText(/1× Pastel de Carne pronto/)).toBeVisible();
  // One unit left: the main button now reads "Pronto".
  await now.getByRole("button", { name: /^(Fiz todos|Pronto)/ }).click();
  await expect(kitchenPage.getByText("Tudo pronto por aqui!")).toBeVisible();
  await kitchenContext.close();

  // Back at the counter the order is ready to hand over.
  await page.getByRole("link", { name: "Pedidos" }).first().click();
  const card = page.getByRole("article", { name: `Pedido ${number} de Mesa 4` });
  await expect(card).toBeVisible();
  await page.screenshot({ path: "test-results/orders-board.png", caret: "initial" });
  await card.getByRole("button", { name: "Entregar" }).click();
  await expect(page.getByText(`Pedido #${number} entregue`)).toBeVisible();
  await expect(card).toBeHidden();
});
