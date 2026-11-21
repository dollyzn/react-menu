import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { request as playwrightRequest, type Page } from "@playwright/test";
import { test, login, apiSignIn, DEMO_STAFF } from "./fixtures";
import { API_URL } from "../playwright.config";

const OUT = "/home/nsantos/pessoal/menu-app/prints-parceiros";
const TERMINAL = "FAKE_POINT__TESTE";
const env = Object.fromEntries(
  readFileSync("../api/.env", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)])
);
const sql = (query: string) =>
  execFileSync("psql", ["-h", env.DB_HOST, "-U", env.DB_USER, "-d", "react-menu-e2e", "-Atc", query], {
    env: { ...process.env, PGPASSWORD: env.DB_PASSWORD },
  }).toString();

const shot = async (page: Page, name: string, fullPage = false) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
};

test.setTimeout(480_000);

/** A product into the ticket: items with add-ons open the customizer first. */
async function add(page: Page, name: RegExp) {
  await page.getByRole("button", { name }).first().click();
  const confirm = page.getByRole("button", { name: /^Adicionar/ }).last();
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
}

test("prints", async ({ page, request, browser }) => {
  const menu = (await (await request.get(`${API_URL}/api/v1/public/menu`)).json()).data;
  const storeId = menu.store.id as string;
  const store = (path: string) => `${API_URL}/api/v1/stores/${storeId}${path}`;
  type MenuItem = { id: string; name: string; price: number; optionGroups: { minChoices: number }[]; addons: unknown[] };
  const items = menu.categories.flatMap((category: { items: MenuItem[] }) => category.items) as MenuItem[];
  const simple = items.filter((item) => item.optionGroups.every((group) => group.minChoices === 0));
  const pastry = simple.find((item) => /^Pastel/.test(item.name)) ?? simple[0];
  const drink = simple.find((item) => /Coca/.test(item.name)) ?? simple[1];

  // The store: the machine lent to the demo partner.
  await apiSignIn(request);
  const partner = ((await (await request.get(store("/partners"))).json()).data as { id: string; name: string }[]).find(
    (candidate) => candidate.name === "Açaí da Praça"
  )!;
  await request.post(store("/point/terminals"), { data: { terminalId: TERMINAL, name: "Maquininha do Açaí" } });
  await request.put(store(`/point/terminals/${TERMINAL}/partner`), { data: { partnerId: partner.id } });
  await request.post(store("/partners"), {
    data: { name: "Banca do Zé", commissionType: "per_unit", commissionValue: 1.5, cancelPolicy: "until_ready" },
  });

  // Sales by the partner, paid on the machine.
  const seller = await playwrightRequest.newContext();
  await apiSignIn(seller, DEMO_STAFF.partner);
  const customers = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi", "Hugo", "Iara", "Júlio", "Karen", "Lucas"];
  const sold: { id: string; number: number }[] = [];
  for (const [index, name] of customers.entries()) {
    const lines = [{ itemId: pastry.id, quantity: 1 + (index % 3) }, ...(index % 2 ? [{ itemId: drink.id, quantity: 1 }] : [])];
    const order = (await (await seller.post(store("/partner/orders"), { data: { customer: { name }, lines } })).json()).data;
    const charge = (await (await seller.post(store(`/partner/orders/${order.id}/point-charges`), { data: { paymentType: "debit_card" } })).json()).data;
    await seller.post(store(`/partner/orders/${order.id}/point-charges/${charge.id}/simulate`), { data: { approve: true } });
    sold.push(order);
  }
  // The first eight: made, handed over; five delivered; the oldest four settled.
  const prepare = async (orderId: string) => {
    const detail = (await (await request.get(store(`/orders/${orderId}`))).json()).data;
    const units = detail.items.filter((line: { requiresPreparation: boolean }) => line.requiresPreparation).map((line: { id: number; quantity: number }) => ({ lineId: line.id, quantity: line.quantity }));
    if (units.length) await request.post(store("/kitchen/prepare"), { data: { units } });
  };
  for (const order of sold.slice(0, 8)) {
    await prepare(order.id);
    await request.post(store(`/orders/${order.id}/complete`));
  }
  for (const order of sold.slice(0, 5)) await seller.post(store(`/partner/orders/${order.id}/deliver`));
  // Spread over the last days, for the chart and the settlement.
  for (const [index, order] of sold.slice(0, 8).entries()) {
    const days = 8 - index;
    sql(`update orders set business_date = current_date - ${days}, created_at = created_at - interval '${days} days', completed_at = completed_at - interval '${days} days' where id = '${order.id}'`);
  }
  const until = sql(`select to_char(current_date - 5, 'YYYY-MM-DD')`).trim();
  await request.post(store(`/partners/${partner.id}/settlements`), { data: { until, note: "Pix de sexta" } });
  // One ready at the store, one asked to be cancelled.
  await prepare(sold[8].id);
  const switched = await request.put(store(`/partners/${partner.id}`), {
    data: { name: partner.name, commissionType: "percent", commissionValue: 10, cancelPolicy: "until_kitchen" },
  });
  void switched;
  await prepare(sold[9].id);
  await seller.post(store(`/partner/orders/${sold[9].id}/cancel-request`), { data: { reason: "A cliente desistiu e foi embora" } });

  // ---------- The store's manager (desktop, dark) ----------
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  const base = `/app/stores/${storeId}`;

  await page.goto(`${base}/partners`);
  await shot(page, "01-gerente-lista-de-parceiros");
  await page.getByRole("button", { name: "Novo parceiro" }).click();
  await shot(page, "02-gerente-novo-parceiro");
  await page.keyboard.press("Escape");

  await page.goto(`${base}/partners/${partner.id}`);
  await shot(page, "03-gerente-parceiro-visao-geral", true);
  await page.getByRole("tab", { name: "Vendas e acertos" }).click();
  await page.waitForTimeout(800);
  const pick = page.getByRole("checkbox", { name: /Escolher o pedido/ }).and(page.locator(":not([data-disabled])"));
  await pick.first().click().catch(() => undefined);
  await shot(page, "04-gerente-parceiro-vendas-e-acertos", true);
  await page.getByRole("button", { name: "Marcar como pago…" }).click();
  await shot(page, "05-gerente-marcar-comissao-como-paga");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Configurações" }).click();
  await page.waitForTimeout(600);
  await shot(page, "06-gerente-parceiro-regras");
  await page.getByText("Só algumas categorias").click();
  await page.getByRole("switch").first().click();
  await page.getByRole("switch").nth(1).click();
  await page.locator("#catalog-categories").scrollIntoViewIfNeeded();
  await shot(page, "07-gerente-parceiro-cardapio-liberado");

  await page.goto(`${base}/members`);
  await shot(page, "08-gerente-equipe-com-parceiros");
  await page.getByRole("button", { name: "Adicionar pessoa" }).click();
  await page.getByRole("radio", { name: /Parceiro/ }).click({ force: true });
  await page.waitForTimeout(400);
  await page.getByRole("dialog").locator("[data-slot=dialog-body]").evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await shot(page, "09-gerente-convidar-parceiro");
  await page.keyboard.press("Escape");

  await page.goto(`${base}?aba=pagamentos`);
  await page.getByText("Maquininhas (Mercado Pago Point)").scrollIntoViewIfNeeded();
  await shot(page, "10-gerente-maquininha-usada-por");

  await page.goto(`${base}/orders`);
  await shot(page, "11-quadro-de-pedidos-com-parceiro", true);
  await page.goto(`${base}/kitchen`);
  await shot(page, "12-cozinha-com-parceiro");

  // ---------- The partner's manager (phone, dark) ----------
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  await login(phone, DEMO_STAFF.partner, { landing: /\/partner$/ });
  await shot(phone, "13-parceiro-pdv");
  await add(phone, new RegExp(`^${pastry.name}`));
  await add(phone, /^Coca-Cola/);
  await phone.getByRole("button", { name: /Venda \(/ }).click();
  await phone.getByLabel("Nome do cliente").filter({ visible: true }).first().fill("Marina");
  await shot(phone, "14-parceiro-venda-com-comissao");
  await phone.getByRole("button", { name: "Vender e cobrar na maquininha" }).filter({ visible: true }).first().click();
  await shot(phone, "15-parceiro-cobrar-na-maquininha");
  await phone.getByRole("button", { name: "Voltar ao ticket" }).click().catch(() => phone.keyboard.press("Escape"));
  await phone.goto(`${base}/partner/orders`);
  await shot(phone, "16-parceiro-meus-pedidos");
  await phone.getByRole("tab", { name: /Prontos/ }).click();
  await shot(phone, "17-parceiro-pronto-na-loja");
  await phone.getByRole("tab", { name: /Com você/ }).click();
  await shot(phone, "18-parceiro-com-voce-entregar", true);
  await phone.goto(`${base}/partner/commission`);
  await shot(phone, "19-parceiro-comissao", true);
  await phone.close();

  // ---------- The partner's attendant (phone, dark) ----------
  const attendant = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  await login(attendant, DEMO_STAFF.partnerAttendant, { landing: /\/partner$/ });
  await add(attendant, new RegExp(`^${pastry.name}`));
  await attendant.getByRole("button", { name: /Venda \(/ }).click();
  await shot(attendant, "20-atendente-do-parceiro-venda-sem-comissao");
  await attendant.goto(`${base}/partner/commission`);
  await shot(attendant, "21-atendente-do-parceiro-comissao-bloqueada");
  await attendant.close();

  // ---------- Partner POS on a computer ----------
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  await login(desk, DEMO_STAFF.partner, { landing: /\/partner$/ });
  await add(desk, new RegExp(`^${pastry.name}`));
  await add(desk, /^Coca-Cola/);
  await desk.getByLabel("Nome do cliente").filter({ visible: true }).first().fill("Marina");
  await shot(desk, "22-parceiro-pdv-computador");
  await desk.close();
  await seller.dispose();
});
