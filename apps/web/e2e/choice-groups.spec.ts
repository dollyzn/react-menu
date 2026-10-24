import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";
import { API_URL } from "../playwright.config";

test("a required choice group: created in the panel, chosen on the menu", async ({ page }) => {
  const store = await createStoreViaApi(page, "Escolhas");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  const pastel = await api.post(`/categories/${category.id}/items`, { name: "Pastel de carne", price: 12 });
  await api.post("/addons", { name: "Mussarela", price: 0 });
  await api.post("/addons", { name: "Cheddar", price: 2 });
  const base = `${API_URL}/api/v1/stores/${store.id}`;
  await page.request.patch(`${base}/status`, { data: { status: "open" } });
  const { slug } = (await (await page.request.get(base)).json()).data;

  // The manager creates "Escolha o queijo" (choose 1) from two add-ons.
  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}/option-groups`, { timeout: 30_000 });
  await page.getByRole("button", { name: "Criar grupo" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo grupo de escolha" });
  await dialog.getByLabel("Nome").fill("Escolha o queijo");
  const options = dialog.getByPlaceholder("Selecione os adicionais que viram opções");
  await options.click();
  await page.getByRole("option", { name: /Mussarela/ }).click();
  await page.getByRole("option", { name: /Cheddar/ }).click();
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Obrigatório · escolha 1")).toBeVisible();
  await dialog.getByRole("button", { name: "Criar grupo" }).click();
  await expect(dialog).toBeHidden();
  const card = page.getByRole("row", { name: /Escolha o queijo/ });
  await expect(card).toContainText("Obrigatório · escolha 1");
  await expect(card).toContainText("Mussarela incluso");
  await expect(card).toContainText("Cheddar + R$ 2,00");

  // Attached to the pastry.
  const groups = (await (await page.request.get(`${base}/option-groups`)).json()).data;
  await page.request.put(`${base}/items/${pastel.id}`, { data: { optionGroupIds: [groups[0].id] } });

  // The customer must choose before adding; the choice changes the price.
  await page.goto(`/${slug}`);
  await page.getByRole("button", { name: /^Pastel de carne/ }).click();
  const item = page.getByRole("dialog");
  const add = item.getByRole("button", { name: /^Adicionar/ });
  await expect(item.getByText("Escolha: Escolha o queijo")).toBeVisible();
  await expect(add).toBeDisabled();
  await item.getByText("Cheddar").click();
  await expect(item.getByText("Pronto")).toBeVisible();
  await expect(add).toBeEnabled();
  await expect(add).toContainText("R$ 14,00");
  await add.click();

  await page.getByRole("button", { name: /Ver sacola/ }).click();
  await expect(page.getByRole("dialog").getByText("+ Cheddar")).toBeVisible();
});
