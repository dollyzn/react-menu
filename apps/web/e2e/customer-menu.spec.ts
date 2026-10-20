import { test, expect } from "./fixtures";

/** The demo seed makes JJ Pastéis the default store (served at "/"). */
test.describe("Customer menu", () => {
  test("browse, customize a pastry, check out and track the order", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "JJ Pastéis", level: 1 })).toBeVisible();
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
    await page.screenshot({ path: "test-results/menu-checkout.png", caret: "initial" });
    await page.getByRole("button", { name: "Fazer pedido" }).click();

    await expect(page).toHaveURL(/\/pedido\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Recebemos seu pedido!" })).toBeVisible();
    await expect(page.getByText("2× Pastel de Carne com Queijo", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/order-tracking.png", fullPage: true, caret: "initial" });

    // The device remembers the customer and the order.
    await page.goto("/");
    await page.getByRole("button", { name: "Meus pedidos" }).click();
    await expect(page.getByRole("dialog").getByText("JJ Pastéis")).toBeVisible();
  });
});
