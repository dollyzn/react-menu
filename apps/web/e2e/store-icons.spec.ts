import sharp from "sharp";
import { test, expect, login, createStoreViaApi } from "./fixtures";
import { API_URL } from "../playwright.config";

test("the store's logo becomes the favicon and the PWA icons, in the menu and the panel", async ({ page }) => {
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu?preview=1`)).json()).data;
  const { slug, name, id } = menu.store;

  // Generated from the logo, at the right sizes.
  for (const [file, size] of [
    ["favicon-32.png", 32],
    ["apple-touch-icon.png", 180],
    ["icon-512.png", 512],
    ["icon-maskable-512.png", 512],
  ] as const) {
    const response = await page.request.get(`/icons/store/${slug}/${file}`);
    expect(response.headers()["content-type"]).toBe("image/png");
    const meta = await sharp(await response.body()).metadata();
    expect([meta.width, meta.height]).toEqual([size, size]);
  }

  // The menu's head points at them and at the store's manifest.
  await page.goto(`/${slug}`, { timeout: 30_000 });
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", new RegExp(`/icons/store/${slug}/`));
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBe(`/${slug}/manifest.webmanifest`);
  const manifest = await (await page.request.get(manifestHref!)).json();
  expect(manifest.name).toBe(`${name} · Cardápio`);
  expect(manifest.start_url).toBe(`/${slug}?source=pwa`);
  expect(manifest.icons.map((icon: { src: string }) => icon.src).join()).toContain(`/icons/store/${slug}/`);

  // Inside the store's panel too.
  await login(page);
  await page.goto(`/app/stores/${id}/orders`);
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", new RegExp(`/icons/store/${slug}/`));
  const panelHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(panelHref).toBe(`/app/manifest.webmanifest?store=${slug}`);
  const panel = await (await page.request.get(panelHref!)).json();
  expect(panel.name).toBe(`${name} · Painel`);
  expect(panel.id).toBe("/app/");
});

test("a store without a logo keeps the app's icons", async ({ page }) => {
  const store = await createStoreViaApi(page, "Sem Logo");
  const { slug } = (await (await page.request.get(`${API_URL}/api/v1/stores/${store.id}`)).json()).data;

  const icon = await page.request.get(`/icons/store/${slug}/icon-512.png`, { maxRedirects: 0 });
  expect(icon.status()).toBe(307);
  expect(icon.headers().location).toContain("/icons/icon-512.png");
});
