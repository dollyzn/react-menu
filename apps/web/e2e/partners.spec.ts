import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login, apiSignIn, DEMO_STAFF } from "./fixtures";
import { API_URL } from "../playwright.config";

/** The development fake (PAYMENTS_FAKE_GATEWAY): one pretend machine. */
const FAKE_TERMINAL = "FAKE_POINT__TESTE";

/**
 * A partner (ADR 0024) sells on the machine the store lent them; the store
 * makes it and hands it over; the partner hands it to the customer and sees
 * the commission to receive.
 */
test("partner: sells on the lent machine, the store hands it over, the partner delivers", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const menu = (await (await request.get(`${API_URL}/api/v1/public/menu`)).json()).data;
  const storeId = menu.store.id as string;
  const store = (path: string) => `${API_URL}/api/v1/stores/${storeId}${path}`;

  // The store: the machine on and lent to the demo partner.
  await apiSignIn(request);
  const partners = (await (await request.get(store("/partners"))).json()).data as { id: string; name: string }[];
  const partner = partners.find((candidate) => candidate.name === "Açaí da Praça")!;
  expect((await request.post(store("/point/terminals"), { data: { terminalId: FAKE_TERMINAL, name: "Açaí" } })).ok()).toBeTruthy();
  expect(
    (await request.put(store(`/point/terminals/${FAKE_TERMINAL}/partner`), { data: { partnerId: partner.id } })).ok()
  ).toBeTruthy();

  try {
    // The partner lands on their own POS, with their commission on screen.
    await login(page, DEMO_STAFF.partner, { landing: /\/partner$/ });
    await expect(page.getByText("Comissão: 10% de cada venda")).toBeVisible();

    await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
    await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
    await page.getByLabel("Nome do cliente").fill("Cliente da Praça");
    await expect(page.getByText("Sua comissão nesta venda")).toBeVisible();

    await page.getByRole("button", { name: "Vender e cobrar na maquininha" }).click();
    const charging = page.getByRole("dialog", { name: /Cobrar/ });
    await charging.getByRole("button", { name: /^Cobrar R\$/ }).click();
    await expect(charging).toHaveAccessibleName(/Cobrar pedido #\d+/);
    const number = (await charging.getByRole("heading").first().textContent())!.match(/#(\d+)/)![1];
    await charging.getByRole("button", { name: "Simular aprovação" }).click();
    await expect(charging.getByText("Pagamento aprovado")).toBeVisible();
    await charging.getByRole("button", { name: "Concluir" }).click();

    // A drink skips the kitchen: ready at the store at once.
    await page.getByRole("link", { name: "Meus pedidos" }).click();
    const ready = page.getByRole("region", { name: /Pronto na loja/ });
    const card = page.getByRole("article", { name: `Pedido ${number} de Cliente da Praça` });
    await expect(ready.getByRole("article", { name: `Pedido ${number} de Cliente da Praça` })).toBeVisible();

    // The store's board knows whose it is; the counter hands it over.
    const board = (await (await request.get(store("/orders"))).json()).data as { id: string; number: number; partner: { name: string } | null }[];
    const order = board.find((candidate) => String(candidate.number) === number && candidate.partner)!;
    expect(order.partner?.name).toBe("Açaí da Praça");
    expect((await request.post(store(`/orders/${order.id}/complete`))).ok()).toBeTruthy();

    // With the partner now (live): they hand it to the customer.
    await expect(card.getByRole("button", { name: "Entreguei ao cliente" })).toBeVisible();
    await card.getByRole("button", { name: "Entreguei ao cliente" }).click();
    // Over: it leaves the columns for today's finished list.
    await expect(card).toBeHidden();
    await expect(page.getByText("Entregues e cancelados hoje")).toBeVisible();

    await page.getByRole("link", { name: "Comissão" }).click();
    await expect(page.getByRole("heading", { name: "Comissão" })).toBeVisible();
    await expect(page.getByText("A receber")).toBeVisible();
  } finally {
    // The other POS tests expect no machine.
    await request.delete(store(`/point/terminals/${FAKE_TERMINAL}`));
  }
});

test("partner: the store's screens are closed to them", async ({ page }) => {
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json()).data;
  const storeId = menu.store.id as string;
  await login(page, DEMO_STAFF.partner, { landing: /\/partner$/ });

  // The sidebar has only their area.
  await expect(page.getByRole("link", { name: "Meus pedidos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pedidos", exact: true })).toBeHidden();

  // The API refuses the store's own data.
  const orders = await page.request.get(`${API_URL}/api/v1/stores/${storeId}/orders`);
  expect(orders.status()).toBe(403);
});

/**
 * Managers: the partners table (search in the URL), the partner's page
 * (breadcrumb, tabs), what it may sell, and a sale's commission marked
 * paid from the sales table, then undone.
 */
test("partners: managers follow the table, settle a sale and choose the menu", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const menu = (await (await request.get(`${API_URL}/api/v1/public/menu`)).json()).data;
  const storeId = menu.store.id as string;
  const store = (path: string) => `${API_URL}/api/v1/stores/${storeId}${path}`;
  await apiSignIn(request);
  const partners = (await (await request.get(store("/partners"))).json()).data as { id: string; name: string }[];
  const partner = partners.find((candidate) => candidate.name === "Açaí da Praça")!;
  expect((await request.post(store("/point/terminals"), { data: { terminalId: FAKE_TERMINAL, name: "Açaí" } })).ok()).toBeTruthy();
  expect(
    (await request.put(store(`/point/terminals/${FAKE_TERMINAL}/partner`), { data: { partnerId: partner.id } })).ok()
  ).toBeTruthy();

  // A sale handed over to the partner: commission to pay.
  const seller = await playwrightRequest.newContext();
  let number = "";
  try {
    await apiSignIn(seller, DEMO_STAFF.partner);
    const coca = menu.categories.flatMap((category: { items: { id: string; name: string }[] }) => category.items).find(
      (item: { name: string }) => item.name.startsWith("Coca-Cola")
    );
    const sold = (
      await (
        await seller.post(store("/partner/orders"), {
          data: { customer: { name: "Acerto" }, lines: [{ itemId: coca.id, quantity: 2 }] },
        })
      ).json()
    ).data as { id: string; number: number };
    number = String(sold.number);
    const charge = (
      await (await seller.post(store(`/partner/orders/${sold.id}/point-charges`), { data: { paymentType: "debit_card" } })).json()
    ).data as { id: string };
    expect(
      (await seller.post(store(`/partner/orders/${sold.id}/point-charges/${charge.id}/simulate`), { data: { approve: true } })).ok()
    ).toBeTruthy();
    expect((await request.post(store(`/orders/${sold.id}/complete`))).ok()).toBeTruthy();

    await login(page);
    await page.goto(`/app/stores/${storeId}/partners`);
    const row = page.getByRole("row", { name: /Açaí da Praça/ });
    await expect(row).toBeVisible();
    await page.getByRole("searchbox").first().fill("ninguém");
    await expect(row).toBeHidden();
    await expect(page).toHaveURL(/ninguém|ningu%C3%A9m/);
    await page.getByRole("searchbox").first().fill("");
    await row.click();

    // The partner's page: breadcrumb with its name, the tabs.
    await expect(page.getByRole("navigation", { name: "breadcrumb" }).getByText("Açaí da Praça")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("[data-slot=card-title]", { hasText: "Vendas por dia" })).toBeVisible();

    // Sales: pick the sale, mark it paid, then undo the settlement.
    await page.getByRole("tab", { name: "Vendas e acertos" }).click();
    await page.getByRole("checkbox", { name: `Escolher o pedido ${number}` }).click();
    await page.getByRole("button", { name: "Marcar como paga" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pago" }).click();
    await expect(page.getByText(/marcada como paga/).first()).toBeVisible();
    await page.getByRole("button", { name: "Desfazer" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desfazer acerto" }).click();
    await expect(page.getByText("Acerto desfeito")).toBeVisible();

    // What it may sell: only one category.
    const first = menu.categories[0] as { id: number; name: string };
    await page.getByRole("tab", { name: "Configurações" }).click();
    await page.getByText("Só algumas categorias").click();
    await page.getByRole("switch", { name: `Liberar ${first.name}` }).click();
    await page.getByRole("button", { name: "Salvar cardápio" }).click();
    await expect(page.getByText("Cardápio do parceiro salvo")).toBeVisible();
    const saved = (await (await request.get(store(`/partners/${partner.id}`))).json()).data;
    expect(saved.catalogMode).toBe("selected");
    expect(saved.categoryIds).toEqual([first.id]);
  } finally {
    await request.put(store(`/partners/${partner.id}/catalog`), { data: { mode: "all", categoryIds: [], excludedItemIds: [] } });
    await request.delete(store(`/point/terminals/${FAKE_TERMINAL}`));
    await seller.dispose();
  }
});

test("partner's attendant: sells without seeing the commission", async ({ page }) => {
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json()).data;
  const storeId = menu.store.id as string;
  await login(page, DEMO_STAFF.partnerAttendant, { landing: /\/partner$/ });

  await expect(page.getByRole("link", { name: "Meus pedidos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Comissão" })).toBeHidden();
  await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
  await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
  await expect(page.getByText(/Sua comissão/)).toBeHidden();
  await expect(page.getByText(/de cada venda/)).toBeHidden();

  // The commission page says it is the partner's managers'.
  await page.goto(`/app/stores/${storeId}/partner/commission`);
  await expect(page.getByText("Só para quem gerencia o parceiro")).toBeVisible();
});
