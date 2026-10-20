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

test("reorder categories with the keyboard on the store page", async ({ page }) => {
  const store = await createStoreViaApi(page, "Ordem");
  const api = storeApi(page, store.id);
  for (const name of ["Primeira", "Segunda", "Terceira"]) {
    await api.post("/categories", { name });
  }
  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}`);

  const reorderResponse = page.waitForResponse(
    (res) => res.url().endsWith("/categories/order") && res.request().method() === "PUT"
  );
  const handle = page.getByRole("button", { name: "Reordenar Primeira" });
  await handle.focus();
  // dnd-kit measures positions between key presses, like a real keyboard user.
  for (const key of ["Space", "ArrowDown", "ArrowDown", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
  expect((await reorderResponse).ok()).toBeTruthy();

  const rows = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Reordenar / }) });
  await expect(rows).toHaveText([/Segunda/, /Terceira/, /Primeira/]);

  await page.reload();
  await expect(rows).toHaveText([/Segunda/, /Terceira/, /Primeira/]);
});
