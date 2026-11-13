import { request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";
import { test, expect, apiSignIn, login, DEMO_STAFF } from "./fixtures";
import { API_URL, E2E_ADMIN } from "../playwright.config";

/**
 * The shop floor on a weak connection: the request reaches the server but
 * the answer is lost, or the device goes offline for a moment. Each write is
 * retried with the same Idempotency-Key, so nothing is done twice and
 * nothing is lost.
 */

type MenuItem = {
  id: string;
  name: string;
  isAvailable: boolean;
  stockLeft: number | null;
  optionGroups: { minChoices: number }[];
};
type Menu = { store: { id: string }; categories: { name: string; items: MenuItem[] }[] };

/**
 * A pastry that can still be ordered (this file runs after others that use
 * up the demo stock): available, with at least `units` left, and no
 * required choice (added in one tap, sent by the API without picks).
 */
function availablePastry(menu: Menu, units = 3) {
  const item = menu.categories
    .filter((category) => category.name !== "Bebidas")
    .flatMap((category) => category.items)
    .find(
      (entry) =>
        entry.isAvailable &&
        (entry.stockLeft === null || entry.stockLeft >= units) &&
        entry.optionGroups.every((group) => group.minChoices === 0)
    );
  if (!item) throw new Error("No pastry left in stock for this test");
  return item;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function adminApi() {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  return { api, storeId: menu.store.id as string, menu: menu as Menu };
}

async function clearKitchen() {
  const { api, storeId } = await adminApi();
  const queue = await (await api.get(`/api/v1/stores/${storeId}/kitchen/queue`)).json();
  const units = (queue.data as { units: { lineId: number; quantity: number }[] }[]).flatMap((b) => b.units);
  if (units.length) await api.post(`/api/v1/stores/${storeId}/kitchen/prepare`, { data: { units } });
  await api.dispose();
}

type StaffOrder = {
  id: string;
  number: number;
  customerName: string;
  status: string;
  paymentStatus: string;
  counterMethod: string | null;
  items: { preparedQuantity: number }[];
};

async function todaysOrders(api: APIRequestContext, storeId: string) {
  return (await (await api.get(`/api/v1/stores/${storeId}/orders`)).json()).data as StaffOrder[];
}

/** The first matching request reaches the server, but its answer is lost. */
async function loseFirstAnswer(page: Page, url: string | RegExp, method = "POST") {
  const keys: string[] = [];
  let dropped = false;
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    if (!dropped) {
      dropped = true;
      await route.fetch();
      return route.abort("connectionreset");
    }
    return route.continue();
  });
  return keys;
}

async function addPastryToTicket(page: Page, customer: string) {
  const { api, menu } = await adminApi();
  const pastry = availablePastry(menu, 1);
  await api.dispose();
  await page.getByRole("button", { name: new RegExp(`^${escapeRegExp(pastry.name)} R\\$`) }).click();
  if (await page.getByRole("dialog").isVisible()) await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  await page.getByLabel("Nome do cliente").fill(customer);
}

test("POS: an order paid in Pix whose answer is lost is sent once, paid once", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));
  const keys = await loseFirstAnswer(page, "**/api/v1/stores/*/orders");

  const customer = `Sinal fraco ${Date.now()}`;
  await addPastryToTicket(page, customer);
  await page.getByRole("group", { name: "Enviar pago em" }).getByRole("button", { name: "Pix" }).click();
  await page.getByRole("dialog", { name: "Enviar o pedido pago" }).getByRole("button", { name: "Enviar · Pix" }).click();
  await expect(page.getByText(/Pedido #\d+ enviado · pago no Pix/)).toBeVisible();

  expect(keys.length).toBeGreaterThanOrEqual(2);
  expect(new Set(keys).size).toBe(1);
  const { api, storeId } = await adminApi();
  const mine = (await todaysOrders(api, storeId)).filter((order) => order.customerName === customer);
  expect(mine).toHaveLength(1);
  expect(mine[0].paymentStatus).toBe("paid");
  expect(mine[0].counterMethod).toBe("pix");
  await api.dispose();
});

test("POS: offline for a moment, the order waits and goes once when the connection is back", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));

  const customer = `Sem internet ${Date.now()}`;
  await addPastryToTicket(page, customer);
  await page.getByRole("group", { name: "Enviar pago em" }).getByRole("button", { name: "Débito" }).click();
  await context.setOffline(true);
  await page.getByRole("dialog", { name: "Enviar o pedido pago" }).getByRole("button", { name: "Enviar · Débito" }).click();
  await page.waitForTimeout(2500);
  await context.setOffline(false);
  await expect(page.getByText(/Pedido #\d+ enviado · pago no débito/)).toBeVisible({ timeout: 20_000 });

  const { api, storeId } = await adminApi();
  const mine = (await todaysOrders(api, storeId)).filter((order) => order.customerName === customer);
  expect(mine).toHaveLength(1);
  expect(mine[0].counterMethod).toBe("debit");
  await api.dispose();
});

test("kitchen: \"Fiz 1\" whose answer is lost counts one unit, not two", async ({ page }) => {
  await clearKitchen();
  const { api, storeId, menu } = await adminApi();
  const pastry = availablePastry(menu, 3);
  const customer = `Cozinha instável ${Date.now()}`;
  await api.post(`/api/v1/stores/${storeId}/orders`, {
    data: { customer: { name: customer }, lines: [{ itemId: pastry.id, quantity: 3 }], counterMethod: "cash" },
  });

  await login(page, DEMO_STAFF.kitchen);
  await expect(page).toHaveURL(/\/kitchen$/);
  const keys = await loseFirstAnswer(page, "**/api/v1/stores/*/kitchen/prepare");
  const now = page.getByRole("region", { name: "Fazer agora" });
  await expect(now).toContainText("3×");
  await now.getByRole("button", { name: "Fiz 1" }).click();
  await expect(page.getByText(/1× .* pronto/)).toBeVisible();

  expect(keys.length).toBeGreaterThanOrEqual(2);
  expect(new Set(keys).size).toBe(1);
  const order = (await todaysOrders(api, storeId)).find((entry) => entry.customerName === customer)!;
  expect(order.items[0].preparedQuantity).toBe(1);
  await api.dispose();
  await clearKitchen();
});

test("orders board: receiving and delivering with lost answers ends paid once and delivered once", async ({ page }) => {
  await clearKitchen();
  const { api, storeId, menu } = await adminApi();
  const drink = menu.categories
    .find((category) => category.name === "Bebidas")!
    .items.find((entry) => entry.isAvailable && (entry.stockLeft === null || entry.stockLeft >= 1))!;
  // A drink-only order to be paid at pickup: ready at once.
  const placed = await api.post(`/api/v1/stores/${storeId}/orders`, {
    data: { customer: { name: `Balcão instável ${Date.now()}` }, lines: [{ itemId: drink.id, quantity: 1 }] },
  });
  const created = (await placed.json()).data as { id: string; number: number };

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  const paymentKeys = await loseFirstAnswer(page, `**/api/v1/stores/*/orders/${created.id}/payment`);
  const completeKeys = await loseFirstAnswer(page, `**/api/v1/stores/*/orders/${created.id}/complete`);

  const card = page.getByRole("article").filter({ hasText: `#${created.number}` });
  await card.getByRole("button", { name: "Entregar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Dinheiro/ }).click();
  await dialog.getByRole("button", { name: "Exato" }).click();
  await dialog.getByRole("button", { name: /Receber e entregar · Dinheiro/ }).click();
  await expect(page.getByText(`Pedido #${created.number} entregue`)).toBeVisible();

  expect(new Set(paymentKeys).size).toBe(1);
  expect(new Set(completeKeys).size).toBe(1);
  const detail = (await (await api.get(`/api/v1/stores/${storeId}/orders/${created.id}`)).json()).data as StaffOrder & {
    history: { toStatus: string }[];
  };
  expect(detail.status).toBe("completed");
  expect(detail.paymentStatus).toBe("paid");
  expect(detail.counterMethod).toBe("cash");
  expect(detail.history.filter((entry) => entry.toStatus === "completed")).toHaveLength(1);
  await api.dispose();
});

test("orders board: back online after a gap, it shows the orders placed meanwhile", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await expect(page.getByText("Hoje, ao vivo.")).toBeVisible();

  await context.setOffline(true);
  const { api, storeId, menu } = await adminApi();
  const customer = `Chegou offline ${Date.now()}`;
  const placed = await api.post(`/api/v1/stores/${storeId}/orders`, {
    data: { customer: { name: customer }, lines: [{ itemId: availablePastry(menu, 1).id, quantity: 1 }], counterMethod: "pix" },
  });
  const created = (await placed.json()).data as { number: number };
  await page.waitForTimeout(2000);
  await context.setOffline(false);
  const back = Date.now();

  // Right away, not at the next 30 s poll.
  await expect(page.getByRole("article").filter({ hasText: `#${created.number}` })).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - back).toBeLessThan(10_000);
  await api.dispose();
  await clearKitchen();
});

test("POS: when every retry fails and the cashier resends with another method, still one order", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));

  // The first send reaches the server; every answer is lost until the connection recovers.
  let down = true;
  let reached = false;
  await page.route("**/api/v1/stores/*/orders", async (route) => {
    if (route.request().method() !== "POST" || !down) return route.continue();
    if (!reached) {
      reached = true;
      await route.fetch();
    }
    return route.abort("connectionreset");
  });

  const customer = `Reenvio ${Date.now()}`;
  await addPastryToTicket(page, customer);
  await page.getByRole("group", { name: "Enviar pago em" }).getByRole("button", { name: "Pix" }).click();
  await page.getByRole("dialog", { name: "Enviar o pedido pago" }).getByRole("button", { name: "Enviar · Pix" }).click();
  await expect(page.getByText(/Sem confirmação do servidor/)).toBeVisible({ timeout: 40_000 });

  // Back online, the cashier tries again choosing "receber depois".
  down = false;
  await page.getByRole("button", { name: "Voltar" }).click();
  await page.getByRole("button", { name: "Enviar e receber depois" }).click();
  await expect(page.getByText("Este pedido já tinha sido enviado. Confira a forma de pagamento no quadro de pedidos.")).toBeVisible();

  const { api, storeId } = await adminApi();
  const mine = (await todaysOrders(api, storeId)).filter((order) => order.customerName === customer);
  expect(mine).toHaveLength(1);
  expect(mine[0].counterMethod).toBe("pix");
  await api.dispose();
});
