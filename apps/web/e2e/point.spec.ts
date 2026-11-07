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

    // POS: send a ticket and charge it on the machine.
    await page.goto(`/app/stores/${storeId}/pos`);
    const sendCharged = async (customer: string) => {
      await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
      await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
      await page.getByLabel("Nome do cliente").fill(customer);
      await page.getByRole("button", { name: "Enviar e cobrar na maquininha" }).click();
      const dialog = page.getByRole("dialog", { name: /Cobrar pedido #\d+/ });
      const number = (await dialog.getByRole("heading").first().textContent())!.match(/#(\d+)/)![1];
      return { dialog, number };
    };
    const first = await sendCharged("Maquininha");
    await first.dialog.getByRole("radio", { name: "Débito" }).click();
    await first.dialog.getByRole("button", { name: /Enviar para a maquininha/ }).click();
    await expect(first.dialog.getByText("Aguardando pagamento na maquininha")).toBeVisible();

    // Closed by mistake: the charge goes on, and the bar opens it again.
    await page.keyboard.press("Escape");
    await expect(first.dialog).toBeHidden();
    const bar = page.getByRole("region", { name: "Na maquininha" });
    await expect(bar.getByText(`Pedido #${first.number}`)).toBeVisible();

    // The machine is busy with it: another order is told which one, and can't go.
    const second = await sendCharged("Outro");
    await second.dialog.getByRole("button", { name: /Enviar para a maquininha/ }).click();
    await expect(second.dialog.getByText(new RegExp(`cobrança do pedido #${first.number} em aberto`))).toBeVisible();
    await expect(
      second.dialog.getByRole("button", { name: `Cancelar a cobrança do pedido #${first.number}` })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await bar.getByRole("button", { name: "Abrir" }).click();
    const resumed = page.getByRole("dialog", { name: `Cobrar pedido #${first.number}` });
    await expect(resumed.getByText("Aguardando pagamento na maquininha")).toBeVisible();
    await resumed.getByRole("button", { name: "Simular aprovação" }).click();
    await expect(resumed.getByText("Pagamento aprovado")).toBeVisible();
    await resumed.getByRole("button", { name: "Concluir" }).click();
    await expect(bar).toBeHidden();
    const number = first.number;

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
