import path from "node:path";
import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";
import { API_URL } from "../playwright.config";

/** Any real photo works: the form shrinks it to WebP before sending. */
const PHOTO = path.join(__dirname, "../public/login-marquee/pos-light.webp");

test("item photo: pick it when creating, see it, remove it when editing", async ({ page }) => {
  const store = await createStoreViaApi(page, "Fotos");
  const api = storeApi(page, store.id);
  await api.post("/categories", { name: "Pastéis" });
  const base = `${API_URL}/api/v1/stores/${store.id}`;
  const itemNamed = async (name: string) => {
    const items = (await (await page.request.get(`${base}/items?perPage=50`)).json()).data as {
      id: string;
      name: string;
      photoUrl: string | null;
    }[];
    return items.find((item) => item.name === name)!;
  };

  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}/items`, { timeout: 30_000 });
  await page.getByRole("button", { name: "Criar item" }).click();
  const create = page.getByRole("dialog", { name: "Criar novo item" });

  await create.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(create.getByText(/Nova foto pronta \(\d+ KB\)/)).toBeVisible();
  await expect(create.getByText("Nova", { exact: true })).toBeVisible();
  await create.getByLabel("Nome").fill("Pastel com foto");
  await create.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Pastéis" }).click();
  await create.getByLabel("Preço").fill("1500");
  await create.getByRole("button", { name: "Criar item" }).click();
  await expect(create).toBeHidden();

  const created = await itemNamed("Pastel com foto");
  expect(created.photoUrl).toMatch(/\/uploads\/items\/.+\.webp$/);
  const served = await page.request.get(created.photoUrl!);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toContain("image/webp");

  // Editing shows the saved photo; removing can be undone until saving.
  const row = page.getByRole("row", { name: /Pastel com foto/ });
  await row.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const edit = page.getByRole("dialog", { name: "Editar item" });
  await expect(edit.getByRole("img", { name: "Foto de Pastel com foto" })).toBeVisible();
  const undoAll = edit.getByRole("button", { name: "Desfazer alterações" });
  await expect(undoAll).toBeDisabled();
  await edit.getByRole("button", { name: "Remover foto" }).click();
  await expect(edit.getByText("A foto será removida ao salvar.")).toBeVisible();
  await expect(undoAll).toBeEnabled();
  await edit.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(edit.getByRole("img", { name: "Foto de Pastel com foto" })).toBeVisible();
  await edit.getByRole("button", { name: "Remover foto" }).click();
  await edit.getByRole("button", { name: "Salvar" }).click();
  await expect(edit).toBeHidden();

  const edited = await itemNamed("Pastel com foto");
  expect(edited.photoUrl).toBeNull();
  // The old file is gone from the disk too.
  expect((await page.request.get(created.photoUrl!)).status()).toBe(404);
});

test("add-on photo: picked in the panel, shown next to the option on the customer's menu", async ({ page }) => {
  const store = (await createStoreViaApi(page, "Adicionais")) as { id: string; name: string; slug: string };
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  await api.post(`/categories/${category.id}/items`, { name: "Pastel montado", price: 15 });

  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}/addons`, { timeout: 30_000 });
  await page.getByRole("button", { name: "Criar adicional" }).click();
  const create = page.getByRole("dialog", { name: "Criar novo adicional" });
  await create.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(create.getByText(/Nova foto pronta \(\d+ KB\)/)).toBeVisible();
  await create.getByLabel("Nome").fill("Bacon crocante");
  // R$ 0 (included in the price), like Orégano: it used to block the save.
  await create.getByLabel("Preço").fill("0");
  await create.getByRole("button", { name: /Criar/ }).last().click();
  await expect(create).toBeHidden();

  const addons = (await (await page.request.get(`${API_URL}/api/v1/stores/${store.id}/addons?perPage=50`)).json())
    .data as { id: string; name: string; photoUrl: string | null; photoBlur: string | null }[];
  const bacon = addons.find((addon) => addon.name === "Bacon crocante")!;
  expect(bacon.photoUrl).toMatch(/\/uploads\/addons\/.+\.webp$/);
  expect(bacon.photoBlur).toMatch(/^data:image\/webp;base64,/);

  // Offered with the item: the customer sees the photo next to the option.
  const items = (await (await page.request.get(`${API_URL}/api/v1/stores/${store.id}/items?perPage=50`)).json())
    .data as { id: string; name: string }[];
  const pastry = items.find((item) => item.name === "Pastel montado")!;
  await page.request.put(`${API_URL}/api/v1/stores/${store.id}/items/${pastry.id}`, { data: { addonIds: [bacon.id] } });

  await page.goto(`/${store.slug}`);
  await page.getByRole("button", { name: /Pastel montado/ }).first().click();
  const option = page.getByRole("dialog").locator("label").filter({ hasText: "Bacon crocante" });
  await expect(option.locator("img")).toHaveAttribute("src", /\/uploads\/addons\//);
  if (process.env.SHOTS) {
    await page.setViewportSize({ width: 430, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${process.env.SHOTS}/addon-photo.png` });
  }
});
