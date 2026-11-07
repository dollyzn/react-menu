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

    // POS: "Enviar e cobrar" opens on the ticket; nothing is created until it is sent.
    await page.goto(`/app/stores/${storeId}/pos`);
    const ticket = async (customer: string) => {
      await page.getByRole("searchbox", { name: "Buscar produto" }).fill("coca");
      await page.getByRole("button", { name: /^Coca-Cola/ }).first().click();
      await page.getByLabel("Nome do cliente").fill(customer);
    };
    const charging = page.getByRole("dialog", { name: /Cobrar/ });
    const sendToMachine = async () => {
      await charging.getByRole("button", { name: /^Cobrar R\$/ }).click();
      await expect(charging).toHaveAccessibleName(/Cobrar pedido #\d+/);
      return (await charging.getByRole("heading").first().textContent())!.match(/#(\d+)/)![1];
    };

    await ticket("Maquininha");
    await page.getByRole("button", { name: "Enviar e cobrar na maquininha" }).click();
    await expect(charging).toHaveAccessibleName("Cobrar na maquininha");
    await charging.getByRole("button", { name: "Voltar ao ticket" }).click();
    await expect(charging).toBeHidden();
    // The ticket is intact: the dialog closed before anything was sent.
    await expect(page.getByLabel("Nome do cliente")).toHaveValue("Maquininha");

    await page.getByRole("button", { name: "Enviar e cobrar na maquininha" }).click();
    await charging.getByRole("radio", { name: "Débito" }).click();
    const first = await sendToMachine();
    await expect(charging.getByText("Aguardando pagamento na maquininha")).toBeVisible();

    // A stray tap outside doesn't close it; "Continuar depois" does, and the charge goes on.
    await page.mouse.click(5, 5);
    await expect(charging).toBeVisible();
    await charging.getByRole("button", { name: "Continuar depois" }).click();
    await expect(charging).toBeHidden();
    const bar = page.getByRole("region", { name: "Na maquininha" });
    await expect(bar.getByText(`Pedido #${first}`)).toBeVisible();

    // The machine is busy with it: another order is told which one.
    await ticket("Outro");
    await page.getByRole("button", { name: "Enviar e cobrar na maquininha" }).click();
    await sendToMachine();
    await expect(charging.getByText(new RegExp(`cobrança do pedido #${first} em aberto`))).toBeVisible();
    await expect(charging.getByRole("button", { name: `Cancelar a cobrança do pedido #${first}` })).toBeVisible();
    await charging.getByRole("button", { name: "Cobrar depois" }).click();

    await bar.getByRole("button", { name: "Abrir" }).click();
    const resumed = page.getByRole("dialog", { name: `Cobrar pedido #${first}` });
    await expect(resumed.getByText("Aguardando pagamento na maquininha")).toBeVisible();
    await resumed.getByRole("button", { name: "Simular aprovação" }).click();
    await expect(resumed.getByText("Pagamento aprovado")).toBeVisible();
    await resumed.getByRole("button", { name: "Concluir" }).click();
    await expect(bar).toBeHidden();
    const number = first;

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
