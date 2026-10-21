import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";

/** Items CRUD: category select, availability, filters kept in the URL. */
test("item edit, sold out and URL-persisted filters", async ({ page }) => {
  const store = await createStoreViaApi(page, "Tabela");
  const api = storeApi(page, store.id);
  const pastries = await api.post("/categories", { name: "Pastéis" });
  const drinks = await api.post("/categories", { name: "Bebidas" });
  await api.post(`/categories/${pastries.id}/items`, { name: "Pastel de carne", price: 12 });
  await api.post(`/categories/${drinks.id}/items`, { name: "Guaraná lata", price: 6 });

  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}/items`);
  const carne = page.getByRole("row", { name: /Pastel de carne/ });
  const guarana = page.getByRole("row", { name: /Guaraná lata/ });
  await expect(carne).toBeVisible();

  // The category select shows the name, not the id.
  await carne.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar item" });
  await expect(dialog.getByRole("combobox", { name: "Categoria" })).toHaveText(/Pastéis/);
  await dialog.getByRole("button", { name: "Cancelar" }).or(dialog.getByRole("button", { name: "Close" })).first().click();
  await expect(dialog).toBeHidden();

  // "Marcar esgotado" sends only isAvailable (used to fail: categoryId required).
  await carne.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("menuitem", { name: "Marcar esgotado" }).click();
  await expect(page.getByText("Pastel de carne marcado como esgotado")).toBeVisible();

  // Filter by name: lives in the URL and survives a reload.
  await page.getByRole("button", { name: "Filtrar por nome" }).click();
  await page.getByPlaceholder("Digite para filtrar...").fill("carne");
  await page.getByRole("button", { name: "Aplicar filtro" }).click();
  await expect(page).toHaveURL(/f\.name=carne/);
  await expect(guarana).toBeHidden();
  await page.reload();
  await expect(carne).toBeVisible();
  await expect(guarana).toBeHidden();
  await expect(page.getByRole("button", { name: "Filtrar por nome" })).toContainText("carne");

  await page.getByRole("button", { name: "Limpar" }).click();
  await expect(page).not.toHaveURL(/f\.name/);
  await expect(guarana).toBeVisible();

  // The category's item list links to Items already filtered by it.
  await page.goto(`/app/stores/${store.id}/categories`);
  await page.getByRole("row", { name: /Bebidas/ }).getByRole("button", { name: /1 Item/ }).click();
  const list = page.getByRole("dialog", { name: "Bebidas" });
  await expect(list.getByText("Guaraná lata")).toBeVisible();
  await list.getByRole("link", { name: /Abrir em Itens/ }).click();
  await expect(page).toHaveURL(/f\.category\.name%5B%5D=Bebidas|f\.category\.name\[\]=Bebidas/);
  await expect(page.getByRole("row", { name: /Guaraná lata/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Pastel de carne/ })).toBeHidden();
});
