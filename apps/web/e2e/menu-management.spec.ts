import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";

test.describe("Menu management", () => {
  test("create and delete a category", async ({ page }) => {
    const store = await createStoreViaApi(page, "Categorias");
    await page.context().clearCookies();
    await login(page);
    await page.goto(`/app/stores/${store.id}/categories`);

    await page.getByRole("button", { name: "Criar categoria" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Bebidas");
    await dialog.getByRole("button", { name: "Criar Categoria" }).click();
    await expect(dialog).toBeHidden();
    const row = page.getByRole("row", { name: /Bebidas/ });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("menuitem", { name: "Excluir" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
    await expect(row).toBeHidden();
  });

  test("bulk delete items", async ({ page }) => {
    const store = await createStoreViaApi(page, "Itens");
    const api = storeApi(page, store.id);
    const category = await api.post("/categories", { name: "Pastéis" });
    await api.post(`/categories/${category.id}/items`, { name: "Pastel de carne", price: 12 });
    await api.post(`/categories/${category.id}/items`, { name: "Pastel de queijo", price: 11 });

    await page.context().clearCookies();
    await login(page);
    await page.goto(`/app/stores/${store.id}/items`);
    await expect(page.getByRole("row", { name: /Pastel de carne/ })).toBeVisible();

    await page.getByRole("checkbox", { name: /selecionar todos/i }).check();
    await page.getByRole("button", { name: "Excluir selecionados" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();

    await expect(page.getByText("Nenhum registro encontrado")).toBeVisible();
  });
});
