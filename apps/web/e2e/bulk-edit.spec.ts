import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";
import { API_URL } from "../playwright.config";

test("bulk edit: raise prices by % with rounding, and a concurrent change is caught", async ({ page }) => {
  const store = await createStoreViaApi(page, "Reajuste");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  const carne = await api.post(`/categories/${category.id}/items`, { name: "Pastel de carne", price: 12 });
  await api.post(`/categories/${category.id}/items`, { name: "Pastel de queijo", price: 11 });

  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}/items`);
  await expect(page.getByRole("row", { name: /Pastel de carne/ })).toBeVisible();

  // +10%, ending in ,90: 12 → 13,20 → 13,90 and 11 → 12,10 → 12,90.
  await page.getByRole("checkbox", { name: /selecionar todos/i }).check();
  await page.getByRole("button", { name: "Editar selecionados" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar 2 itens" });
  await dialog.getByRole("button", { name: "Aplicar a 2 itens" }).click();
  await expect(dialog.getByText("Escolha o que mudar")).toBeVisible();

  await dialog.getByRole("combobox", { name: "Como mudar o preço" }).click();
  await page.getByRole("option", { name: "Aumentar" }).click();
  await dialog.getByLabel("Aumentar em").fill("10");
  await dialog.getByRole("combobox", { name: "Arredondar" }).click();
  await page.getByRole("option", { name: "Terminar em ,90" }).click();

  const previewList = dialog.getByRole("region", { name: "Prévia" });
  await expect(previewList.getByRole("listitem").filter({ hasText: "Pastel de carne" })).toContainText("R$ 13,90");
  await expect(previewList.getByRole("listitem").filter({ hasText: "Pastel de queijo" })).toContainText("R$ 12,90");
  await dialog.getByRole("button", { name: "Aplicar a 2 itens" }).click();

  await expect(page.getByText("2 itens atualizados")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row", { name: /Pastel de carne/ })).toContainText("R$ 13,90");
  await expect(page.getByRole("row", { name: /Pastel de queijo/ })).toContainText("R$ 12,90");

  // Someone else edits a price while the dialog is open: nothing is saved.
  await page.getByRole("checkbox", { name: /selecionar todos/i }).check();
  await page.getByRole("button", { name: "Editar selecionados" }).click();
  await dialog.getByRole("combobox", { name: "Disponibilidade" }).click();
  await page.getByRole("option", { name: "Esgotado" }).click();
  const edit = await page.request.put(`${API_URL}/api/v1/stores/${store.id}/items/${carne.id}`, {
    data: { price: 20 },
  });
  expect(edit.ok()).toBeTruthy();
  await dialog.getByRole("button", { name: "Aplicar a 2 itens" }).click();
  await expect(dialog.getByText("Alguns itens mudaram enquanto você editava")).toBeVisible();

  // The preview follows the fresh values; applying again works.
  await expect(previewList.getByRole("listitem").filter({ hasText: "Pastel de carne" })).toContainText("R$ 20,00");
  await dialog.getByRole("button", { name: "Aplicar a 2 itens" }).click();
  await expect(page.getByText("2 itens atualizados")).toBeVisible();
  await expect(page.getByRole("row", { name: /Pastel de carne/ })).toContainText("R$ 20,00");
});
