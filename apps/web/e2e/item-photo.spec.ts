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
