import sharp from "sharp";
import { test, expect } from "./fixtures";
import { API_URL } from "../playwright.config";

test("robots.txt and the sitemap point search engines at the menus only", async ({ page }) => {
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app/");
  expect(robots).toContain("Disallow: /pedido/");
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);

  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu?preview=1`)).json()).data;
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>");
  expect(sitemap).toMatch(/\/privacy<\/loc>/);
  // The default store is listed once, at "/" (not also at /<slug>).
  expect(sitemap).not.toContain(`/${menu.store.slug}</loc>`);
});

test("a store's menu has full metadata, a share image and structured data", async ({ page }) => {
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu?preview=1`)).json()).data;
  const { store } = menu;

  await page.goto("/", { timeout: 30_000 });
  await expect(page).toHaveTitle(`${store.name} · Cardápio`);
  const meta = (selector: string) => page.locator(selector).first().getAttribute("content");
  expect(await meta('meta[name="description"]')).toContain("retire no balcão");
  expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).pathname).toBe("/");
  expect(await meta('meta[property="og:title"]')).toBe(`${store.name} · Cardápio`);
  expect(await meta('meta[property="og:site_name"]')).toBe(store.name);
  expect(await meta('meta[property="og:locale"]')).toBe("pt_BR");
  expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");

  // The share image (WhatsApp, Google) is generated for the store.
  const ogImage = await meta('meta[property="og:image"]');
  const image = await page.request.get(new URL(ogImage!).pathname + new URL(ogImage!).search);
  expect(image.headers()["content-type"]).toBe("image/png");
  const { width, height } = await sharp(await image.body()).metadata();
  expect([width, height]).toEqual([1200, 630]);

  // schema.org Restaurant with the menu and BRL prices.
  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(jsonLd["@type"]).toBe("Restaurant");
  expect(jsonLd.name).toBe(store.name);
  expect(jsonLd.hasMenu.hasMenuSection.length).toBeGreaterThan(0);
  expect(jsonLd.hasMenu.hasMenuSection[0].hasMenuItem[0].offers.priceCurrency).toBe("BRL");

  // The default store at /<slug> is the same page: its canonical is "/".
  await page.goto(`/${store.slug}`);
  expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).pathname).toBe("/");
});

test("the panel is kept out of search results", async ({ page }) => {
  await page.goto("/app/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
