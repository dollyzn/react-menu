import { test, expect, login, apiSignIn } from "./fixtures";
import { API_URL } from "../playwright.config";

/** The development fake (PAYMENTS_FAKE_GATEWAY): one pretend machine. */
const FAKE_TERMINAL = "FAKE_POINT__TESTE";

test("card machine: turn it on, charge a POS order and see it paid", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json()).data;
  const storeId = menu.store.id as string;

  try {
    await login(page);
    await page.goto(`/app/stores/${storeId}`);

    // Settings: the account's machines; turn the pretend one on for the POS.
    const card = page.getByText("Maquininhas (Mercado Pago Point)").locator("xpath=ancestor::*[@data-slot='card']");
    await card.getByRole("button", { name: "Usar no PDV" }).click();
    const naming = page.getByRole("dialog", { name: "Usar no PDV" });
    await naming.getByLabel("Nome da maquininha").fill("Caixa");
    await naming.getByRole("button", { name: "Ativar" }).click();
    await expect(page.getByText(/Maquininha ativada/).first()).toBeVisible();
    await expect(card.getByText("No PDV")).toBeVisible();

    // POS: send the ticket and charge it on the machine.
    await page.goto(`/app/stores/${storeId}/pos`);
    await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
    await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
    await page.getByLabel("Nome do cliente").fill("Maquininha");
    await page.getByRole("button", { name: "Enviar e cobrar na maquininha" }).click();

    const charge = page.getByRole("dialog", { name: /Cobrar pedido #\d+/ });
    const number = (await charge.getByRole("heading").first().textContent())!.match(/#(\d+)/)![1];
    await charge.getByRole("radio", { name: "Débito" }).click();
    await charge.getByRole("button", { name: /Enviar para a maquininha/ }).click();
    await expect(charge.getByText("Aguardando pagamento na maquininha")).toBeVisible();
    await charge.getByRole("button", { name: "Simular aprovação" }).click();
    await expect(charge.getByText("Pagamento aprovado")).toBeVisible();
    await charge.getByRole("button", { name: "Concluir" }).click();

    // The board shows it paid on the machine.
    await page.goto(`/app/stores/${storeId}/orders`);
    const order = page.getByRole("article", { name: new RegExp(`Pedido ${number} de Maquininha`) });
    await expect(order.getByText("Pago")).toBeVisible();
  } finally {
    // The other POS tests expect no machine.
    await apiSignIn(page.request);
    await page.request.delete(`${API_URL}/api/v1/stores/${storeId}/point/terminals/${FAKE_TERMINAL}`);
  }
});
