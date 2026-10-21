import { test, expect, login } from "./fixtures";

test("panel layout: grouped sidebar, router breadcrumbs, theme and settings", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.context().addCookies([{ name: "sidebar_state", value: "true", url: "http://localhost:3100" }]);
  await login(page);

  // Grouped navigation.
  const sidebar = page.locator("[data-slot=sidebar]").first();
  for (const group of ["Operação", "Cardápio", "Gestão"]) await expect(sidebar.getByText(group, { exact: true })).toBeVisible();

  // Breadcrumb links use the router: no full reload (the window marker survives).
  await sidebar.getByRole("link", { name: "Itens" }).click();
  await expect(page.getByRole("heading", { name: "Itens", level: 1 })).toBeVisible();
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  await breadcrumb.getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "Loja", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

  // Theme from the account menu.
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("radio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Claro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  // Settings page from the same menu.
  await page.getByRole("menuitem", { name: "Configurações" }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: /Escuro/ }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: "test-results/layout-settings.png" });
  await page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: /Claro/ }).click();
  await page.screenshot({ path: "test-results/layout-items.png" });
});
