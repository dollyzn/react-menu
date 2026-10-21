import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login } from "./fixtures";
import { API_URL } from "../playwright.config";

test("a cancelled Pix order shows the pending refund and a manager refunds it", async ({ page }) => {
  const customer = `Reembolso ${Date.now()}`;

  // A customer pays with Pix (development fake gateway).
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const item = menu.categories[0].items[0];
  const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: { lines: [{ itemId: item.id, quantity: 1 }], customer: { name: customer, phone: "11966665555" }, paymentMethod: "pix" },
  });
  const token = (await placed.json()).data.publicToken as string;
  await api.post(`/api/v1/public/orders/${token}/payments`, { data: { method: "pix", payer: { email: "pix@example.com" } } });
  const paid = await api.post(`/api/v1/public/orders/${token}/payments/simulate`);
  expect((await paid.json()).data.paymentStatus).toBe("paid");
  await api.dispose();

  await login(page);
  await page.goto(`/app/stores/${menu.store.id}/orders?view=historico`);
  await page.getByRole("button", { name: "Filtrar por número, cliente ou telefone" }).click();
  await page.getByPlaceholder("Digite para filtrar...").fill(customer);
  await page.getByRole("button", { name: "Aplicar filtro" }).click();
  await page.getByRole("row", { name: new RegExp(customer) }).click();

  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Cancelar" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("reembolsado ao cliente");
  await confirm.getByRole("button", { name: "Cancelar pedido" }).click();

  // The automatic refund runs in the worker (none in e2e): it shows as pending.
  await expect(detail.getByText(/Reembolso pendente/)).toBeVisible();
  await expect(detail.getByRole("region", { name: "Pagamento online" }).getByText("Aprovado")).toBeVisible();

  await detail.getByRole("button", { name: "Reembolsar agora" }).click();
  await expect(detail.getByText(/Reembolso pendente/)).toBeHidden();
  await expect(detail.getByText("reembolsado", { exact: true })).toBeVisible();
  await expect(detail.getByText("Reembolsado", { exact: true })).toBeVisible();
});
