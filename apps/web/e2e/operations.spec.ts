import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login, DEMO_STAFF, apiSignIn } from "./fixtures";
import { API_URL, E2E_ADMIN } from "../playwright.config";

/** Marks every pending kitchen unit as done so this test owns the queue. */
async function clearKitchen() {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
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
  // Items that need no choice (the cheese of choice is required elsewhere).
  type MenuItem = { id: string; optionGroups: { minChoices: number }[] };
  const items = menu.categories
    .flatMap((c: { items: MenuItem[] }) => c.items)
    .filter((item: MenuItem) => item.optionGroups.every((group) => group.minChoices === 0));
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

test("orders history on a phone: the period filter is a button like the others and opens the dates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const storePath = new URL(page.url()).pathname.match(/^\/app\/stores\/[^/]+/)![0];
  await page.goto(`${storePath}/orders?view=historico`);

  const period = page.getByRole("button", { name: "Filtrar por período" });
  const status = page.getByRole("button", { name: "Filtrar por status" });
  await expect(period).toBeVisible();
  // Same height as its neighbours (it used to render unstyled, stacked).
  const [periodBox, statusBox] = [await period.boundingBox(), await status.boundingBox()];
  expect(Math.abs(periodBox!.height - statusBox!.height)).toBeLessThan(2);
  await page.screenshot({ path: process.env.SHOT ?? "test-results/period-filter-phone.png" });

  await period.click();
  const drawer = page.getByRole("dialog", { name: "Filtrar por Período" });
  await expect(drawer.getByRole("grid").first()).toBeVisible();
  // Quick periods are chips (a Select's list opened outside the drawer and swallowed the taps).
  await drawer.getByRole("group", { name: "Períodos rápidos" }).getByRole("button", { name: "Hoje" }).click();
  const iso = new Date().toLocaleDateString("sv-SE");
  await expect(page).toHaveURL(new RegExp(`f\\.createdAt=${iso}(~|%7E)${iso}`));
  await expect(drawer.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: (process.env.SHOT ?? "test-results/period-filter-phone.png").replace(".png", "-open.png") });
  await drawer.getByRole("button", { name: "Aplicar" }).click();
  await expect(drawer).toBeHidden();
  await expect(period).toContainText(new Date().toLocaleDateString("pt-BR"));
});

test("kitchen: swipe right finishes the batch", async ({ page }) => {
  await clearKitchen();
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      // Pastel de Frango (needs no choice).
      lines: [{ itemId: menu.categories[0].items[2].id, quantity: 2 }],
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

test("POS on a phone: clearing the ticket closes its drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));

  await page.getByRole("button", { name: /^Pastel de Carne R\$/ }).click();
  if (await page.getByRole("dialog").isVisible()) await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  await page.getByRole("button", { name: /Comanda \(1\)/ }).click();
  const drawer = page.getByRole("dialog", { name: "Comanda" });
  await expect(drawer).toBeVisible();

  await drawer.getByRole("button", { name: "Limpar", exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByText("Comanda limpa")).toBeVisible();
  // "Desfazer" brings the items back (the drawer stays closed).
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("button", { name: /Comanda \(1\)/ })).toBeVisible();
});

test("orders board: the order's menu fits its items on one line", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const item = menu.categories[0].items[0];
  const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: { lines: [{ itemId: item.id, quantity: 1 }], customer: { name: "Menu largo", phone: "11955553333" }, paymentMethod: "counter" },
  });
  const number = (await placed.json()).data.number as number;
  await api.dispose();

  await login(page);
  await page.goto(`/app/stores/${menu.store.id}/orders`);
  await page.getByRole("button", { name: `Mais ações do pedido ${number}` }).click();
  for (const name of ["Marcar como pago", "Cancelar pedido"]) {
    const box = await page.getByRole("menuitem", { name }).boundingBox();
    // One line of text (a wrapped label doubles the height).
    expect(box!.height).toBeLessThan(40);
  }
});

test("kitchen: after \"Fiz 1\" the card comes back without flashing the other side's color", async ({ page }) => {
  await clearKitchen();
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      lines: [{ itemId: menu.categories[0].items[2].id, quantity: 3 }],
      customer: { name: "Fiz um", phone: "11900000001" },
      paymentMethod: "counter",
    },
  });
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, DEMO_STAFF.kitchen);
  await page.goto(page.url().replace(/\/[^/]+$/, "/kitchen"));
  const card = page.getByRole("region", { name: "Fazer agora" });
  await expect(card).toBeVisible();

  // Every frame, the highest opacity the green ("Fiz todos") side reached.
  await page.evaluate(() => {
    const w = window as unknown as { maxGreen: number };
    w.maxGreen = 0;
    const tick = () => {
      for (const panel of document.querySelectorAll<HTMLElement>("[aria-hidden] > .bg-success")) {
        w.maxGreen = Math.max(w.maxGreen, Number(getComputedStyle(panel).opacity));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 80);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) await page.mouse.move(box.x + box.width / 2 - step * 30, box.y + 80);
  await page.mouse.up();

  await expect(page.getByText(/1× .* pronto/)).toBeVisible();
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as unknown as { maxGreen: number }).maxGreen)).toBeLessThan(0.05);
});

test("orders board: \"Entregar\" reminds of the items that skip the kitchen", async ({ page }) => {
  await clearKitchen();
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const drink = menu.categories.find((category: { name: string }) => category.name === "Bebidas").items[0];
  const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      lines: [
        { itemId: menu.categories[0].items[2].id, quantity: 1 },
        { itemId: drink.id, quantity: 2 },
      ],
      customer: { name: "Com bebida", phone: "11900000003" },
      paymentMethod: "counter",
    },
  });
  const number = (await placed.json()).data.number as number;
  await api.dispose();
  // The kitchen finishes the pastry: the order is ready.
  await clearKitchen();

  await login(page, DEMO_STAFF.attendant);
  const card = page.getByRole("article", { name: new RegExp(`Pedido ${number} de`) });
  await card.getByRole("button", { name: "Entregar" }).click();
  const reminder = page.getByRole("alertdialog");
  await expect(reminder).toContainText(`Separou tudo do pedido #${number}?`);
  await expect(reminder.getByRole("list", { name: "Itens sem preparo" })).toContainText(`2×${drink.name}`);
  await reminder.getByRole("button", { name: "Voltar" }).click();
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Entregar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sim, entregar" }).click();
  await expect(page.getByText(`Pedido #${number} entregue`)).toBeVisible();
});

test("kitchen: swiping a card off never makes the page scroll sideways", async ({ page }) => {
  await clearKitchen();
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  for (const [i, q] of [[2, 2], [3, 1]] as const) {
    await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
      data: { customer: { name: "Sem rolagem" }, lines: [{ itemId: menu.categories[0].items[i].id, quantity: q }] },
    });
  }
  await api.dispose();
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, DEMO_STAFF.kitchen);
  await page.goto(page.url().replace(/\/[^/]+$/, "/kitchen"));
  const card = page.getByRole("region", { name: "Fazer agora" });
  await expect(card).toBeVisible();

  // Every frame: did the document get wider than the screen?
  await page.evaluate(() => {
    const w = window as unknown as { sideways: number };
    w.sideways = 0;
    const tick = () => {
      const d = document.documentElement;
      if (d.scrollWidth > d.clientWidth + 1) w.sideways++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const box = (await card.boundingBox())!;
  for (const direction of [-1, 1]) {
    await page.mouse.move(box.x + box.width / 2, box.y + 120);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) await page.mouse.move(box.x + box.width / 2 + direction * step * 30, box.y + 120);
    await page.mouse.up();
    await page.waitForTimeout(1500);
  }
  expect(await page.evaluate(() => (window as unknown as { sideways: number }).sideways)).toBe(0);
});

test("orders board: today's finished orders, in a collapsed list that opens them", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const drink = menu.categories.find((category: { name: string }) => category.name === "Bebidas").items[0];
  // A drink-only order is ready at once: hand it over.
  const placed = await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
    data: { customer: { name: "Já entregue" }, lines: [{ itemId: drink.id, quantity: 1 }] },
  });
  const order = (await placed.json()).data as { id: string; number: number };
  expect((await api.post(`/api/v1/stores/${menu.store.id}/orders/${order.id}/complete`)).ok()).toBeTruthy();
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);
  await page.goto(`/app/stores/${menu.store.id}/orders`);
  const toggle = page.getByRole("button", { name: /Concluídos e cancelados hoje/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const row = page.getByRole("button", { name: new RegExp(`#${order.number}.*Já entregue.*Entregue`) });
  await expect(row).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/finished-light.png` });
  await row.click();
  await expect(page).toHaveURL(new RegExp(`pedido=${order.id}`));
});

test("orders history on a phone: the view toggle switches to the table and stays", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const storePath = new URL(page.url()).pathname.match(/^\/app\/stores\/[^/]+/)![0];
  await page.goto(`${storePath}/orders?view=historico`);

  // Phones start on cards.
  await expect(page.getByRole("button", { name: "Exibir como tabela" })).toBeVisible();
  await page.getByRole("button", { name: "Exibir como tabela" }).click();
  // It used to snap back to cards at once.
  await expect(page.getByRole("button", { name: "Exibir como cartões" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();

  // Kept on this device.
  await page.reload();
  await expect(page.getByRole("button", { name: "Exibir como cartões" })).toBeVisible();
  await page.getByRole("button", { name: "Exibir como cartões" }).click();
  await expect(page.getByRole("button", { name: "Exibir como tabela" })).toBeVisible();
});
