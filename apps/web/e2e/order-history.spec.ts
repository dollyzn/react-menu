import type { Browser, Page } from "@playwright/test";
import { test, expect, login } from "./fixtures";
import { API_URL } from "../playwright.config";

const phone = "11912345678";
/** The same phone as WhatsApp ids carry it. */
const waId = "5511912345678";

/** Orders one Pastel de Carne as `name`; returns the API response. */
async function order(page: Page, name: string, options: { notices?: boolean } = {}) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Pastel de Carne, R\$/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  await page.getByRole("button", { name: /Ver sacola/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Celular (WhatsApp)").fill(phone);
  await page.getByRole("button", { name: "Continuar" }).click();
  if (options.notices) await page.getByRole("checkbox", { name: /Receber avisos pelo WhatsApp/ }).check();
  const placed = page.waitForResponse((r) => r.url().endsWith("/orders") && r.request().method() === "POST");
  await page.getByText("Pagar na retirada", { exact: true }).click();
  await page.getByRole("button", { name: /Fazer pedido/ }).click();
  const response = await placed;
  const body = await response.json();
  await expect(page).toHaveURL(/\/pedido\//);
  return { ...(body.data as { number: number; store: { slug: string } }), sent: response.request().postDataJSON() };
}

async function device(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

const orderCard = (page: Page, number: number) =>
  page.getByRole("article", { name: new RegExp(`Pedido ${number}:`) });

test("with the store's WhatsApp, customers ask for notices and open their history by proving the phone", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const menu = await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json();
  const storeId = menu.data.store.id as string;

  // The manager connects the number (development fake: no Meta popup).
  await login(page);
  await page.goto(`/app/stores/${storeId}?aba=whatsapp`);
  await page.getByRole("button", { name: "Conectar número de teste" }).click();
  await expect(page.getByText("+55 11 90000-0000")).toBeVisible();
  await expect(page.getByRole("region", { name: "Modelos de mensagem" }).getByText("Aprovado")).toHaveCount(4);

  // A customer asks for notices at checkout.
  const customer = await device(browser);
  const name = `Zap ${Date.now()}`;
  const first = await order(customer, name, { notices: true });
  expect(first.sent.whatsappOptIn).toBe(true);

  // The history page offers the sign-in; the code goes by WhatsApp from the phone.
  await customer.goto("/pedidos");
  await expect(orderCard(customer, first.number)).toBeVisible();
  await customer.getByRole("button", { name: "Entrar pelo WhatsApp" }).click();
  const code = (await customer.getByLabel(/^Código [A-Z0-9]{6}$/).textContent())!.trim();
  await expect(customer.getByRole("link", { name: "Abrir o WhatsApp" })).toHaveAttribute(
    "href",
    new RegExp(`^https://wa\\.me/5511900000000\\?text=.*${code}`)
  );
  await expect(customer.getByText("Esperando sua mensagem…")).toBeVisible();
  const inbound = await customer.request.post(`${API_URL}/api/v1/__e2e/whatsapp/inbound`, {
    data: { slug: first.store.slug, from: waId, text: `Quero ver meus pedidos. Código: ${code}` },
  });
  expect((await inbound.json()).matched).toBe(true);
  await expect(customer.getByText(/Vendo todos os seus pedidos na/)).toBeVisible();

  // Another phone, nothing ordered on it: a code sent to the number opens the same history.
  const other = await device(browser);
  await other.goto("/pedidos");
  await other.getByRole("button", { name: "Receber um código" }).click();
  await other.getByLabel("Seu celular (WhatsApp)").fill(phone);
  await other.getByRole("button", { name: "Enviar código" }).click();
  await expect(other.getByText(/Mandamos um código pelo WhatsApp/)).toBeVisible();
  const sent = await other.request.get(`${API_URL}/api/v1/__e2e/whatsapp/login-code`, { params: { phone: waId } });
  await other.getByLabel("Código de 6 dígitos").fill((await sent.json()).code);
  await expect(orderCard(other, first.number)).toBeVisible();

  // "Sair": back to the sign-in, and only this device's (none) orders.
  await other.getByRole("button", { name: "Sair neste aparelho" }).click();
  await expect(other.getByRole("button", { name: "Entrar pelo WhatsApp" })).toBeVisible();
  await expect(orderCard(other, first.number)).toHaveCount(0);

  // A device that only knows the phone sees only what it ordered.
  const stranger = await device(browser);
  const strangerOrder = await order(stranger, name);
  await stranger.goto("/pedidos");
  await expect(orderCard(stranger, strangerOrder.number)).toBeVisible();
  await expect(orderCard(stranger, first.number)).toHaveCount(0);

  // The panel lists the notice; then the store disconnects (the other tests run without it).
  await page.reload();
  await expect(page.getByRole("region", { name: "Últimas mensagens" }).getByText("Pedido recebido")).toBeVisible();
  await page.getByRole("button", { name: "Desconectar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desconectar" }).click();
  await expect(page.getByRole("button", { name: "Conectar número de teste" })).toBeVisible();

  for (const p of [customer, other, stranger]) await p.context().close();
});
