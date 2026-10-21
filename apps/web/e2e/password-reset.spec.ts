import { test, expect } from "./fixtures";

test("forgot password: from the login to the e-mail notice", async ({ page }) => {
  await page.goto("/app/login");
  await page.getByRole("link", { name: "Esqueceu a senha?" }).click();
  await expect(page).toHaveURL(/\/app\/esqueci-minha-senha$/);

  await page.getByLabel("E-mail").fill("quem-sabe@example.com");
  await page.getByRole("button", { name: "Enviar link" }).click();

  // Same answer whether or not the account exists.
  await expect(page.getByText("Confira seu e-mail")).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao login" }).click();
  await expect(page).toHaveURL(/\/app\/login$/);
});

test("reset password: an invalid link asks for a new one", async ({ page }) => {
  await page.goto("/app/redefinir-senha?token=link-que-nao-existe-1234567890");
  await page.getByLabel("Nova senha", { exact: true }).fill("nova-senha-123");
  await page.getByLabel("Repita a nova senha").fill("nova-senha-123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();

  await expect(page.getByText(/Este link expirou ou já foi usado/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Pedir novo link" })).toHaveAttribute(
    "href",
    "/app/esqueci-minha-senha"
  );
});
