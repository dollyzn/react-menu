import type { Page } from "@playwright/test";
import { test, expect, login } from "./fixtures";

const PHONE = { width: 390, height: 844 };

async function shot(page: Page, name: string) {
  if (!process.env.SHOTS) return;
  if (process.env.SHOTS_SCHEME === "dark") await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
}

test("phones: the table's search stays on screen, filters live in a drawer and the list grows", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await login(page);
  const store = page.url().match(/\/app\/stores\/[^/?#]+/)![0];
  await page.goto(`${store}/items`);

  // The search is a field, not a button; the page buttons are gone.
  const search = page.getByRole("searchbox", { name: "Buscar por nome" });
  await expect(search).toBeVisible();
  await expect(page.getByRole("button", { name: "Ir para a próxima página" })).toHaveCount(0);
  const count = page.getByText(/^\d+ resultados?$/);
  await expect(page.getByText(/^Mostrando \d+ de \d+$/)).toBeVisible();
  const total = Number((await count.textContent())!.match(/\d+/)![0]);
  expect(total).toBeGreaterThan(10);
  await expect(page.getByText(`Mostrando 10 de ${total}`)).toBeVisible();
  await shot(page, "mobile-table-1-list");

  // "Carregar mais": the same list, longer, kept in the URL.
  await page.getByRole("button", { name: /^Carregar mais \d+$/ }).click();
  await expect(page.getByText(`Mostrando ${Math.min(30, total)} de ${total}`)).toBeVisible();
  await expect(page).toHaveURL(/size=30/);
  if (process.env.SHOTS) {
    await page.getByText(/^Mostrando \d+ de \d+$/).scrollIntoViewIfNeeded();
    await shot(page, "mobile-table-1b-more");
  }

  // Filters from the page's own config, applied as they are picked.
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros" });
  const categories = drawer.getByRole("group", { name: "Categoria" });
  const first = categories.getByRole("button").first();
  // The option reads "Bebidas 12": the name, then how many items it would show.
  const category = (await first.textContent())!.replace(/\s*\d+$/, "").trim();
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await shot(page, "mobile-table-2-drawer");
  await drawer.getByRole("button", { name: /^Ver \d+ resultados?$/ }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/f\.category\.name/);
  const chip = page.getByRole("button", { name: `Tirar o filtro Categoria: ${category}` });
  await expect(chip).toBeVisible();
  await expect(page.getByRole("button", { name: "Filtros (1 em uso)" })).toBeVisible();
  await shot(page, "mobile-table-3-chip");

  // ✕ on the chip takes it off.
  await chip.click();
  await expect(chip).toBeHidden();
  await expect(page).not.toHaveURL(/f\.category\.name/);

  // Typing searches after a pause; clearing shows everything again.
  await search.fill("carne");
  await expect(page).toHaveURL(/f\.name=carne/);
  // A new search starts from the first size again (it doesn't ask for all loaded before).
  await expect(page).not.toHaveURL(/size=/);
  await expect(count).not.toHaveText(`${total} resultados`);
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(count).toHaveText(`${total} resultados`);
});

test("phones: the history's period and sorting in the drawer", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await login(page);
  const store = page.url().match(/\/app\/stores\/[^/?#]+/)![0];
  await page.goto(`${store}/orders?view=historico`);
  await expect(page.getByRole("searchbox", { name: "Buscar por número, cliente ou telefone" })).toBeVisible();

  // Sorting shows what is in use and changes from its own drawer.
  const sort = page.getByRole("button", { name: "Ordenar: Data, mais recentes" });
  await sort.click();
  const sorting = page.getByRole("dialog", { name: "Ordenar" });
  // The direction belongs to the chosen column, in its own words.
  await expect(sorting.getByRole("radio", { name: "Data" })).toHaveAttribute("aria-checked", "true");
  await sorting.getByRole("button", { name: "Mais antigos" }).click();
  await shot(page, "mobile-table-4-sort");
  await sorting.getByRole("button", { name: /^Ver / }).click();
  await expect(page).toHaveURL(/sort=createdAt\.asc/);
  await expect(page.getByRole("button", { name: "Ordenar: Data, mais antigos" })).toBeVisible();

  // The period: the same quick periods; the calendar on demand.
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros" });
  await drawer.getByRole("button", { name: "Últimos 30 dias" }).click();
  await drawer.getByRole("button", { name: /^Escolher datas/ }).click();
  await expect(drawer.getByRole("grid")).toBeVisible();
  await drawer.getByRole("group", { name: "Status" }).getByRole("button").first().click();
  await shot(page, "mobile-table-5-period");
  await drawer.getByRole("button", { name: /^Ver / }).click();
  await expect(page).toHaveURL(/f\.createdAt=/);
  await expect(page.getByRole("list", { name: "Filtros em uso" }).getByRole("button")).toHaveCount(3); // 2 chips + "Limpar tudo"
  await shot(page, "mobile-table-6-chips");

  await page.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(page.getByRole("list", { name: "Filtros em uso" })).toBeHidden();
});

test("phones: a failed \"Carregar mais\" says so and tries again", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await login(page);
  const store = page.url().match(/\/app\/stores\/[^/?#]+/)![0];
  // The next step fails once (422: not retried by the client).
  let failures = 0;
  await page.route(/\/api\/v1\/stores\/[^/]+\/items\?.*perPage=30/, async (route) => {
    if (failures++ > 0) return route.fallback();
    await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ message: "falhou" }) });
  });
  await page.goto(`${store}/items`);
  await expect(page.getByText(/^Mostrando 10 de \d+$/)).toBeVisible();

  await page.getByRole("button", { name: /^Carregar mais \d+$/ }).click();
  await expect(page.getByText("Não deu para carregar mais.")).toBeVisible();
  // Never stuck on "Carregando mais…".
  await expect(page.getByText("Carregando mais…")).toBeHidden();

  // Back to the rows on screen; the end of the list is in view, so it asks again by itself.
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByText(/^Mostrando (30|50) de \d+$/)).toBeVisible();
  expect(failures).toBeGreaterThan(1);
});

test("phones: a table with only a search has no filters drawer, just the view switch", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await login(page);
  const store = page.url().match(/\/app\/stores\/[^/?#]+/)![0];
  await page.goto(`${store}/categories`);
  await expect(page.getByRole("searchbox", { name: "Buscar por nome" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Filtros/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Exibir como tabela" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Exibir como cartões" }).click();
  await expect(page.getByRole("table")).toBeHidden();
});
