import type { Page } from "@playwright/test";
import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login } from "./fixtures";
import { API_URL } from "../playwright.config";

async function shot(page: Page, name: string) {
  if (!process.env.SHOTS) return;
  if (process.env.SHOTS_SCHEME === "dark") await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
}

test("desktop tables: the search is a field, filters are always there and the pages are numbered", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await login(page);
  const store = page.url().match(/\/app\/stores\/[^/?#]+/)![0];
  await page.goto(`${store}/items`);

  // "/" focuses the search; no "Mostrar filtros" any more.
  const search = page.getByRole("searchbox", { name: "Buscar por nome" });
  await expect(search).toBeVisible();
  await expect(page.getByRole("button", { name: /filtros/i })).toHaveCount(0);
  await page.locator("body").press("/");
  await expect(search).toBeFocused();
  await search.blur();

  // "1–10 de N", pages by number; a new page shows its range.
  const range = page.getByText(/^\d+–\d+ de \d+$/);
  await expect(range).toHaveText(/^1–10 de \d+$/);
  const total = Number((await range.textContent())!.split(" de ")[1]);
  await shot(page, "desktop-table-1-items");
  await page.getByRole("button", { name: "Página 2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(range).toHaveText(`11–20 de ${total}`);
  await expect(page.getByRole("button", { name: "Página 2", exact: true })).toHaveAttribute("aria-current", "page");

  // A filter beside the search; "Limpar filtros" while one is set.
  await page.getByRole("button", { name: "Filtrar por categoria" }).click();
  await shot(page, "desktop-table-4-popover");
  await page.getByRole("option", { name: /^Bebidas/ }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/f\.category\.name/);
  await expect(page).not.toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/f\.category\.name/);

  // No results: one empty state, which clears the search and filters.
  await search.fill("zzzz-nada");
  await expect(page.getByText("Nenhum resultado para essa busca")).toBeVisible();
  await shot(page, "desktop-table-2-empty");
  await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
  await expect(search).toHaveValue("");
  await expect(range).toHaveText(`1–10 de ${total}`);
});

test("desktop tables: a row that opens something takes the keyboard", async ({ page }) => {
  // Two orders, so there are rows to move between.
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu")).json()).data;
  const item = menu.categories.flatMap((c: { items: { id: string; available?: boolean }[] }) => c.items)[0];
  for (const name of ["Teclado Um", "Teclado Dois"]) {
    await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
      data: { lines: [{ itemId: item.id, quantity: 1 }], customer: { name, phone: "11955554444" }, paymentMethod: "counter" },
    });
  }
  await api.dispose();

  await page.setViewportSize({ width: 1280, height: 860 });
  await login(page);
  const store = page.url().match(/\/app\/stores\/[^/?#]+/)![0];
  await page.goto(`${store}/orders?view=historico`);
  // Switch to the table if the history opens on cards here.
  const toTable = page.getByRole("button", { name: "Exibir como tabela" });
  if (await toTable.isVisible()) await toTable.click();
  const first = page.locator("tbody tr[tabindex='0']").first();
  await expect(first).toBeVisible();
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("tbody tr[tabindex='0']").nth(1)).toBeFocused();
  await shot(page, "desktop-table-3-history");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/pedido=/);
});

test("desktop tables: the first and last columns stay while the rest scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await login(page);
  const store = page.url().match(/\/app\/stores\/[^/?#]+/)![0];
  await page.goto(`${store}/items`);
  const toTable = page.getByRole("button", { name: "Exibir como tabela" });
  if (await toTable.isVisible()) await toTable.click();
  const headers = page.locator("thead th");
  await expect(headers.first()).toBeVisible();
  const first = headers.first();
  const last = headers.last();
  await expect(first).toHaveCSS("position", "sticky");
  await expect(last).toHaveCSS("position", "sticky");

  // Scrolled sideways: the pinned columns draw a line, and the header keeps its own.
  await page.locator("[data-slot=scroll-area-viewport]").first().evaluate((el) => (el.scrollLeft = 200));
  // The innermost pinned header (the name) draws the line, and keeps the header's.
  const innermost = headers.nth(1);
  await expect
    .poll(() => innermost.evaluate((el) => getComputedStyle(el).boxShadow.split("inset").length - 1))
    .toBe(2);
  await shot(page, "desktop-table-5-pinned");
  // Items pin the name too, right after the checkbox.
  const name = headers.nth(1);
  await expect(name).toHaveCSS("position", "sticky");
  const nameBox = await name.boundingBox();
  const box = await first.boundingBox();
  expect(Math.abs(nameBox!.x - (box!.x + box!.width))).toBeLessThan(2);
  const viewport = await page.locator("[data-slot=scroll-area-viewport]").first().boundingBox();
  expect(Math.abs(box!.x - viewport!.x)).toBeLessThan(2);
});
