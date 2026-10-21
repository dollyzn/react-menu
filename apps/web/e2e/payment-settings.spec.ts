import { test, expect, login } from "./fixtures";
import { API_URL } from "../playwright.config";

const TOKEN = "TEST-1234567890123456-102114-abcdefabcdefabcdef-123456789"; // gitleaks:allow (fake test credential)
const PUBLIC_KEY = "TEST-0b7c6a2e-3d4f-4a1b-9c8d-123456789abc";

test("Mercado Pago settings validate in the form and keep saved secrets", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const menu = await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json();
  await login(page);
  await page.goto(`/app/stores/${menu.data.store.id}`);

  await page.getByRole("button", { name: "Configurar" }).click();
  const dialog = page.getByRole("dialog", { name: "Mercado Pago" });

  // Empty and malformed values: messages under each field, nothing sent.
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog.getByText("Cole o Access Token: começa com APP_USR- ou TEST-.")).toBeVisible();
  await expect(dialog.getByText(/Cole a assinatura secreta do webhook/)).toBeVisible();
  await expect(dialog.getByLabel("Access Token")).toHaveAttribute("aria-invalid", "true");

  await dialog.getByLabel("Access Token").fill("token-errado");
  await dialog.getByLabel("Public Key (para cartão)").fill("chave-errada");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog.getByText(/A Public Key começa com APP_USR- ou TEST-/)).toBeVisible();

  await dialog.getByLabel("Access Token").fill(TOKEN);
  await dialog.getByLabel("Public Key (para cartão)").fill(PUBLIC_KEY);
  await dialog.getByLabel("Assinatura secreta do webhook").fill("assinatura-secreta");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Pagamentos online configurados")).toBeVisible();
  await expect(page.getByText("Cartão ativo")).toBeVisible();

  // Saved credentials stay when only the installments change.
  await page.getByRole("button", { name: "Trocar credenciais" }).click();
  await expect(dialog.getByLabel("Access Token")).toHaveAttribute("placeholder", /deixe em branco para manter/);
  await dialog.getByRole("combobox", { name: "Parcelamento no cartão" }).click();
  await page.getByRole("option", { name: "Até 3x" }).click();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Pagamentos online atualizados")).toBeVisible();

  // Back to the development gateway for the other tests.
  await page.getByRole("button", { name: "Trocar credenciais" }).click();
  await dialog.getByRole("button", { name: "Desligar pagamentos online" }).click();
  await expect(page.getByText("Pagamentos online desligados")).toBeVisible();
});
