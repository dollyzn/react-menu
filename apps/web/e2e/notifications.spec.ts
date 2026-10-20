import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login, createStoreViaApi } from "./fixtures";
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
  await page.goto(`/app/stores/${store.id}`);
  await page.waitForLoadState("networkidle");

  const colleagueApi = await playwrightRequest.newContext({ baseURL: API_URL });
  await colleagueApi.post("/api/v1/auth/login", { data: colleague });
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
