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
  await expect(page.getByRole("dialog").getByText("+ Escolha o queijo: Cheddar")).toBeVisible();
});

test("an optional extra filling: priced in the group, closed on the menu, named on the order", async ({ page }) => {
  const store = await createStoreViaApi(page, "Recheios");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  const pastel = await api.post(`/categories/${category.id}/items`, { name: "Pastel de queijo", price: 12 });
  await api.post("/addons", { name: "Carne", price: 3 });
  await api.post("/addons", { name: "Frango", price: 3 });
  const base = `${API_URL}/api/v1/stores/${store.id}`;
  await page.request.patch(`${base}/status`, { data: { status: "open" } });
  const { slug } = (await (await page.request.get(base)).json()).data;

  // "Recheio extra": optional, up to 1, every filling at R$ 4 in this group.
  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}/option-groups`, { timeout: 30_000 });
  await page.getByRole("button", { name: "Criar grupo" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo grupo de escolha" });
  await dialog.getByLabel("Nome").fill("Recheio extra");
  await dialog.getByPlaceholder("Selecione os adicionais que viram opções").click();
  await page.getByRole("option", { name: /Carne/ }).click();
  await page.getByRole("option", { name: /Frango/ }).click();
  await page.keyboard.press("Escape");
  await dialog.getByRole("textbox", { name: "Mínimo" }).fill("0");
  await expect(dialog.getByText("Opcional · até 1")).toBeVisible();
  await dialog.getByLabel("Preço para todas as opções").fill("400");
  await dialog.getByRole("button", { name: "Aplicar" }).click();
  await expect(dialog.getByLabel("Preço de Frango neste grupo")).toHaveValue(/4,00/);
  await dialog.getByRole("button", { name: "Criar grupo" }).click();
  await expect(dialog).toBeHidden();
  const card = page.getByRole("row", { name: /Recheio extra/ });
  await expect(card).toContainText("Frango + R$ 4,00");

  const groups = (await (await page.request.get(`${base}/option-groups`)).json()).data;
  await page.request.put(`${base}/items/${pastel.id}`, { data: { optionGroupIds: [groups[0].id] } });

  // On the menu the optional group starts closed; opening it shows the fillings.
  await page.goto(`/${slug}`);
  await page.getByRole("button", { name: /^Pastel de queijo/ }).click();
  const item = page.getByRole("dialog");
  const toggle = item.getByRole("button", { name: /Recheio extra/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(item.getByText("Frango", { exact: true })).toBeHidden();
  await toggle.click();
  await item.getByText("Frango", { exact: true }).click();
  await expect(toggle).toContainText("Frango · + R$ 4,00");
  const add = item.getByRole("button", { name: /^Adicionar/ });
  await expect(add).toContainText("R$ 16,00");
  await add.click();

  await page.getByRole("button", { name: /Ver sacola/ }).click();
  await expect(page.getByRole("dialog").getByText("+ Recheio extra: Frango")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill("Ana Cliente");
  await page.getByLabel("Celular (WhatsApp)").fill("11987654321");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Pagar na retirada", { exact: true }).click();
  // A slow connection: while the tracking page loads, the bag shows the
  // confirmation instead of closing on an empty bag.
  await page.route(/\/pedido\/[0-9a-f-]{36}/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.getByRole("button", { name: /Fazer pedido/ }).click();
  await expect(page.getByRole("dialog").getByText(/Pedido #\d+ enviado!/)).toBeVisible();
  await expect(page.getByText("Sua sacola está vazia")).toHaveCount(0);

  // The API priced it with the group's R$ 4 and kept the group's name.
  await expect(page).toHaveURL(/\/pedido\/[0-9a-f-]{36}$/);
  await expect(page.getByText("+ Recheio extra: Frango")).toBeVisible();
  await expect(page.getByText("R$ 16,00").first()).toBeVisible();

  // "Pedir de novo" puts the extra filling back in its group.
  const orders = (await (await page.request.get(`${base}/orders`)).json()).data as { id: string }[];
  await page.request.post(`${base}/orders/${orders[0].id}/cancel`, { data: {} });
  await page.reload();
  await page.getByRole("button", { name: "Pedir de novo" }).click();
  // The bag opens by itself, alone (it used to pop up later, over the next item opened).
  const bag = page.getByRole("dialog");
  await expect(bag).toHaveCount(1);
  await expect(bag.getByText("+ Recheio extra: Frango")).toBeVisible();
  await expect(bag.getByText("R$ 16,00").first()).toBeVisible();
  await bag.getByRole("button", { name: "Fechar" }).click();
  await expect(bag).toHaveCount(0);
  await page.getByRole("button", { name: /^Pastel de queijo/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Adicionar/ })).toBeVisible();
});
