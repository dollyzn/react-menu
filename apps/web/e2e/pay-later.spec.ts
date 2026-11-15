import { test, expect, login, DEMO_STAFF } from "./fixtures";

test("pagar depois: sent as fiado, handed over unpaid, received later from the managers' list", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const customer = `Fiado ${Date.now() % 100000}`;

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
  await asking.getByLabel("Celular com DDD").fill("13988887777");
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

  // The manager follows it in "Pagar depois" and receives it another day.
  const managerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const manager = await managerContext.newPage();
  await login(manager);
  await manager.goto(page.url());
  await manager.getByRole("tab", { name: /Pagar depois/ }).click();
  // The store's table, as cards by default; the summary says who owes what.
  await expect(manager.getByRole("list", { name: "Quanto cada cliente deve" })).toContainText(customer);
  const owed = manager.getByRole("article", { name: new RegExp(`^Pedido ${number} de ${customer}: R\\$`) });
  await expect(owed).toContainText("(13) 98888-7777");
  await expect(owed.getByRole("link", { name: `WhatsApp de ${customer}` })).toHaveAttribute("href", "https://wa.me/5513988887777");
  // Searching (on the API, kept in the URL) by another phone hides it; by its own, it is back.
  const search = async (text: string) => {
    await manager.getByText("Cliente, telefone ou número").first().click();
    await manager.getByPlaceholder("Digite para filtrar...").fill(text);
    await manager.getByPlaceholder("Digite para filtrar...").press("Enter");
    await manager.keyboard.press("Escape");
  };
  await search("00000000");
  await expect(owed).toBeHidden();
  await expect(manager).toHaveURL(/00000000/);
  await search("98888");
  await expect(owed).toBeVisible();
  await owed.getByRole("button", { name: `Receber o pedido #${number}` }).click();
  const receive = manager.getByRole("dialog");
  await receive.getByRole("button", { name: /^Pix/ }).click();
  await receive.getByRole("button", { name: /Receber · Pix/ }).click();
  await expect(manager.getByText(`Pedido #${number}: pagamento recebido`)).toBeVisible();
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
