import { test, expect, login } from "./fixtures";

test("inventory: cards by default, paginated, searchable, counts and low-stock filter", async ({ page }) => {
  await login(page);
  const storePath = new URL(page.url()).pathname.match(/^\/app\/stores\/[^/]+/)![0];
  await page.goto(`${storePath}/inventory`);

  // Card view by default and one page at a time (the demo has more than 10).
  await expect(page.getByRole("article", { name: "Azeitona" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(10);

  await page.getByRole("button", { name: "Filtrar por ingrediente" }).click();
  await page.getByPlaceholder("Digite para filtrar...").fill("carne");
  await page.getByRole("button", { name: "Aplicar filtro" }).click();
  await expect(page).toHaveURL(/f\.name=carne/);
  const card = page.getByRole("article", { name: "Carne moída" });
  await expect(card).toBeVisible();
  await expect(page.getByRole("article", { name: "Azeitona" })).toBeHidden();

  // A count below the minimum (1,5 kg) flags it as running low.
  await card.getByRole("button", { name: "Contar: Carne moída" }).click();
  await page.getByLabel(/Quantidade contada agora/).fill("1000");
  await page.getByRole("button", { name: "Salvar contagem" }).click();
  await expect(card).toContainText("1 kg");
  await expect(card.getByText("Acabando")).toBeVisible();

  await page.getByRole("button", { name: /^Acabando \(\d+\)$/ }).click();
  await expect(page).toHaveURL(/f\.stock(%5B%5D|\[\])=low/);
  await expect(card).toBeVisible();
});
