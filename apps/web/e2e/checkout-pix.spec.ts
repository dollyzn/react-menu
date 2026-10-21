import { test, expect } from "./fixtures";

/**
 * In-app checkout with Pix, through the development fake gateway
 * (PAYMENTS_FAKE_GATEWAY in playwright.config): no redirect, the QR code is
 * shown on the order page and the payment confirms it in realtime.
 */
test("Pix checkout: QR code on the order page, approval sends it to the kitchen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Pastel de Carne, R\$/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  await page.getByRole("button", { name: /Ver sacola/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill("Pix Teste");
  await page.getByLabel("Celular (WhatsApp)").fill("11933334444");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Online methods come first; the store also takes cash at the counter.
  await expect(page.getByRole("radio", { name: /^Pix/ })).toBeChecked();
  await page.getByRole("button", { name: /Fazer pedido/ }).click();

  await expect(page).toHaveURL(/\/pedido\//);
  await expect(page.getByRole("heading", { name: "Falta pagar" })).toBeVisible();
  const payment = page.getByRole("region", { name: "Pagamento" });
  await payment.getByLabel("Seu e-mail").fill("pix@example.com");
  await payment.getByRole("button", { name: "Gerar Pix" }).click();

  await expect(payment.getByRole("img", { name: "QR Code do Pix" })).toBeVisible();
  await expect(payment.getByText(/FAKE-PIX/)).toBeVisible();
  await expect(payment.getByText(/Expira em \d{2}:\d{2}/)).toBeVisible();

  // A reload shows the same Pix (not a new charge).
  const code = await payment.locator("code").textContent();
  await page.reload();
  await expect(page.getByRole("region", { name: "Pagamento" }).locator("code")).toHaveText(code!);

  await page.getByRole("button", { name: /Simular pagamento aprovado/ }).click();
  await expect(page.getByRole("heading", { name: "Recebemos seu pedido!" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pagamento" })).toHaveCount(0);
  await expect(page.getByText("Pago online com Pix")).toBeVisible();
});
