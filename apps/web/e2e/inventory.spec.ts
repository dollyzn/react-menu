import { test, expect, login } from "./fixtures";

test("inventory: cards by default, paginated, searchable, counts and low-stock filter", async ({ page }) => {
  await login(page);
  const storePath = new URL(page.url()).pathname.match(/^\/app\/stores\/[^/]+/)![0];
  await page.goto(`${storePath}/inventory`);

  // Card view by default and one page at a time (the demo has more than 10).
  await expect(page.getByRole("article", { name: "Azeitona" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(10);

  await page.getByRole("searchbox", { name: "Buscar por ingrediente" }).fill("carne");
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

test("an ingredient's badge: automatic from the name, then an icon found by search, a color and a tag", async ({
  page,
}) => {
  await login(page);
  const storePath = new URL(page.url()).pathname.match(/^\/app\/stores\/[^/]+/)![0];
  await page.goto(`${storePath}/inventory`);
  const name = `Catupiry ${Date.now().toString(36)}`;

  await page.getByRole("button", { name: "Novo ingrediente" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill(name);
  // The automatic badge follows the name: Catupiry gets its own tag.
  const tag = dialog.getByLabel("Sigla");
  await expect(tag).toHaveAttribute("placeholder", "CAT");
  await expect(dialog.getByText("Automático pelo nome")).toBeVisible();

  await dialog.getByRole("searchbox", { name: "Buscar ícone" }).fill("batata");
  await dialog.getByRole("radio", { name: "Batata frita" }).click();
  await expect(dialog.getByRole("radio", { name: "Batata frita" })).toBeChecked();
  await dialog.getByRole("radio", { name: "Rosa" }).click();
  await tag.fill("cp!");
  await expect(tag).toHaveValue("CP");
  await expect(dialog.getByText("Personalizado")).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await page.getByRole("searchbox", { name: "Buscar por ingrediente" }).fill(name);
  const card = page.getByRole("article", { name });
  await expect(card).toContainText("🍟");
  await expect(card).toContainText("CP");

  // Back to automatic: the name decides again.
  await card.getByRole("button", { name: `Ações de ${name}` }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await dialog.getByRole("button", { name: "Voltar ao automático" }).click();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(card).toContainText("🧀");
  await expect(card).toContainText("CAT");
});
