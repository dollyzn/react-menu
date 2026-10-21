import { test, expect, login } from "./fixtures";

test.describe("Not found pages", () => {
  test("unknown URL shows the 404 page with a way back to the menu", async ({ page }) => {
    const response = await page.goto("/pagina/que/nao/existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();

    await page.getByRole("link", { name: "Ver o cardápio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("unknown store slug says the store was not found", async ({ page }) => {
    const response = await page.goto("/loja-que-nao-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Loja não encontrada" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o cardápio principal" })).toBeVisible();
  });

  test("unknown panel URL offers the way back to the panel", async ({ page }) => {
    await login(page);
    const storePath = new URL(page.url()).pathname.replace(/\/$/, "");

    const response = await page.goto(`${storePath}/secao-inexistente`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();

    await page.getByRole("link", { name: "Voltar ao painel" }).click();
    await expect(page).toHaveURL(/\/app\/stores/);
  });
});
