import path from "node:path";
import { test, request as playwrightRequest, type Page } from "@playwright/test";
import sharp from "sharp";
import { login } from "./fixtures";
import { API_URL, E2E_ADMIN } from "../playwright.config";

/**
 * Regenerates the screenshots in the login page's 3D marquee
 * (public/login-marquee, see app/app/(auth)/login/components/animated-background.tsx)
 * from the e2e demo data. Not part of the suite (and without its console
 * checks), run it from apps/web:
 *
 *   CAPTURE_MARQUEE=1 pnpm exec playwright test marquee-screenshots
 */
test.skip(!process.env.CAPTURE_MARQUEE, "only when regenerating the login marquee");

// The marquee tiles are 970×700.
const VIEWPORT = { width: 970, height: 700 };
const OUT_DIR = path.join(__dirname, "../public/login-marquee");

const CUSTOMERS = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Felipe Nunes"];

async function placeOrders() {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const items = menu.categories.flatMap((category: { items: { id: number }[] }) => category.items);
  let token = "";
  for (const [index, name] of CUSTOMERS.entries()) {
    const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
      data: {
        lines: [
          { itemId: items[index % items.length].id, quantity: 1 + (index % 3) },
          { itemId: items[(index + 3) % items.length].id, quantity: 1 },
        ],
        customer: { name, phone: `1199${String(1000000 + index).slice(1)}0` },
        paymentMethod: "counter",
      },
    });
    token = (await placed.json()).data.publicToken;
  }
  await api.dispose();
  return { storeId: menu.store.id as string, token };
}

/** Moves the first kitchen batch along so the board shows ready orders too. */
async function prepareSome(storeId: string) {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await api.post("/api/v1/auth/login", { data: E2E_ADMIN });
  const queue = (await (await api.get(`/api/v1/stores/${storeId}/kitchen/queue`)).json()).data as {
    units: { lineId: number; quantity: number }[];
  }[];
  const units = queue.slice(0, 2).flatMap((batch) => batch.units);
  if (units.length) await api.post(`/api/v1/stores/${storeId}/kitchen/prepare`, { data: { units } });
  await api.dispose();
}

async function capture(page: Page, name: string) {
  // Next's dev badge isn't part of the app.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(1200);
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 72 }).toFile(path.join(OUT_DIR, `${name}.webp`));
}

test("capture the login marquee screenshots", async ({ page }) => {
  test.setTimeout(240_000);
  const { storeId, token } = await placeOrders();
  await prepareSome(storeId);
  await page.setViewportSize(VIEWPORT);

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });

    await page.goto("/");
    await capture(page, `menu-${scheme}`);
    await page.getByRole("button", { name: /^Pastel de Carne/ }).first().click();
    await capture(page, `item-${scheme}`);
    await page.keyboard.press("Escape");

    await page.goto(`/pedido/${token}`, { timeout: 30_000 });
    await capture(page, `tracking-${scheme}`);
  }

  await login(page);
  const sections = ["overview", "orders", "pos", "kitchen", "items", "inventory", "categories", "members"];
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const section of sections) {
      await page.goto(`/app/stores/${storeId}/${section}`, { timeout: 30_000 });
      await capture(page, `${section}-${scheme}`);
    }
  }
});
