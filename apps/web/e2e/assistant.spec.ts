import { test, expect, login } from "./fixtures";
import { API_URL } from "../playwright.config";

/**
 * The store assistant with the API's scripted model (ASSISTANT_FAKE_MODEL):
 * the sheet, a read tool's card, and a write that waits for approval.
 */
test("the assistant answers with cards and asks before changing the menu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const menu = await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json();
  const storeId = menu.data.store.id as string;
  await login(page);
  await page.goto(`/app/stores/${storeId}/reports`);

  await page.getByRole("button", { name: "Abrir o assistente" }).click();
  const sheet = page.getByRole("dialog", { name: /Assistente/ });
  await expect(sheet.getByText("Como posso ajudar?")).toBeVisible();

  // A read: the tool runs and its card shows above the answer.
  const field = sheet.getByLabel("Mensagem para o assistente");
  await field.fill("Quanto vendi na última semana?");
  await field.press("Enter");
  // The steps fold into one line (Chain of Thought) that opens into them.
  await sheet.getByRole("button", { name: /^Pensou (por|em)/ }).first().click();
  await expect(sheet.getByText("Consultou as vendas")).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Vendas" })).toBeVisible();
  await expect(sheet.getByText(/em \d+ pedidos/)).toBeVisible();

  // A write: nothing changes until "Aprovar".
  await field.fill("Pausa o pastel de carne");
  await field.press("Enter");
  const card = sheet.getByText(/^Alterar /);
  await expect(card).toBeVisible();
  const item = (await card.textContent())!.replace(/^Alterar /, "");
  await expect(sheet.getByText("Esperando sua aprovação")).toBeVisible();
  await sheet.getByRole("button", { name: "Aprovar" }).click();
  await expect(sheet.getByText("Pronto: 1 item(ns) alterado(s).")).toBeVisible();
  await expect(sheet.getByText("Aprovado por você.")).toBeVisible();

  const items = await page.request.get(`${API_URL}/api/v1/stores/${storeId}/items`, {
    params: { perPage: 100, name: item },
  });
  const rows = (await items.json()).data as { name: string; isAvailable: boolean }[];
  expect(rows.find((row) => row.name === item)?.isAvailable).toBe(false);

  // Back on sale (the other tests use the menu), declined first.
  await field.fill(`Volta a vender ${item}`);
  await field.press("Enter");
  await sheet.getByRole("button", { name: "Recusar" }).click();
  await expect(sheet.getByText("Recusado: nada foi alterado.")).toBeVisible();
  await field.fill(`Volta a vender ${item}`);
  await field.press("Enter");
  await sheet.getByRole("button", { name: "Aprovar" }).last().click();
  await expect(sheet.getByText("Pronto: 1 item(ns) alterado(s).")).toHaveCount(2);
  const after = await page.request.get(`${API_URL}/api/v1/stores/${storeId}/items`, {
    params: { perPage: 100, name: item },
  });
  expect(((await after.json()).data as { name: string; isAvailable: boolean }[]).find((row) => row.name === item)?.isAvailable).toBe(true);

  // Closing and opening the store, approved each time.
  await field.fill("Fecha a loja agora");
  await field.press("Enter");
  await expect(sheet.getByText("Fechar a loja", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Aprovar" }).click();
  await expect(sheet.getByText("Pronto: a loja está fechada.")).toBeVisible();
  await field.fill("Abre a loja de novo");
  await field.press("Enter");
  await sheet.getByRole("button", { name: "Aprovar" }).click();
  await expect(sheet.getByText("Pronto: a loja está aberta.")).toBeVisible();

  // A photo shows its name and size, opens whole, and can be taken off.
  await page.getByLabel("Escolher fotos").setInputFiles("public/login-marquee/addons-light.webp");
  await sheet.getByRole("button", { name: "Ver addons-light.webp", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "addons-light.webp" });
  await expect(viewer.getByRole("img", { name: "addons-light.webp" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await sheet.getByRole("button", { name: "Remover addons-light.webp" }).click();

  // New items by category: the first one open, the others fold; declined.
  await field.fill("Cria os itens do cardápio da foto");
  await field.press("Enter");
  await expect(sheet.getByText("Criar 6 itens no cardápio")).toBeVisible();
  await expect(sheet.getByText("X-Bacon")).toBeVisible();
  await expect(sheet.getByText("Frango bacon")).toBeHidden();
  await sheet.getByRole("button", { name: /Lanches com frango/ }).click();
  await expect(sheet.getByText("Frango bacon")).toBeVisible();
  await sheet.getByRole("button", { name: "Recusar" }).click();
  // The second declined card of this conversation (the first was the pause).
  await expect(sheet.getByText("Recusado: nada foi alterado.")).toHaveCount(2);

  // The conversation is in the history.
  await sheet.getByRole("button", { name: "Nova conversa" }).click();
  await expect(sheet.getByText("Como posso ajudar?")).toBeVisible();
  await sheet.getByRole("button", { name: "Conversas anteriores" }).click();
  await page.getByRole("menuitem", { name: /Quanto vendi na última semana/ }).click();
  await expect(sheet.getByRole("heading", { name: "Vendas" })).toBeVisible();

  // The settings link closes the sheet and opens the store's tab.
  await sheet.getByRole("button", { name: "Conversas anteriores" }).click();
  await page.getByRole("menuitem", { name: "Configurar o assistente" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("tab", { name: "Assistente" })).toHaveAttribute("aria-selected", "true");
});

test("managers connect providers and choose the chat's models", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const menu = await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json();
  await login(page);
  await page.goto(`/app/stores/${menu.data.store.id}?aba=assistente`);
  const tab = page.getByRole("tabpanel", { name: "Assistente" });

  // Connecting tests the key first (the e2e API takes "fake-" keys).
  await tab.getByRole("button", { name: "Conectar" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Conectar Claude (Anthropic)" });
  await dialog.getByRole("button", { name: "Testar e conectar" }).click();
  await expect(dialog.getByText("Cole a chave da API.")).toBeVisible();
  await dialog.getByLabel("Chave da API").fill("fake-e2e-key-123");
  await dialog.getByRole("button", { name: "Testar e conectar" }).click();
  await expect(page.getByText("Claude (Anthropic) conectado").first()).toBeVisible();
  await expect(tab.getByText("Assistente de teste")).toBeVisible();
  await expect(tab.getByText("Padrão", { exact: true })).toBeVisible();

  // Another model from the list, then made the default.
  await tab.getByRole("button", { name: "Adicionar modelo" }).click();
  await page.getByRole("option", { name: /Claude Haiku 5.5/ }).click();
  await expect(page.getByText("Claude Haiku 5.5 adicionado").first()).toBeVisible();
  await tab.getByRole("button", { name: "Opções de Claude Haiku 5.5" }).click();
  await page.getByRole("menuitem", { name: "Usar como padrão" }).click();
  await expect(page.getByText("Claude Haiku 5.5 é o padrão").first()).toBeVisible();

  // Disconnecting removes the key and its models.
  await tab.getByRole("button", { name: "Opções de Claude (Anthropic)" }).click();
  await page.getByRole("menuitem", { name: "Desconectar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desconectar" }).click();
  await expect(page.getByText("Claude (Anthropic) desconectado").first()).toBeVisible();
  await expect(tab.getByText("Conecte um provedor para escolher os modelos.")).toBeVisible();
});
