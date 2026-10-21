import { test, expect, login, DEMO_STAFF } from "./fixtures";

test("leaving while a save is in flight waits for it, then continues", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, DEMO_STAFF.attendant);
  await page.goto(page.url().replace(/\/orders$/, "/pos"));

  // A slow connection: the order takes a while to reach the API.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/v1\/stores\/[^/]+\/orders$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await held;
    await route.continue();
  });

  await page.getByRole("button", { name: /^Pastel de Carne R\$/ }).click();
  if (await page.getByRole("dialog").isVisible()) {
    await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  }
  await page.getByLabel("Nome do cliente").fill("Guarda de navegação");
  await page.getByRole("button", { name: "Enviar para a cozinha" }).click();

  // Trying to leave while it is saving: held, with an explanation.
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  const guard = page.getByRole("alertdialog");
  await expect(guard.getByText("Salvando suas alterações…")).toBeVisible();
  await expect(page).toHaveURL(/\/pos$/);

  // Saved: it goes on by itself.
  release();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(guard).toBeHidden();
});
