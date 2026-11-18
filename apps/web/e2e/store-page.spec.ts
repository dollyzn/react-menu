import { test, expect, createStoreViaApi, storeApi } from "./fixtures";
import { API_URL } from "../playwright.config";

test("the store page: profile and operation saved from their tabs, menu order side by side", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const store = await createStoreViaApi(page, "Abas");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  await api.post(`/categories/${category.id}/items`, { name: "Pastel de carne", price: 12 });
  const read = async () => (await (await page.request.get(`${API_URL}/api/v1/stores/${store.id}`)).json()).data;

  await page.goto(`/app/stores/${store.id}`);
  await expect(page.getByRole("tab", { name: "Perfil" })).toHaveAttribute("aria-selected", "true");

  // Perfil: the basic information, right on the page.
  const save = page.getByRole("button", { name: "Salvar", exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel("Descrição").fill("Pastéis feitos na hora.");
  await page.getByLabel("Telefone").fill("13991234567");
  await expect(page.getByLabel("Telefone")).toHaveValue("(13) 99123-4567");
  await page.getByLabel("Instagram").fill("https://example.com/loja");
  await save.click();
  await expect(page.getByText(/Cole o link do perfil/)).toBeVisible();
  await page.getByLabel("Instagram").fill("https://www.instagram.com/abas");
  await save.click();
  await expect(page.getByText("Informações da loja salvas")).toBeVisible();
  await expect(save).toBeDisabled();
  const profile = await read();
  expect([profile.description, profile.phone, profile.instagramUrl]).toEqual([
    "Pastéis feitos na hora.",
    "13991234567",
    "https://www.instagram.com/abas",
  ]);

  // Funcionamento: how orders flow, in its own card (kept in the URL).
  await page.getByRole("tab", { name: "Funcionamento" }).click();
  await expect(page).toHaveURL(/aba=funcionamento/);
  const operation = page.getByText("Pedidos e cozinha").locator("xpath=ancestor::*[@data-slot='card']");
  await operation.getByRole("button", { name: "Aumentar minutos de retirada" }).click();
  await operation.getByRole("switch", { name: "Controlar estoque" }).click();
  await operation.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Operação da loja salva")).toBeVisible();
  const saved = await read();
  expect([saved.pickupEtaMinutes, saved.inventoryEnabled]).toEqual([profile.pickupEtaMinutes + 1, !profile.inventoryEnabled]);

  // Cardápio: categories and their products side by side on a wide screen.
  await page.getByRole("tab", { name: "Cardápio" }).click();
  await page.getByRole("button", { name: /^Pastéis/ }).click();
  await expect(page.getByText("Produtos de Pastéis")).toBeVisible();
  await expect(page.getByText("Pastel de carne")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pastéis/ })).toBeVisible();

  // A reload keeps the tab.
  await page.reload();
  await expect(page.getByRole("tab", { name: "Cardápio" })).toHaveAttribute("aria-selected", "true");
});

test("the store page fits a phone: tabs scroll sideways, a category opens in place", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  const store = await createStoreViaApi(page, "Celular");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Bebidas" });
  await api.post(`/categories/${category.id}/items`, { name: "Caldo de cana", price: 8 });

  await page.goto(`/app/stores/${store.id}?aba=cardapio`);
  await expect(page.getByRole("tab", { name: "Pagamentos" })).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: /^Bebidas/ }).click();
  await expect(page.getByText("Caldo de cana")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Bebidas/ })).toBeHidden();
  await page.getByRole("button", { name: "Voltar às categorias" }).click();
  await expect(page.getByRole("button", { name: /^Bebidas/ })).toBeVisible();
});
