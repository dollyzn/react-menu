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

test("with a long queue the kitchen's action button stays on screen", async ({ page }) => {
  await clearKitchen();
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const items = menu.categories.flatMap((c: { items: { id: string }[] }) => c.items);
  for (let i = 0; i < 8; i++) {
    await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
      data: {
        lines: [{ itemId: items[i].id, quantity: 1 }],
        customer: { name: `Fila ${i}`, phone: "11999990000" },
        paymentMethod: "counter",
      },
    });
  }
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, DEMO_STAFF.kitchen);
  await page.goto(page.url().replace(/\/[^/]+$/, "/kitchen"));
  const now = page.getByRole("region", { name: "Fazer agora" });
  await expect(now).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Próximos" }).getByRole("listitem")).toHaveCount(7);
  await expect(now.getByRole("button", { name: "Pronto" })).toBeInViewport();
  await page.screenshot({ path: "test-results/kitchen-long-queue.png", caret: "initial" });

  await clearKitchen();
});

test("orders history: search, open the detail and see who did what", async ({ page }) => {
  const customer = `Histórico ${Date.now()}`;
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const item = menu.categories[0].items[0];
  const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: { lines: [{ itemId: item.id, quantity: 1 }], customer: { name: customer, phone: "11955554444" }, paymentMethod: "counter" },
  });
  const number = (await placed.json()).data.number as number;
  await api.dispose();

  await login(page);
  await page.goto(`/app/stores/${menu.store.id}/orders`);
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page).toHaveURL(/view=historico/);

  await page.getByRole("button", { name: "Filtrar por número, cliente ou telefone" }).click();
  await page.getByPlaceholder("Digite para filtrar...").fill(customer);
  await page.getByRole("button", { name: "Aplicar filtro" }).click();
  const row = page.getByRole("row", { name: new RegExp(customer) });
  await expect(row).toBeVisible();
  await row.click();

  const detail = page.getByRole("dialog");
  await expect(detail.getByText(`#${number}`)).toBeVisible();
  await expect(detail.getByText("Linha do tempo")).toBeVisible();
  await expect(page).toHaveURL(/pedido=/);

  // The open order survives a reload.
  await page.reload();
  await expect(page.getByRole("dialog").getByText(`#${number}`)).toBeVisible();
});

test("orders history: the period filter picks days on the calendar", async ({ page }) => {
  await login(page);
  const storePath = new URL(page.url()).pathname.match(/^\/app\/stores\/[^/]+/)![0];
  await page.goto(`${storePath}/orders?view=historico`);

  await page.getByRole("button", { name: "Filtrar por período" }).click();
  await expect(page.getByRole("grid").first()).toBeVisible();
  const today = new Date();
  await page.locator(`button[data-day="${today.toLocaleDateString("pt-BR")}"]`).first().click();

  const iso = today.toLocaleDateString("sv-SE"); // yyyy-MM-dd in local time
  await expect(page).toHaveURL(new RegExp(`f\\.createdAt=${iso}(~|%7E)${iso}`));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Filtrar por período" })).toContainText(
    today.toLocaleDateString("pt-BR")
  );
});

test("kitchen: swipe right finishes the batch", async ({ page }) => {
  await clearKitchen();
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      lines: [{ itemId: menu.categories[0].items[1].id, quantity: 2 }],
      customer: { name: "Swipe", phone: "11900000000" },
      paymentMethod: "counter",
    },
  });
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, DEMO_STAFF.kitchen);
  await page.goto(page.url().replace(/\/[^/]+$/, "/kitchen"));
  const card = page.getByRole("region", { name: "Fazer agora" });
  await expect(card).toBeVisible();

  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 80);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) await page.mouse.move(box.x + box.width / 2 + step * 30, box.y + 80);
  await page.mouse.up();

  await expect(page.getByText(/2× .* prontos/)).toBeVisible();
  await expect(page.getByText("Tudo pronto por aqui!")).toBeVisible();
});

test("kitchen: undo from the toast brings the batch back", async ({ page }) => {
  await clearKitchen();
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      lines: [{ itemId: menu.categories[0].items[2].id, quantity: 1 }],
      customer: { name: "Desfazer", phone: "11900000001" },
      paymentMethod: "counter",
    },
  });
  await api.dispose();

  await login(page, DEMO_STAFF.kitchen);
  await page.goto(page.url().replace(/\/[^/]+$/, "/kitchen"));
  await page.getByRole("region", { name: "Fazer agora" }).getByRole("button", { name: "Pronto" }).click();
  await expect(page.getByText("Tudo pronto por aqui!")).toBeVisible();

  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("region", { name: "Fazer agora" })).toBeVisible();
  await clearKitchen();
});

test("POS: customer autocomplete fills name and phone", async ({ page }) => {
  const name = `Joaquim Brandão ${Date.now() % 10000}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));

  // First visit: a customer with a phone is remembered by the store.
  await page.getByRole("button", { name: /^Pastel de Carne R\$/ }).click();
  if (await page.getByRole("dialog").isVisible()) await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  await page.getByRole("combobox", { name: "Nome do cliente" }).fill(name);
  await page.getByLabel("Celular do cliente (opcional)").fill("11977776666");
  await page.getByRole("button", { name: "Enviar para a cozinha" }).click();
  await expect(page.getByText(/Pedido #\d+ enviado para a cozinha/)).toBeVisible();

  // Next ticket: typing part of the name (no accent) suggests them.
  const input = page.getByRole("combobox", { name: "Nome do cliente" });
  await input.fill("joaquim brandao");
  const option = page.getByRole("option", { name: new RegExp(name.split(" ").slice(0, 2).join(" ")) }).first();
  await expect(option).toBeVisible();
  await expect(option).toContainText("(11) 97777-6666");
  await page.screenshot({ path: "test-results/pos-autocomplete.png", clip: { x: 880, y: 40, width: 400, height: 360 } });

  await input.press("ArrowDown");
  await input.press("ArrowUp");
  await input.press("Enter");
  await expect(input).toHaveValue(name);
  await expect(page.getByLabel("Celular do cliente (opcional)")).toHaveValue("(11) 97777-6666");
  await expect(page.getByRole("listbox", { name: "Clientes encontrados" })).toBeHidden();

  // Editing the picked name unpicks it: the phone it filled goes away.
  await input.press("Backspace");
  await expect(page.getByLabel("Celular do cliente (opcional)")).toHaveValue("");

  // Pick again, then ✕ clears name and phone together.
  await input.fill("joaquim brandao");
  await option.click();
  await expect(page.getByLabel("Celular do cliente (opcional)")).toHaveValue("(11) 97777-6666");
  await page.getByRole("button", { name: "Limpar cliente" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByLabel("Celular do cliente (opcional)")).toHaveValue("");
});
