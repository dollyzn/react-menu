import { test, expect, login } from "./fixtures";
import { API_URL } from "../playwright.config";
import type { Browser, Page } from "@playwright/test";

const HIDE_DEV = "nextjs-portal{display:none!important} [data-sonner-toaster]{display:none!important}";

async function shot(browser: Browser, url: string, file: string, width: number, height: number, staff = false, prep?: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: "light" });
  const page = await context.newPage();
  if (staff) await login(page);
  await page.goto(url);
  await page.addStyleTag({ content: HIDE_DEV });
  if (prep) await prep(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `public/screenshots/${file}`, caret: "initial", animations: "disabled" });
  await context.close();
}

async function installability(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  const { url, errors, data } = await cdp.send("Page.getAppManifest");
  return { installabilityErrors, url, errors, manifest: JSON.parse(data ?? "{}") };
}

/**
 * Both apps (customer "/" and staff "/app/") must stay installable: Chromium
 * reports why not via DevTools. With PWA_SCREENSHOTS=1 it also regenerates
 * the manifest screenshots in public/screenshots.
 */
test("customer and staff apps are installable", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const customer = await installability(page);
  expect(customer.url).toMatch(/\/manifest\.webmanifest$/);
  expect(customer.manifest.name).toBe("JJ Pastéis · Cardápio");

  await login(page);
  const staff = await installability(page);
  expect(staff.url).toMatch(/\/app\/manifest\.webmanifest$/);
  expect(staff.manifest.scope).toBe("/app/");
  const storePath = new URL(page.url()).pathname.replace(/\/$/, "");

  expect(customer.installabilityErrors).toEqual([]);
  expect(staff.installabilityErrors).toEqual([]);

  if (!process.env.PWA_SCREENSHOTS) return;

  await shot(browser, "/", "menu-narrow.png", 390, 844);
  await shot(browser, "/", "menu-wide.png", 1280, 720);
  await shot(browser, `${storePath}/pos`, "staff-wide.png", 1280, 720, true, async (p) => {
    for (const name of [/^Pastel de Carne R\$/, /^Pastel de Queijo R\$/, /^Pastel de Frango R\$/]) {
      await p.getByRole("button", { name }).click();
      if (await p.getByRole("dialog").isVisible()) await p.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
    }
    await p.getByLabel("Nome do cliente").fill("Mesa 4");
  });
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json()).data;
  const items = menu.categories.flatMap((c: { items: { id: string; addons: unknown[] }[] }) => c.items);
  for (const [name, picks] of [["Ana", [0, 1]], ["Bruno", [2]], ["Carla", [3, 4, 5]]] as const) {
    await page.request.post(`${API_URL}/api/v1/public/menu/${menu.store.slug}/orders`, {
      data: {
        lines: picks.map((i) => ({ itemId: items[i].id, quantity: 1 + (i % 2) })),
        customer: { name, phone: "11999990000" },
        paymentMethod: "counter",
      },
    });
  }
  await shot(browser, `${storePath}/orders`, "staff-narrow.png", 390, 844, true);
});
