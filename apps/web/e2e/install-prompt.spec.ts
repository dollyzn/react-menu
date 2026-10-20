import type { Page } from "@playwright/test";
import { test, expect, login } from "./fixtures";

/** Chromium fires beforeinstallprompt on its own only for real installable visits; fake it. */
async function offerInstall(page: Page, outcome: "accepted" | "dismissed" = "accepted") {
  await page.evaluate((choice) => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & Record<string, unknown>;
    event.prompt = async () => {
      (window as unknown as { __prompted: boolean }).__prompted = true;
    };
    event.userChoice = Promise.resolve({ outcome: choice, platform: "web" });
    window.dispatchEvent(event);
  }, outcome);
}

test("customers are invited to install on a returning visit, and 'not now' sticks", async ({ page, context }) => {
  await page.goto("/");
  await offerInstall(page);
  await expect(page.getByText("Peça mais rápido pelo app")).toHaveCount(0);

  // A new tab is a new session: second visit.
  const again = await context.newPage();
  await again.goto("/");
  await expect(again.getByRole("heading", { name: "JJ Pastéis", level: 1 })).toBeVisible();
  await offerInstall(again);
  const card = again.getByRole("complementary", { name: "Instalar o app" });
  await expect(card).toBeVisible();
  await again.waitForTimeout(600);
  await again.screenshot({ path: "test-results/install-card-menu.png", caret: "initial" });

  await card.getByRole("button", { name: "Agora não" }).click();
  await expect(card).toHaveCount(0);

  await again.reload();
  await offerInstall(again);
  await expect(again.getByRole("heading", { name: "JJ Pastéis", level: 1 })).toBeVisible();
  await expect(again.getByRole("complementary", { name: "Instalar o app" })).toHaveCount(0);
});

test("staff can install the panel from the user menu", async ({ page }) => {
  await login(page);
  await offerInstall(page);
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Instalar app" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
  await expect(page.getByText("App instalado!")).toBeVisible();
});
