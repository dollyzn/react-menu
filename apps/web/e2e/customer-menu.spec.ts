import { test, expect } from "./fixtures";

/** The demo seed makes JJ Pastéis the default store (served at "/"). */
test.describe("Customer menu", () => {
  test("browse, customize a pastry, check out and track the order", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "JJ Pastéis", level: 1 })).toBeVisible();
    // Banner and logo come from the seed, stored on the API's Drive disk.
    for (const image of await page.locator('section[aria-labelledby="store-name"] img').all()) {
      await expect(image).toHaveAttribute("src", /\/uploads\/(banners|photos)\//);
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
    await page.screenshot({ path: "test-results/menu-home.png", fullPage: false, caret: "initial" });

    await page.getByRole("searchbox", { name: "Buscar no cardápio" }).fill("carne com queijo");
    const card = page.getByRole("button", { name: /Pastel de Carne com Queijo/ });
    await expect(card).toBeVisible();
    await card.click();

    const detail = page.getByRole("dialog");
    await detail.getByText("Catupiry Extra").click();
    await detail.getByRole("textbox", { name: /observação/i }).fill("bem passado");
    await detail.getByRole("button", { name: "Aumentar quantidade" }).click();
    await page.screenshot({ path: "test-results/menu-item-detail.png", caret: "initial" });
    await detail.getByRole("button", { name: /Adicionar/ }).click();

    // (18 + 3) × 2
    const bagButton = page.getByRole("button", { name: /Ver sacola/ });
    await expect(bagButton).toContainText("42,00");
    await bagButton.click();
    await page.screenshot({ path: "test-results/menu-bag.png", caret: "initial" });
    await page.getByRole("button", { name: "Continuar" }).click();

    await page.getByLabel("Seu nome").fill("Ana Cliente");
    await page.getByLabel("Celular (WhatsApp)").fill("11987654321");
    await expect(page.getByLabel("Celular (WhatsApp)")).toHaveValue("(11) 98765-4321");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Review step: who picks up, what was ordered, how to pay.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Ana Cliente")).toBeVisible();
    await expect(dialog.getByText("Como você prefere pagar?")).toBeVisible();
    await page.screenshot({ path: "test-results/menu-checkout.png", caret: "initial" });
    await page.getByRole("button", { name: /Fazer pedido/ }).click();

    await expect(page).toHaveURL(/\/pedido\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Recebemos seu pedido!" })).toBeVisible();
    await expect(page.getByText("2× Pastel de Carne com Queijo", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/order-tracking.png", fullPage: true, caret: "initial" });

    // The device remembers the order: "Meus pedidos" shows it in progress.
    await page.goto("/");
    await page.getByRole("link", { name: /Meus pedidos/ }).click();
    await expect(page).toHaveURL(/\/pedidos$/);
    await expect(page.getByRole("heading", { name: "Em andamento" })).toBeVisible();
    await expect(page.getByRole("article", { name: /Na fila da cozinha/ })).toBeVisible();
    await page.screenshot({ path: "test-results/order-history.png", fullPage: true, caret: "initial" });

    // A returning customer skips the details step.
    await page.goto("/");
    await page.getByRole("button", { name: /^Pastel de Carne, R\$/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
    await page.getByRole("button", { name: /Ver sacola/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("dialog").getByText("Como você prefere pagar?")).toBeVisible();
  });

  test("scrolling down the menu is never pulled back up", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "JJ Pastéis", level: 1 })).toBeVisible();
    await page.mouse.move(400, 400);

    // Each step crosses categories, which moves the active chip in the nav.
    const positions: number[] = [];
    for (let step = 0; step < 12; step++) {
      await page.mouse.wheel(0, 250);
      await page.waitForTimeout(150);
      positions.push(await page.evaluate(() => window.scrollY));
    }
    await page.waitForTimeout(600);
    positions.push(await page.evaluate(() => window.scrollY));

    for (let i = 1; i < positions.length; i++) {
      expect(positions[i], `scroll positions ${positions.join(", ")}`).toBeGreaterThanOrEqual(positions[i - 1]);
    }
    expect(positions.at(-1)).toBeGreaterThan(1000);
  });

  test("on a phone, the bag opens right after adding (no toast in the way)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const phone = await context.newPage();
    await phone.goto("/");
    await phone.getByRole("button", { name: /^Pastel de Queijo, R\$/ }).first().click();
    await phone.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
    await phone.getByRole("button", { name: /Ver sacola/ }).click({ timeout: 5000 });
    await expect(phone.getByRole("button", { name: "Continuar" })).toBeVisible();
    await context.close();
  });

  test("header icons come in the server HTML (nothing pops in after F5)", async ({ page }) => {
    const html = await (await page.request.get("/")).text();
    expect(html).toContain('aria-label="Alternar tema"');
    expect(html).toContain('aria-label="Meus pedidos"');
  });
});
