import * as OTPAuth from "otpauth";
import { test, expect, login, createStoreViaApi, signInCode } from "./fixtures";
import { API_URL } from "../playwright.config";

/** The authenticator app's code for `secret`, `offset` periods from now. */
const totp = (secret: string, offset = 0) =>
  new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({ timestamp: Date.now() + offset * 30_000 });

test("two-step sign-in: e-mail code, trusted device, then the authenticator app", async ({ page, browser }) => {
  const store = await createStoreViaApi(page, "Duas etapas");
  const staff = { name: "Duda", email: `duda-${Date.now()}@example.com`, password: "duda-12345" };
  expect((await page.request.post(`${API_URL}/api/v1/users`, { data: staff })).ok()).toBeTruthy();
  await page.request.post(`${API_URL}/api/v1/stores/${store.id}/members`, { data: { email: staff.email, role: "manager" } });
  await page.context().clearCookies();

  // Password first, then the e-mail code: a wrong one shakes and counts down.
  await page.goto("/app/login");
  await page.getByLabel("E-mail").fill(staff.email);
  await page.getByLabel("Senha", { exact: true }).fill(staff.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirme que é você" })).toBeVisible();
  await expect(page.getByText(/Enviamos um código de 6 dígitos para d•••@example\.com/)).toBeVisible();
  const code = await signInCode(page.request, staff.email);
  const codeInput = page.getByLabel("Código de 6 dígitos");
  await codeInput.fill(code === "000000" ? "111111" : "000000");
  await expect(page.getByText("Código inválido. Você tem mais 4 tentativas.")).toBeVisible();
  await page.screenshot({ path: "test-results/two-factor-step.png", caret: "initial" });
  // Nothing scrolls sideways (the focus ring and the shake stay inside).
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByText("Confiar neste dispositivo por 30 dias").click();
  // Pasted as it reads in an e-mail or a chat ("123 456"): only the digits count.
  await codeInput.evaluate((input, text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, ` ${code.slice(0, 3)} ${code.slice(3)} `);
  await page.waitForURL(/\/app\/stores\/[^/]+/);

  // The quiet invitation in the sidebar: a shield while it is collapsed, a
  // card when open; "Agora não" puts both away.
  const shortcut = page.getByRole("link", { name: "Proteja sua conta" });
  await expect(shortcut).toBeVisible();
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  const prompt = page.getByLabel("Proteger a conta");
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Agora não" }).click();
  await expect(prompt).toBeHidden();
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await expect(shortcut).toBeHidden();

  // Settings: set up the authenticator app with the key shown on screen.
  await page.goto("/app/settings");
  const card = page.locator("#verificacao-em-duas-etapas");
  await expect(card.getByText("Em uso")).toBeVisible();
  await card.getByRole("button", { name: "Configurar" }).click();
  const dialog = page.getByRole("dialog", { name: "App autenticador" });
  // The password first: a session alone can't tie the account to a phone.
  await dialog.getByLabel("Sua senha").fill("wrong-password");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByText("A senha não confere.")).toBeVisible();
  await dialog.getByLabel("Sua senha").fill(staff.password);
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.locator("svg title", { hasText: "QR code do app autenticador" })).toBeAttached();
  await dialog.getByRole("button", { name: "Não consegue escanear? Digite a chave" }).click();
  await expect(dialog.getByLabel("Chave do app autenticador")).toBeVisible();
  await page.screenshot({ path: "test-results/two-factor-scan.png", caret: "initial" });
  const secret = (await dialog.getByLabel("Chave do app autenticador").textContent())!.replace(/\s/g, "");
  await dialog.getByRole("button", { name: "Já adicionei no app" }).click();
  await expect(dialog.getByText(/Novo código em \d+s/)).toBeVisible();
  await page.screenshot({ path: "test-results/two-factor-verify.png", caret: "initial" });
  await dialog.getByLabel("Código de 6 dígitos").fill(totp(secret));
  const codes = dialog.getByRole("list", { name: "Códigos de recuperação" }).getByRole("listitem");
  await expect(codes).toHaveCount(10);
  await page.screenshot({ path: "test-results/two-factor-codes.png", caret: "initial" });
  const done = dialog.getByRole("button", { name: "Concluir" });
  await expect(done).toBeDisabled();
  // Shown only here: Esc doesn't close it before "Guardei".
  await page.keyboard.press("Escape");
  await expect(page.getByText("Guarde os códigos de recuperação antes de fechar.")).toBeVisible();
  await expect(codes).toHaveCount(10);
  await dialog.getByText("Guardei meus códigos de recuperação").click();
  await done.click();
  await expect(dialog).toBeHidden();
  await expect(card.getByText("Ativo", { exact: true })).toBeVisible();
  await expect(card.getByText(/10 códigos de recuperação restantes/)).toBeVisible();
  await card.screenshot({ path: "test-results/two-factor-card.png" });

  // This device is trusted: signing in again skips the second step.
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.waitForURL(/\/app\/login/);
  // No toast for signing out, and the form is ready once it finished.
  await expect(page.getByText("Sessão encerrada com sucesso.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  await page.getByLabel("E-mail").fill(staff.email);
  await page.getByLabel("Senha", { exact: true }).fill(staff.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\/stores\/[^/]+/);

  // Another device asks for the app's code now (no e-mail).
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/app/login");
  await otherPage.getByLabel("E-mail").fill(staff.email);
  await otherPage.getByLabel("Senha", { exact: true }).fill(staff.password);
  await otherPage.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(otherPage.getByText("Digite o código de 6 dígitos do seu app autenticador.")).toBeVisible();
  // The step used to turn it on is spent: the next one signs in.
  await otherPage.getByLabel("Código de 6 dígitos").fill(totp(secret, 1));
  await otherPage.waitForURL(/\/app\/stores\/[^/]+/);
  await other.close();

  // The trusted session shows up as such in the list.
  await page.goto("/app/settings");
  await expect(
    page.getByRole("list", { name: "Sessões" }).getByRole("listitem").first().getByText("Confiável")
  ).toBeVisible();
  // `login` (fixture) still works for accounts with e-mail codes.
  expect(login).toBeTruthy();
});

test("back from Google without a pending second step: the login page says so", async ({ page }) => {
  await page.goto("/app/login?etapa=codigo");
  const alert = page.getByRole("alert").filter({ hasText: "Login com o Google não concluído" });
  await expect(alert).toContainText("Este acesso expirou");
  await expect(page.getByLabel("E-mail")).toBeEnabled();
});
