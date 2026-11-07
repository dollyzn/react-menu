import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login, createStoreViaApi, apiSignIn } from "./fixtures";
import { API_URL } from "../playwright.config";

test("store members are notified in realtime when the status changes", async ({ page }) => {
  const store = await createStoreViaApi(page, "Realtime");

  // A colleague linked to the same store (created by the seeded super user).
  const colleague = { email: `colleague-${Date.now()}@example.com`, password: "colleague123" };
  const created = await page.request.post(`${API_URL}/api/v1/users`, {
    data: { name: "Bruno", ...colleague },
  });
  const colleagueId = (await created.json()).data.id;
  await page.request.put(`${API_URL}/api/v1/users/${colleagueId}`, {
    data: { name: "Bruno", email: colleague.email, storeIds: [store.id] },
  });

  await page.context().clearCookies();
  await login(page);
  // The toast only arrives once this page is subscribed to the notifications
  // channel; networkidle doesn't guarantee that on a slow runner.
  const subscribed = page.waitForResponse(
    (r) =>
      r.url().includes("/__transmit/subscribe") &&
      (r.request().postData() ?? "").includes("/notifications") &&
      r.ok()
  );
  await page.goto(`/app/stores/${store.id}`);
  await subscribed;

  const colleagueApi = await playwrightRequest.newContext({ baseURL: API_URL });
  await apiSignIn(colleagueApi, colleague);
  const patch = await colleagueApi.patch(`/api/v1/stores/${store.id}/status`, {
    data: { status: "open" },
  });
  expect(patch.ok()).toBeTruthy();
  await colleagueApi.dispose();

  // Realtime toast...
  await expect(page.getByText("Realtime está aberta").first()).toBeVisible();

  // ...and the persisted notification in the popover.
  await page.getByRole("button", { name: /Notificações \(\d+ não lidas?\)/ }).click();
  await expect(
    page.getByRole("dialog").getByText("Bruno alterou o status da loja para aberta.")
  ).toBeVisible();
});

test("the popover filters and marks as read; preferences save per type and store", async ({ page }) => {
  await createStoreViaApi(page, "Preferências");
  await page.goto("/app/settings#notificacoes");
  const orders = page.getByRole("switch", { name: "Novos pedidos: e-mail" });
  await expect(orders).not.toBeChecked();
  await orders.click();
  await expect(orders).toBeChecked();
  const mute = page.getByRole("switch", { name: "Notificações da Preferências" });
  await expect(mute).toBeChecked();
  await mute.click();
  await expect(mute).not.toBeChecked();

  // Saved on the server: a reload shows the same choice.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Novos pedidos: e-mail" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Notificações da Preferências" })).not.toBeChecked();

  await page.getByRole("button", { name: /Notificações/ }).first().click();
  const popover = page.getByRole("dialog");
  await popover.getByRole("button", { name: /^Não lidas/ }).click();
  const markAll = popover.getByRole("button", { name: "Marcar todas como lidas" });
  if (await markAll.isEnabled()) await markAll.click();
  await expect(popover.getByText("Tudo em dia").first()).toBeVisible();
  await popover.getByRole("button", { name: "Todas", exact: true }).click();
  await expect(popover.getByRole("switch", { name: "Notificações push neste aparelho" })).toBeVisible();
});
