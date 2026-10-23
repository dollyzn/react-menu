import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";
import { API_URL } from "../playwright.config";

test("the POS shows what's left, stops at the stock, and a quick count changes it", async ({ page }) => {
  // A store that tracks stock: 2 eggs, one egg per egg pastry.
  const store = await createStoreViaApi(page, "Ovos");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  const pastel = await api.post(`/categories/${category.id}/items`, { name: "Pastel de ovo", price: 10 });
  const ovo = await api.post("/ingredients", { name: "Ovo", unit: "un", stockQuantity: 2 });
  const base = `${API_URL}/api/v1/stores/${store.id}`;
  const current = (await (await page.request.get(base)).json()).data;
  const enable = await page.request.put(base, {
    data: { name: current.name, slug: current.slug, inventoryEnabled: true },
  });
  expect(enable.ok(), await enable.text()).toBeTruthy();
  expect(
    (
      await page.request.put(`${base}/items/${pastel.id}/recipe`, {
        data: { ingredients: [{ ingredientId: ovo.id, quantity: 1 }] },
      })
    ).ok()
  ).toBeTruthy();

  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}/pos`, { timeout: 30_000 });

  const product = page.getByRole("button", { name: /^Pastel de ovo/ });
  await expect(product).toHaveAccessibleName(/restam 2/);
  await product.click();
  await product.click();
  // Both eggs are on the ticket: no more of it, here or with the ticket's +.
  await expect(product).toBeDisabled();
  await expect(page.getByRole("button", { name: "Aumentar Pastel de ovo" }).first()).toBeDisabled();

  // "Papai disse que só tem 1 ovo": a quick count on the stock screen.
  await page.goto(`/app/stores/${store.id}/inventory`);
  await page.getByRole("button", { name: "Contar: Ovo" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Contagem de estoque" });
  await dialog.getByRole("group", { name: "Valores rápidos" }).getByRole("button", { name: "1", exact: true }).click();
  await expect(dialog.getByText(/Fica:/)).toContainText("1");
  await dialog.getByRole("button", { name: "Salvar contagem" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/app/stores/${store.id}/pos`);
  await expect(page.getByRole("button", { name: /^Pastel de ovo/ })).toHaveAccessibleName(/última unidade/);
});
