import { test, expect, login, apiSignIn, DEMO_STAFF } from "./fixtures";
import { request as playwrightRequest } from "@playwright/test";
import { API_URL, E2E_ADMIN } from "../playwright.config";

test("pagar depois: sent as fiado, handed over unpaid, received later from the managers' list", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const customer = `Fiado ${Date.now() % 100000}`;
  // Its own phone: customers are grouped by it.
  const local = `9${String(Date.now()).slice(-8)}`;
  const shownPhone = `(13) ${local.slice(0, 5)}-${local.slice(5)}`;

  // The attendant sends it as "pagar depois": the dialog asks the phone.
  await login(page, DEMO_STAFF.attendant);
  await page.getByRole("link", { name: "Novo pedido" }).first().click();
  await expect(page).toHaveURL(/\/pos$/);
  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
  await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
  await page.getByLabel("Nome do cliente").fill(customer);
  // One "Enviar e receber depois": the dialog asks when, like the other methods.
  await page.getByRole("button", { name: "Enviar e receber depois" }).click();
  const asking = page.getByRole("dialog", { name: "Enviar sem receber agora" });
  await expect(asking.getByRole("button", { name: "Escolha quando o cliente paga" })).toBeDisabled();
  await asking.getByRole("button", { name: /^Pagar depois \(fiado\)/ }).click();
  // The name comes from the ticket; the phone is required.
  await expect(asking.getByLabel("Quem vai pagar")).toHaveValue(customer);
  await asking.getByRole("button", { name: "Enviar para pagar depois" }).click();
  await expect(asking.getByText("Informe o celular com DDD.")).toBeVisible();
  await asking.getByLabel("Celular com DDD").fill(`13${local}`);
  await asking.getByRole("button", { name: "Enviar para pagar depois" }).click();
  const toastText = await page.getByText(/Pedido #\d+ enviado · pagar depois/).textContent();
  const number = toastText!.match(/#(\d+)/)![1];

  // On the board it says so, and "Entregar" hands it over without receiving.
  await page.goto(page.url().replace(/\/pos$/, "/orders"));
  const card = page.getByRole("article", { name: `Pedido ${number} de ${customer}` });
  await expect(card.getByText("Pagar depois").first()).toBeVisible();
  await card.getByRole("button", { name: "Entregar" }).click();
  // Drinks only: "Separou tudo?", never the payment methods.
  const check = page.getByRole("alertdialog");
  await expect(check).toContainText(`Separou tudo do pedido #${number}?`);
  await check.getByRole("button", { name: "Sim, entregar" }).click();
  await expect(page.getByText(`Pedido #${number} entregue`)).toBeVisible();
  await expect(card).toBeHidden();
  // The attendant has no "Pagar depois" list.
  await expect(page.getByRole("tab", { name: /Pagar depois/ })).toHaveCount(0);

  // A second one for the same customer, another day (from the API).
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const drink = menu.categories
    .flatMap((category: { items: { id: string; name: string }[] }) => category.items)
    .find((item: { name: string }) => /^Coca-Cola/.test(item.name));
  const second = await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
    data: { customer: { name: customer, phone: `13${local}` }, lines: [{ itemId: drink.id, quantity: 2 }], payLater: true },
  });
  expect(second.ok()).toBeTruthy();
  const secondNumber = (await second.json()).data.number as number;
  await api.dispose();

  // The manager follows them in "Pagar depois", by customer, and receives both at once.
  const managerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const manager = await managerContext.newPage();
  await login(manager);
  await manager.goto(page.url());
  await manager.getByRole("tab", { name: /Pagar depois/ }).click();
  const owed = manager.getByRole("article", { name: new RegExp(`^${customer}: R\\$`) });
  await expect(owed).toContainText(shownPhone);
  await expect(owed).toContainText("2 pedidos");
  const orders = owed.getByRole("list", { name: `Pedidos de ${customer}` });
  await expect(orders).toContainText(`#${number}`);
  await expect(orders).toContainText(`#${secondNumber}`);
  // WhatsApp opens with the charge written: the total and the orders.
  await expect(owed.getByRole("link", { name: `Cobrar ${customer} no WhatsApp` })).toHaveAttribute(
    "href",
    new RegExp(`^https://wa\\.me/55${13}${local}\\?text=.*%23${number}`)
  );
  // Searching by another phone hides them; by theirs, they are back.
  const search = manager.getByRole("searchbox", { name: "Buscar cliente, telefone ou número do pedido" });
  await search.fill("00000000");
  await expect(owed).toBeHidden();
  await search.fill(local.slice(0, 5));
  await expect(owed).toBeVisible();

  // Ticking one changes the button to that one's amount; "Limpar" undoes it.
  await orders.getByRole("checkbox", { name: new RegExp(`^Pedido #${number},`) }).click();
  await expect(owed.getByRole("button", { name: /^Receber 1 · R\$/ })).toBeVisible();
  await owed.getByRole("button", { name: "Limpar" }).click();

  // "Por pedido" is still there: every open order, one by one.
  await manager.getByRole("button", { name: "Por pedido" }).click();
  await expect(manager.getByRole("searchbox", { name: "Buscar por cliente, telefone ou número" })).toBeVisible();
  await manager.getByRole("button", { name: "Por cliente" }).click();
  await manager.getByRole("searchbox", { name: "Buscar cliente, telefone ou número do pedido" }).fill(local.slice(0, 5));

  // "Receber tudo": one amount, one way of paying, both paid.
  await owed.getByRole("button", { name: /^Receber tudo · R\$/ }).click();
  const receive = manager.getByRole("dialog", { name: `Receber 2 pedidos de ${customer}` });
  await expect(receive).toContainText(`#${number}, #${secondNumber}`);
  await expect(receive.getByRole("button", { name: /maquininha/i })).toHaveCount(0);
  await receive.getByRole("button", { name: /^Pix/ }).click();
  await receive.getByRole("button", { name: /Receber · Pix/ }).click();
  await expect(manager.getByText(new RegExp(`${customer}: R\\$.* recebidos no Pix \\(2 pedidos\\)`))).toBeVisible();
  await expect(owed).toBeHidden();

  await managerContext.close();
});

test("pagar depois: an order sent as \"receber depois\" becomes fiado from the card's menu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const customer = `Depois ${Date.now() % 100000}`;
  await login(page, DEMO_STAFF.attendant);
  await page.getByRole("link", { name: "Novo pedido" }).first().click();
  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
  await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
  await page.getByLabel("Nome do cliente").fill(customer);
  await page.getByRole("button", { name: "Enviar e receber depois" }).click();
  await page.getByRole("button", { name: /^Receber na retirada/ }).click();
  await page.getByRole("button", { name: "Enviar · receber na retirada" }).click();
  const toastText = await page.getByText(/Pedido #\d+ enviado · receber depois/).textContent();
  const number = toastText!.match(/#(\d+)/)![1];

  await page.goto(page.url().replace(/\/pos$/, "/orders"));
  const card = page.getByRole("article", { name: `Pedido ${number} de ${customer}` });
  await card.getByRole("button", { name: `Mais ações do pedido ${number}` }).click();
  await page.getByRole("menuitem", { name: "Pagar depois (fiado)" }).click();
  const asking = page.getByRole("dialog", { name: "Pagar depois" });
  await asking.getByLabel("Celular com DDD").fill("13977776666");
  await asking.getByRole("button", { name: "Deixar para pagar depois" }).click();
  await expect(page.getByText(`Pedido #${number} fica para pagar depois`)).toBeVisible();
  await expect(card.getByText("Pagar depois").first()).toBeVisible();

  // Now it goes without receiving.
  await card.getByRole("button", { name: "Entregar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sim, entregar" }).click();
  await expect(page.getByText(`Pedido #${number} entregue`)).toBeVisible();
});

test("pagar depois: who to charge comes from the store's customers, like the ticket", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const regular = `Cliente fiel ${Date.now() % 100000}`;
  // A customer the store already knows (an earlier order with a phone), from
  // its own API session (the page signs in as the attendant).
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(api, E2E_ADMIN);
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const drink = menu.categories
    .flatMap((category: { items: { id: string; name: string }[] }) => category.items)
    .find((item: { name: string }) => /^Coca-Cola/.test(item.name));
  const known = await api.post(`/api/v1/stores/${menu.store.id}/orders`, {
    data: { customer: { name: regular, phone: "13955554444" }, lines: [{ itemId: drink.id, quantity: 1 }], counterMethod: "cash" },
  });
  expect(known.ok()).toBeTruthy();
  await api.dispose();

  await login(page, DEMO_STAFF.attendant);
  await page.getByRole("link", { name: "Novo pedido" }).first().click();
  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
  await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
  await page.getByRole("button", { name: "Enviar e receber depois" }).click();
  const asking = page.getByRole("dialog", { name: "Enviar sem receber agora" });
  await asking.getByRole("button", { name: /^Pagar depois \(fiado\)/ }).click();
  await asking.getByLabel("Quem vai pagar").fill(regular.slice(0, 12));
  await asking.getByRole("option", { name: new RegExp(regular) }).click();
  await expect(asking.getByLabel("Quem vai pagar")).toHaveValue(regular);
  await expect(asking.getByLabel("Celular com DDD")).toHaveValue("(13) 95555-4444");
  // Editing the name away drops the phone the pick filled.
  await asking.getByLabel("Quem vai pagar").fill("Outra pessoa");
  await expect(asking.getByLabel("Celular com DDD")).toHaveValue("");
  await asking.getByRole("button", { name: "Voltar" }).click();
});
