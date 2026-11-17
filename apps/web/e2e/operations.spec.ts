import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login, DEMO_STAFF, apiSignIn, slowClick } from "./fixtures";
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
  // Paid at pickup (the exception): received on the board below.
  await page.getByRole("button", { name: "Enviar e receber depois" }).click();
  await page.getByRole("button", { name: /^Receber na retirada/ }).click();
  await page.getByRole("button", { name: "Enviar · receber na retirada" }).click();
  const toastText = await page.getByText(/Pedido #\d+ enviado · receber depois/).textContent();
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
  // Not paid yet: received (in cash, with the change), then handed over.
  const receiving = page.getByRole("dialog");
  await receiving.getByRole("button", { name: /^Dinheiro/ }).click();
  await receiving.getByRole("button", { name: "Exato" }).click();
  await receiving.getByRole("button", { name: /Receber e entregar · Dinheiro/ }).click();
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

test("orders history on a phone: the period is in the filters drawer, with quick periods and the dates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const storePath = new URL(page.url()).pathname.match(/^\/app\/stores\/[^/]+/)![0];
  await page.goto(`${storePath}/orders?view=historico`);

  await page.getByRole("button", { name: /^Filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros" });
  // Quick periods are toggles (a Select's list opened outside the drawer and swallowed the taps).
  const today = drawer.getByRole("group", { name: "Períodos rápidos" }).getByRole("button", { name: "Hoje" });
  await today.click();
  const iso = new Date().toLocaleDateString("sv-SE");
  await expect(page).toHaveURL(new RegExp(`f\\.createdAt=${iso}(~|%7E)${iso}`));
  await expect(today).toHaveAttribute("aria-pressed", "true");
  // The calendar opens on demand.
  await drawer.getByRole("button", { name: "Escolher datas" }).click();
  await expect(drawer.getByRole("grid").first()).toBeVisible();
  await page.screenshot({ path: process.env.SHOT ?? "test-results/period-filter-phone.png" });
  await drawer.getByRole("button", { name: /^Ver / }).click();
  await expect(drawer).toBeHidden();
  // In use: a chip under the search.
  await expect(page.getByRole("button", { name: /^Tirar o filtro Período: / })).toBeVisible();
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
  // Confirmed before it goes (the method can't change afterwards); a wrong tap is fixed there.
  await page.getByRole("group", { name: "Enviar pago em" }).getByRole("button", { name: "Crédito" }).click();
  const confirm = page.getByRole("dialog", { name: "Enviar o pedido pago" });
  await expect(confirm.getByRole("button", { name: /^Crédito/ })).toHaveAttribute("aria-pressed", "true");
  await confirm.getByRole("button", { name: /^Pix/ }).click();
  await confirm.getByRole("button", { name: "Enviar · Pix" }).click();
  await expect(page.getByText(/Pedido #\d+ enviado · pago no Pix/)).toBeVisible();

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
  // Pressed near its top edge: the press effect used to move it out from under the pointer.
  await slowClick(page.getByRole("button", { name: "Limpar cliente" }), { x: 12, y: 2 });
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
  for (const name of ["Receber pagamento", "Cancelar pedido"]) {
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
  // Paid at the counter: the payment comes first, with the reminder.
  const reminder = page.getByRole("dialog");
  await expect(reminder).toContainText("Confira antes de entregar");
  const extra = reminder.getByRole("list", { name: "Itens sem preparo" }).getByRole("listitem");
  await expect(extra).toContainText(drink.name);
  await expect(extra).toContainText("2×");
  // Recognized at a glance: its category (and photo, when the item has one).
  await expect(extra).toContainText("Bebidas");
  await reminder.getByRole("button", { name: "Voltar" }).click();
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Entregar" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Pix/ })).toBeVisible();
  if (process.env.SHOTS) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${process.env.SHOTS}/deliver-light.png` });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${process.env.SHOTS}/deliver-dark.png` });
    await page.emulateMedia({ colorScheme: "light" });
  }
  // While it closes, the dialog keeps showing what it showed: the order turns
  // paid under it, and it used to swap to the "Separou tudo?" dialog.
  await page.evaluate(() => {
    const flags = window as unknown as { swapped?: boolean };
    new MutationObserver(() => {
      if (document.body.textContent?.includes("Separou tudo")) flags.swapped = true;
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.getByRole("dialog").getByRole("button", { name: /^Pix/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Receber e entregar · Pix/ }).click();
  await expect(page.getByText(`Pedido #${number} entregue`)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { swapped?: boolean }).swapped ?? false)).toBe(false);
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
    data: { customer: { name: "Já entregue" }, lines: [{ itemId: drink.id, quantity: 1 }], counterMethod: "pix" },
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

test("orders history on a phone: the view switches to the table in the drawer and stays", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const storePath = new URL(page.url()).pathname.match(/^\/app\/stores\/[^/]+/)![0];
  await page.goto(`${storePath}/orders?view=historico`);

  const filters = page.getByRole("button", { name: /^Filtros/ });
  const drawer = page.getByRole("dialog", { name: "Filtros" });
  const view = drawer.getByRole("group", { name: "Exibir como" });
  // Phones start on cards.
  await filters.click();
  await expect(view.getByRole("button", { name: "Cartões" })).toHaveAttribute("aria-pressed", "true");
  await view.getByRole("button", { name: "Tabela" }).click();
  await drawer.getByRole("button", { name: /^Ver / }).click();
  // It used to snap back to cards at once.
  await expect(page.getByRole("table")).toBeVisible();

  // Kept on this device.
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await filters.click();
  await expect(view.getByRole("button", { name: "Tabela" })).toHaveAttribute("aria-pressed", "true");
  await view.getByRole("button", { name: "Cartões" }).click();
  await drawer.getByRole("button", { name: /^Ver / }).click();
  await expect(page.getByRole("table")).toBeHidden();
});

test("attendants: today's board only, no cancelling, and Entregar takes the payment first", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const drink = menu.categories.find((category: { name: string }) => category.name === "Bebidas").items[0];
  // A drink-only POS order is ready at once and not paid yet.
  const placed = await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
    data: { customer: { name: "Paga na entrega" }, lines: [{ itemId: drink.id, quantity: 1 }] },
  });
  const order = (await placed.json()).data as { id: string; number: number };
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(`/app/stores/${menu.store.id}/orders?view=historico`);
  // No history: the board, without the tabs or the day's finished list.
  await expect(page.getByText("Hoje, ao vivo.")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Histórico/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Concluídos e cancelados hoje/ })).toHaveCount(0);

  const card = page.getByRole("article").filter({ hasText: `#${order.number}` });
  // The detail (timeline, cancelling) is for managers: the card doesn't open it.
  await expect(card.getByRole("button", { name: `Ver detalhes do pedido ${order.number}` })).toHaveCount(0);
  await card.getByRole("button", { name: `Mais ações do pedido ${order.number}` }).click();
  await expect(page.getByRole("menuitem", { name: "Receber pagamento" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Cancelar pedido" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await card.getByRole("button", { name: "Entregar" }).click();
  const dialog = page.getByRole("dialog", { name: `Receber e entregar o pedido #${order.number}` });
  await expect(dialog).toBeVisible();
  // Cash with the change worked out: R$ 20 for the drink.
  await dialog.getByRole("button", { name: /^Dinheiro/ }).click();
  await dialog.getByRole("textbox", { name: "Valor recebido em dinheiro" }).fill("2000");
  await expect(dialog.getByRole("status")).toContainText("Troco");
  await dialog.getByRole("button", { name: /Receber e entregar · Dinheiro · troco/ }).click();
  await expect(page.getByText(`Pedido #${order.number} entregue`)).toBeVisible();
  await expect(card).toHaveCount(0);

  // The latest hand-overs stay to check: items and drinks, no amounts.
  await page.getByRole("button", { name: /Últimos entregues/ }).click();
  const delivered = page.getByRole("listitem", { name: `Pedido ${order.number} de Paga na entrega` });
  await expect(delivered).toContainText(drink.name);
  await expect(delivered).toContainText("Entregue às");
  await expect(delivered).not.toContainText("R$");

  // The order is paid and delivered.
  const check = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(check, E2E_ADMIN);
  const saved = (await (await check.get(`/api/v1/stores/${menu.store.id}/orders/${order.id}`)).json()).data;
  expect(saved.status).toBe("completed");
  expect(saved.paymentStatus).toBe("paid");
  expect(saved.counterMethod).toBe("cash");
  expect(saved.paidBy.name).toBeTruthy();
  await check.dispose();
});

test("orders board: a paid order's \"Separou tudo?\" keeps a long item name inside the dialog", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const drinks: { id: string; name: string }[] = menu.categories.find(
    (category: { name: string }) => category.name === "Bebidas"
  ).items;
  const longest = drinks.reduce((a, b) => (b.name.length > a.name.length ? b : a));
  const placed = await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
    data: { customer: { name: "Já pago" }, lines: [{ itemId: longest.id, quantity: 1 }] },
  });
  const order = (await placed.json()).data as { id: string; number: number };
  await api.post(`/api/v1/stores/${menu.store.id}/orders/${order.id}/payment`, { data: { method: "cash" } });
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto(`/app/stores/${menu.store.id}/orders`);
  await page.getByRole("article").filter({ hasText: `#${order.number}` }).getByRole("button", { name: "Entregar" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(`Separou tudo do pedido #${order.number}?`);
  await page.waitForTimeout(300);
  // The item's row used to widen the dialog's grid past its edge.
  const outer = (await dialog.boundingBox())!;
  const list = (await dialog.getByRole("list", { name: "Itens sem preparo" }).boundingBox())!;
  expect(list.x + list.width).toBeLessThanOrEqual(outer.x + outer.width - 8);
  await dialog.getByRole("button", { name: "Sim, entregar" }).click();
  await expect(page.getByText(`Pedido #${order.number} entregue`)).toBeVisible();
});

test("POS: an order paid in cash goes with the change worked out, recording how", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));

  await page.getByRole("button", { name: /^Pastel de Carne R\$/ }).click();
  if (await page.getByRole("dialog").isVisible()) await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  await page.getByLabel("Nome do cliente").fill("Troco certo");
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/pos-footer.png` });

  await page.getByRole("group", { name: "Enviar pago em" }).getByRole("button", { name: "Dinheiro" }).click();
  const cash = page.getByRole("dialog", { name: "Enviar o pedido pago" });
  await cash.getByRole("textbox", { name: "Valor recebido em dinheiro" }).fill("1000");
  // Less than the total: it can't go yet.
  await expect(cash.getByRole("status")).toContainText("Faltam");
  await expect(cash.getByRole("button", { name: /^Enviar · Dinheiro/ })).toBeDisabled();
  await cash.getByRole("textbox", { name: "Valor recebido em dinheiro" }).fill("5000");
  await expect(cash.getByRole("status")).toContainText("Troco");
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/pos-cash.png` });
  await cash.getByRole("button", { name: /^Enviar · Dinheiro · troco/ }).click();

  const toastText = await page.getByText(/Pedido #\d+ enviado · pago em dinheiro/).textContent();
  const number = Number(toastText!.match(/#(\d+)/)![1]);
  const orders = (await (await page.request.get(`${API_URL}/api/v1/stores/${page.url().split("/")[5]}/orders`)).json()).data as {
    number: number;
    paymentStatus: string;
    counterMethod: string | null;
  }[];
  const sent = orders.find((order) => order.number === number)!;
  expect(sent.paymentStatus).toBe("paid");
  expect(sent.counterMethod).toBe("cash");
});

test("tracking page: \"Avisar quando ficar pronto\" stays on after a reload and alerts when the kitchen finishes", async ({ page, context }) => {
  await clearKitchen();
  await context.grantPermissions(["notifications"]);
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const pastry = menu.categories[0].items[2];
  const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      lines: [{ itemId: pastry.id, quantity: 1 }],
      customer: { name: "Aviso pronto", phone: "11900000009" },
      paymentMethod: "counter",
    },
  });
  const { publicToken, number } = (await placed.json()).data as { publicToken: string; number: number };
  await api.dispose();

  await page.goto(`/pedido/${publicToken}`);
  await page.getByRole("button", { name: "Avisar quando ficar pronto" }).click();
  // No Firebase here: the page itself alerts, while it is open.
  await expect(page.getByRole("status").filter({ hasText: "deixe esta página aberta" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Vamos te avisar por aqui")).toBeVisible();

  // "Não avisar" turns it off (and stays off after a reload); on again for the rest.
  await page.getByRole("button", { name: "Não avisar" }).click();
  await expect(page.getByRole("button", { name: "Avisar quando ficar pronto" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Avisar quando ficar pronto" })).toBeVisible();
  await page.getByRole("button", { name: "Avisar quando ficar pronto" }).click();
  await expect(page.getByText("Vamos te avisar por aqui")).toBeVisible();

  await clearKitchen();
  await expect(page.getByText("Pronto! Pode vir buscar")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.title(), { timeout: 5_000 }).toContain(`Pedido #${number} pronto!`);
});

test("orders board: items added to an order in the queue, paid on Pix or left to receive", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const items = menu.categories.flatMap((category: { items: { id: string; name: string }[] }) => category.items);
  const pastry = items.find((item: { name: string }) => item.name === "Pastel de Carne");
  const drink = menu.categories.find((category: { name: string }) => category.name === "Bebidas").items[0];
  const placed = await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
    data: { customer: { name: "Quer mais" }, counterMethod: "cash", lines: [{ itemId: pastry.id, quantity: 1 }] },
  });
  const order = (await placed.json()).data as { id: string; number: number; total: number };

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(`/app/stores/${menu.store.id}/orders`);
  const card = page.getByRole("article").filter({ hasText: `#${order.number}` });
  const addItems = async () => {
    await card.getByRole("button", { name: `Mais ações do pedido ${order.number}` }).click();
    await page.getByRole("menuitem", { name: "Adicionar itens" }).click();
    await expect(page.getByText(`Adicionando ao pedido #${order.number}`)).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`^${drink.name} R\\$`) }).click();
  };

  // A drink paid on Pix: confirmed like the POS, then back to the board.
  await addItems();
  await page.getByRole("group", { name: "Adicionar pago em" }).getByRole("button", { name: "Pix" }).click();
  await page
    .getByRole("dialog", { name: `Adicionar ao pedido #${order.number}` })
    .getByRole("button", { name: /^Adicionar · Pix/ })
    .click();
  await expect(page.getByText(`Adicionado ao pedido #${order.number} · pago no Pix`)).toBeVisible();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(card).toContainText(drink.name);

  // Another, left to receive: the card says what is missing.
  await addItems();
  await page.getByRole("button", { name: "Adicionar e receber depois" }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(card).toContainText(/Falta receber R\$\s?[\d,]+/);

  const partly = (await (await api.get(`/api/v1/stores/${menu.store.id}/orders/${order.id}`)).json()).data;
  expect(partly.items).toHaveLength(3);
  expect(partly.receipts.map((receipt: { counterMethod: string }) => receipt.counterMethod)).toEqual(["cash", "pix"]);
  expect(partly.amountDue).toBe(partly.total - partly.amountPaid);
  expect(partly.paymentStatus).toBe("pending");

  // One more, paid now: the dialog takes what was still due too.
  await addItems();
  await page.getByRole("group", { name: "Adicionar pago em" }).getByRole("button", { name: "Débito" }).click();
  const debit = page.getByRole("dialog", { name: `Adicionar ao pedido #${order.number}` });
  await expect(debit).toContainText("que faltava");
  await debit.getByRole("button", { name: /^Adicionar · Débito/ }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(card).not.toContainText("Falta receber");

  const saved = (await (await api.get(`/api/v1/stores/${menu.store.id}/orders/${order.id}`)).json()).data;
  expect(saved.items).toHaveLength(4);
  expect(saved.receipts.map((receipt: { counterMethod: string }) => receipt.counterMethod)).toEqual(["cash", "pix", "debit"]);
  expect(saved.amountDue).toBe(0);
  expect(saved.paymentStatus).toBe("paid");

  // Once the kitchen made something, nothing more joins it: a new order for the same customer.
  const pastryLine = saved.items.find((line: { requiresPreparation: boolean }) => line.requiresPreparation);
  await api.post(`/api/v1/stores/${menu.store.id}/kitchen/prepare`, {
    data: { units: [{ lineId: pastryLine.id, quantity: 1 }] },
  });
  await api.dispose();
  await page.goto(`/app/stores/${menu.store.id}/pos?pedido=${order.id}`);
  await expect(page.getByText(`O pedido #${order.number} já entrou em preparo`)).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^${drink.name} R\\$`) }).click();
  await expect(page.getByRole("group", { name: "Enviar pago em" }).getByRole("button", { name: "Pix" })).toBeDisabled();
  await page.getByRole("button", { name: "Lançar como pedido novo" }).click();
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("Quer mais");
  await expect(page.getByRole("group", { name: "Enviar pago em" }).getByRole("button", { name: "Pix" })).toBeEnabled();
});

test("POS: a line in the ticket opens with its picks and is saved in place", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));

  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
  const drink = page.getByRole("button", { name: /^Coca-Cola/ }).first();
  const drinkName = (await drink.getAttribute("aria-label"))!.replace(/ R\$.*$/, "");
  await drink.click();
  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("");
  const ticket = page.getByRole("complementary", { name: "Comanda" });

  // Opened from the ticket: "Salvar", not "Adicionar"; a note and one more.
  const editDrink = ticket.getByRole("button", { name: new RegExp(`^Editar ${drinkName}`) });
  await editDrink.first().click();
  const editor = page.getByRole("dialog", { name: drinkName });
  await expect(editor.getByRole("button", { name: /Salvar/ })).toBeVisible();
  await editor.getByLabel("Alguma observação?").fill("Sem gelo");
  await editor.getByRole("button", { name: "Aumentar quantidade" }).click();
  await editor.getByRole("button", { name: /Salvar/ }).click();
  await expect(editor).toBeHidden();

  // Still one line, changed where it was.
  await expect(ticket.getByRole("button", { name: /^Editar / })).toHaveCount(1);
  await expect(ticket.getByText("“Sem gelo”")).toBeVisible();
  await expect(ticket.getByText(/^2 ×/)).toBeVisible();

  // Opened again: it starts from what was saved.
  await editDrink.click();
  await expect(editor.getByLabel("Alguma observação?")).toHaveValue("Sem gelo");
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();

  // Another one, plain; given the same note it joins the first line.
  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
  await drink.click();
  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("");
  await expect(editDrink).toHaveCount(2);
  await editDrink.last().click();
  await editor.getByLabel("Alguma observação?").fill("Sem gelo");
  await editor.getByRole("button", { name: /Salvar/ }).click();
  await expect(editDrink).toHaveCount(1);
  await expect(ticket.getByText(/^3 ×/)).toBeVisible();

  // The usual case: the customer changes the cheese.
  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("frango com queijo");
  await page.getByRole("button", { name: /^Pastel de Frango com Queijo R\$/ }).click();
  const pastry = page.getByRole("dialog", { name: "Pastel de Frango com Queijo" });
  await pastry.getByText("Catupiry", { exact: true }).click();
  await pastry.getByRole("button", { name: /Adicionar/ }).click();
  await ticket.getByRole("button", { name: /^Editar Pastel de Frango com Queijo/ }).click();
  await expect(pastry.getByRole("radio", { name: /Catupiry/ })).toBeChecked();
  await pastry.getByText("Cheddar", { exact: true }).click();
  await pastry.getByRole("button", { name: /Salvar/ }).click();
  await expect(ticket.getByText(/Escolha o queijo: Cheddar/)).toBeVisible();
  await expect(ticket.getByText(/Catupiry/)).toHaveCount(0);
});

test("POS: the ticket survives a reload and is gone once sent", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));
  const ticket = page.getByRole("complementary", { name: "Comanda" });

  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
  await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
  await page.getByLabel("Nome do cliente").fill("Volta já");
  await page.reload();

  await expect(page.getByText("Comanda recuperada")).toBeVisible();
  await expect(ticket.getByRole("button", { name: /^Editar Coca-Cola/ })).toHaveCount(1);
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("Volta já");

  await page.getByRole("group", { name: "Enviar pago em" }).getByRole("button", { name: "Pix" }).click();
  await page.getByRole("dialog", { name: "Enviar o pedido pago" }).getByRole("button", { name: /^Enviar · Pix/ }).click();
  await expect(page.getByText(/Pedido #\d+ enviado · pago no Pix/)).toBeVisible();
  await page.reload();
  await expect(ticket.getByText("Toque nos produtos para montar o pedido.")).toBeVisible();
  await expect(page.getByText("Comanda recuperada")).toHaveCount(0);
});

test("kitchen: add-ons by group, the group once and each pick on its own", async ({ page }) => {
  await clearKitchen();
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  type Group = { id: string; name: string; options: { id: string; name: string }[] };
  const items = menu.categories.flatMap((category: { items: object[] }) => category.items);
  const pastry = items.find((item: { name: string }) => item.name === "Pastel de Frango com Queijo");
  const cheese = pastry.optionGroups.find((group: Group) => group.name === "Escolha o queijo") as Group;
  const cheddar = cheese.options.find((option) => option.name === "Cheddar")!;
  await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
    data: {
      customer: { name: "Cozinha" },
      counterMethod: "cash",
      lines: [{ itemId: pastry.id, quantity: 1, choices: [{ groupId: cheese.id, addonId: cheddar.id }] }],
    },
  });
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.kitchen);
  await page.goto(`/app/stores/${menu.store.id}/kitchen`);
  const now = page.getByText("Fazer agora").locator("xpath=ancestor::*[contains(@class,'flex-col')][1]");
  await expect(now.getByRole("term").filter({ hasText: "Escolha o queijo" })).toBeVisible();
  await expect(now.getByRole("definition").filter({ hasText: /^Cheddar$/ })).toBeVisible();
  await expect(now.getByText("Escolha o queijo: Cheddar")).toHaveCount(0);
});

test("POS: an item whose stock runs out shows sold out without a reload", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const storeId = menu.store.id as string;
  const name = "Coca-Cola Zero lata 350 ml";
  const ingredients = (await (await api.get(`/api/v1/stores/${storeId}/ingredients?perPage=100`)).json()).data as {
    id: number;
    name: string;
    stockQuantity: number;
  }[];
  const stock = ingredients.find((ingredient) => ingredient.name === name)!;
  const count = (quantity: number) =>
    api.post(`/api/v1/stores/${storeId}/ingredients/${stock.id}/movements`, { data: { type: "adjustment", quantity } });

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(`/app/stores/${storeId}/pos`);
  const product = page.getByRole("button", { name: new RegExp(`^${name}`) });
  await expect(product).toBeEnabled();

  try {
    // Counted: none left. The open POS hears it and marks it sold out.
    await count(0);
    await expect(product).toHaveAccessibleName(new RegExp(`^${name} Esgotado`));
    await expect(product).toBeDisabled();
  } finally {
    await count(stock.stockQuantity);
    await api.dispose();
  }
});

test("POS: a kept ticket never goes into an order being added to", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const drink = menu.categories.find((category: { name: string }) => category.name === "Bebidas").items[0];
  const pastry = menu.categories
    .flatMap((category: { items: { id: string; name: string }[] }) => category.items)
    .find((item: { name: string }) => item.name === "Pastel de Carne");
  const order = (
    await (
      await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
        data: { customer: { name: "Outro" }, counterMethod: "cash", lines: [{ itemId: pastry.id, quantity: 1 }] },
      })
    ).json()
  ).data as { id: string; number: number };
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(`/app/stores/${menu.store.id}/pos`);
  const ticket = page.getByRole("complementary", { name: "Comanda" });
  await page.getByRole("button", { name: new RegExp(`^${drink.name} R\\$`) }).click();
  await page.getByLabel("Nome do cliente").fill("Guardada");

  // Adding to another order: an empty ticket, the kept one stays aside.
  await page.goto(`/app/stores/${menu.store.id}/pos?pedido=${order.id}`);
  await expect(page.getByText(`Adicionando ao pedido #${order.number}`)).toBeVisible();
  await expect(ticket.getByText("Toque nos produtos para montar o pedido.")).toBeVisible();

  // Back to the POS: the kept ticket is there.
  await page.goto(`/app/stores/${menu.store.id}/pos`);
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("Guardada");
  await expect(ticket.getByRole("button", { name: new RegExp(`^Editar ${drink.name}`) })).toHaveCount(1);
});

test("POS: a kept ticket comes back at today's prices, and signing out forgets it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, DEMO_STAFF.attendant);
  const storePath = new URL(page.url()).pathname.replace(/\/orders$/, "");
  const storeId = storePath.split("/")[3];
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu?preview=1`)).json()).data;
  const drink = menu.categories.find((category: { name: string }) => category.name === "Bebidas").items[0];

  // A ticket kept before a price change (stored as it was then).
  await page.goto(`${storePath}/pos`);
  await page.evaluate(
    ({ storeId, drink }) =>
      localStorage.setItem(
        `pos-ticket:${storeId}`,
        JSON.stringify({
          lines: [
            { key: "kept-1", itemId: drink.id, name: "Nome antigo", photoUrl: null, unitPrice: 0.5, addons: [], notes: "", quantity: 2 },
            { key: "kept-2", itemId: "item-que-saiu", name: "Saiu do cardápio", photoUrl: null, unitPrice: 9, addons: [], notes: "", quantity: 1 },
          ],
          customerName: "Antes",
          customerPhone: "",
          savedAt: Date.now(),
        })
      ),
    { storeId, drink }
  );
  await page.reload();
  await expect(page.getByText("Comanda recuperada")).toBeVisible();
  await expect(page.getByText(/1 saiu/)).toBeVisible();
  const ticket = page.getByRole("complementary", { name: "Comanda" });
  await expect(ticket.getByRole("button", { name: new RegExp(`^Editar ${drink.name}`) })).toBeVisible();
  await expect(ticket.getByText("Nome antigo")).toHaveCount(0);
  await expect(ticket.getByText(new RegExp(`2 × R\\$\\s?${drink.price.toFixed(2).replace(".", ",")}`))).toBeVisible();

  // Signing out: the customer's name and phone don't stay on the device.
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/app\/login/, { timeout: 15_000 });
  expect(await page.evaluate((id) => localStorage.getItem(`pos-ticket:${id}`), storeId)).toBeNull();
});
