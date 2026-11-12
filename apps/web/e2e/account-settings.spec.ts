import path from "node:path";
import { test, expect, login, createStoreViaApi } from "./fixtures";
import { API_URL } from "../playwright.config";

const PHOTO = path.join(__dirname, "../public/login-marquee/pos-light.webp");

test("settings: profile, photo, password and the sessions of other devices", async ({ page, browser, consoleEntries }) => {
  // A fresh account (with a store), so changing its password affects no other test.
  const store = await createStoreViaApi(page, "Conta");
  const staff = { name: "Bia Lima", email: `bia-${Date.now()}@example.com`, password: "bia-12345" };
  const created = await page.request.post(`${API_URL}/api/v1/users`, { data: staff });
  expect(created.ok()).toBeTruthy();
  const userId = (await created.json()).data.id as string;
  await page.request.post(`${API_URL}/api/v1/stores/${store.id}/members`, {
    data: { email: staff.email, role: "manager" },
  });
  await page.context().clearCookies();

  // The same account opened on a "phone" too.
  const phone = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1" });
  const phonePage = await phone.newPage();
  await login(phonePage, staff);

  await login(page, staff);
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "Segurança" })).toBeVisible();

  // Name: "Salvar" only once something changed.
  const save = page.getByRole("button", { name: "Salvar", exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel("Nome").fill("Bia Lima Souza");
  await save.click();
  await expect(page.getByText("Perfil atualizado")).toBeVisible();

  // Photo: uploaded square and small, then removed (back to the generated one).
  await page.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(page.getByText("Foto atualizada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remover" })).toBeVisible();
  const me = await (await page.request.get(`${API_URL}/api/v1/auth/me`)).json();
  expect(me.data.user.avatarUrl).toMatch(/\/uploads\/avatars\/.+\.webp$/);
  expect(me.data.user.name).toBe("Bia Lima Souza");
  expect(me.data.user.avatarBlur).toMatch(/^data:image\/webp;base64,/);
  // The blurred preview is only for while it loads: a photo that fails
  // shows the initials, never the blur for good.
  await page.route(/\/uploads\/avatars\//, (route) => route.fulfill({ status: 404, body: "" }));
  await page.reload();
  const trigger = page.getByRole("button", { name: "Trocar foto de perfil" });
  await expect(trigger).toContainText("BS");
  await page.unroute(/\/uploads\/avatars\//);
  // That 404 was on purpose: drop it from the broken-image check.
  const forced = consoleEntries.filter((entry) => entry.type === "image" && entry.text.includes("/uploads/avatars/"));
  for (const entry of forced) consoleEntries.splice(consoleEntries.indexOf(entry), 1);
  await page.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByText("Foto removida")).toBeVisible();

  // Sessions: this one is marked; the phone can be signed out from here.
  const sessions = page.getByRole("list", { name: "Sessões" });
  await expect(sessions.getByRole("listitem")).toHaveCount(2);
  await expect(sessions.getByRole("listitem").first()).toContainText("Este dispositivo");
  await page.screenshot({ path: "test-results/settings.png", fullPage: true, caret: "initial" });
  const phoneRow = sessions.getByRole("listitem", { name: /iOS/ });
  await expect(phoneRow).toContainText("Safari");
  await phoneRow.getByRole("button", { name: "Encerrar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Encerrar sessão" }).click();
  await expect(sessions.getByRole("listitem")).toHaveCount(1);
  expect((await phonePage.request.get(`${API_URL}/api/v1/auth/me`)).status()).toBe(401);
  await phone.close();

  // Password: the current one is checked; the new one works afterwards.
  await page.getByLabel("Senha atual", { exact: true }).fill("wrong-one");
  await page.getByLabel("Nova senha", { exact: true }).fill("bia-novasenha-1");
  await page.getByLabel("Confirme a nova senha").fill("bia-novasenha-1");
  await page.getByRole("button", { name: "Alterar senha" }).click();
  await expect(page.getByText("A senha atual não confere.")).toBeVisible();
  await page.getByLabel("Senha atual", { exact: true }).fill(staff.password);
  await page.getByRole("button", { name: "Alterar senha" }).click();
  await expect(page.getByText("Senha alterada")).toBeVisible();
  await expect(page.getByLabel("Senha atual", { exact: true })).toHaveValue("");

  await page.context().clearCookies();
  await login(page, { email: staff.email, password: "bia-novasenha-1" });
  expect(userId).toBeTruthy();
});
