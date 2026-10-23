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
  // The ticket's + doesn't just go dead: it says why.
  const more = page.getByRole("button", { name: "Aumentar Pastel de ovo" }).first();
  await expect(more).toHaveAttribute("aria-disabled", "true");
  // aria-disabled reads as unavailable but still answers a click (Playwright waits on it).
  await more.click({ force: true });
  await expect(page.getByText("Só tem 2 Pastel de ovo no estoque: a comanda já tem todas.")).toBeVisible();

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

test("the customer asking for more than the stock is told why the counter stops", async ({ page }) => {
  // 6 in stock (above the "Restam N" warning), the customer wants 7.
  const store = await createStoreViaApi(page, "Seis");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  const pastel = await api.post(`/categories/${category.id}/items`, { name: "Pastel de ovo", price: 10 });
  const ovo = await api.post("/ingredients", { name: "Ovo", unit: "un", stockQuantity: 6 });
  const base = `${API_URL}/api/v1/stores/${store.id}`;
  const current = (await (await page.request.get(base)).json()).data;
  await page.request.put(base, { data: { name: current.name, slug: current.slug, inventoryEnabled: true } });
  await page.request.put(`${base}/items/${pastel.id}/recipe`, {
    data: { ingredients: [{ ingredientId: ovo.id, quantity: 1 }] },
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${current.slug}`, { timeout: 30_000 });
  await page.getByRole("button", { name: /^Pastel de ovo/ }).click();
  const dialog = page.getByRole("dialog");
  const more = dialog.getByRole("button", { name: "Aumentar quantidade" });
  for (let i = 1; i < 6; i++) await more.click();
  await expect(dialog.getByRole("status").filter({ hasText: "Só temos 6 disponíveis agora" })).toBeVisible();
  await expect(more).toHaveAttribute("aria-disabled", "true");
  await more.click({ force: true });
  // The message's shake never scrolls the window sideways (sampled while it moves).
  let widest = 0;
  for (let i = 0; i < 20; i++) {
    widest = Math.max(
      widest,
      await dialog.evaluate((root) =>
        Math.max(
          0,
          ...[root, ...root.querySelectorAll("*")]
            .filter((el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowX))
            .map((el) => el.scrollWidth - el.clientWidth)
        )
      )
    );
    await page.waitForTimeout(20);
  }
  expect(widest).toBeLessThanOrEqual(1);
  await expect(dialog.getByText("6", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
