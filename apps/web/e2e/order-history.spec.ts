import type { Browser, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const phone = "11912345678";

/** Orders one Pastel de Carne as `name`; returns the API response. */
async function order(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Pastel de Carne, R\$/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  await page.getByRole("button", { name: /Ver sacola/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Celular (WhatsApp)").fill(phone);
  await page.getByRole("button", { name: "Continuar" }).click();
  const placed = page.waitForResponse((r) => r.url().endsWith("/orders") && r.request().method() === "POST");
  await page.getByRole("button", { name: /Fazer pedido/ }).click();
  const body = await (await placed).json();
  await expect(page).toHaveURL(/\/pedido\//);
  return body.data as { number: number; customerToken: string | null; store: { slug: string } };
}

async function device(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test("the order history follows the customer to another device, never by phone alone", async ({
  page,
  browser,
}) => {
  const name = `Sync ${Date.now()}`;
  const first = await order(page, name);
  expect(first.customerToken).toMatch(/^ct_/);

  // Another device opens the link from "Usar em outro aparelho".
  const linked = await device(browser);
  await linked.goto(`/pedidos?vincular=${first.store.slug}.${first.customerToken}`);
  await expect(linked.getByText("Pronto! Este aparelho agora mostra os seus pedidos.")).toBeVisible();
  await expect(linked).toHaveURL(/\/pedidos$/);
  await expect(linked.getByRole("article", { name: new RegExp(`Pedido ${first.number}:`) })).toBeVisible();
  await expect(linked.getByText(`Vinculado a ${name}`)).toBeVisible();

  // A device that only knows the phone gets an order, but not the history.
  const stranger = await device(browser);
  const strangerOrder = await order(stranger, name);
  expect(strangerOrder.customerToken).toBeNull();
  await stranger.goto("/pedidos");
  await expect(stranger.getByRole("article", { name: new RegExp(`Pedido ${strangerOrder.number}:`) })).toBeVisible();
  await expect(stranger.getByRole("article", { name: new RegExp(`Pedido ${first.number}:`) })).toHaveCount(0);

  await linked.context().close();
  await stranger.context().close();
});
