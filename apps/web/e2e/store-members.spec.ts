import { test, expect, login } from "./fixtures";
import { API_URL } from "../playwright.config";

test("team: invite someone, change their role, switch access off and on, remove them", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // The demo store (other tests create stores; login may land on one).
  const menu = await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json();
  await login(page);
  await page.goto(`/app/stores/${menu.data.store.id}`);
  await page.getByRole("link", { name: "Equipe" }).click();
  await expect(page.getByRole("heading", { name: "Equipe" })).toBeVisible();

  // The demo staff is already there.
  const team = page.getByRole("list", { name: "Membros da equipe" });
  await expect(team.getByText("atendente@jjpasteis.dev")).toBeVisible();
  // Signed in right now: online.
  await expect(team.getByRole("listitem").filter({ hasText: "Você" }).getByText("Online agora")).toBeVisible();

  const email = `nova.pessoa.${Date.now()}@example.com`;
  await page.getByRole("button", { name: "Adicionar pessoa" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("E-mail").fill(email);
  await dialog.getByLabel("Nome (opcional)").fill("Nova Pessoa");
  await dialog.getByText("Cozinha", { exact: true }).click();
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(`Convite enviado para ${email}`)).toBeVisible();

  const row = team.getByRole("listitem", { name: "Nova Pessoa" });
  await expect(row.getByRole("combobox", { name: "Função de Nova Pessoa" })).toHaveText(/Cozinha/);

  // Until they create their password, the invite can be sent again.
  await expect(row.getByText("Convite pendente")).toBeVisible();
  await row.getByRole("button", { name: "Reenviar convite" }).click();
  await expect(page.getByText(`Convite reenviado para ${email}`)).toBeVisible();

  await row.getByRole("combobox", { name: "Função de Nova Pessoa" }).click();
  await page.getByRole("option", { name: "Atendente" }).click();
  await expect(page.getByText("Nova Pessoa agora é atendente")).toBeVisible();

  // Access off (kept in the team with the role), then back on.
  await row.getByRole("button", { name: "Ações de Nova Pessoa" }).click();
  await page.getByRole("menuitem", { name: "Desativar acesso" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desativar" }).click();
  await expect(row.getByText("Acesso desativado").first()).toBeVisible();
  await row.getByRole("button", { name: "Ações de Nova Pessoa" }).click();
  await page.getByRole("menuitem", { name: "Reativar acesso" }).click();
  await expect(page.getByText("Nova Pessoa pode acessar a loja de novo")).toBeVisible();
  await expect(row.getByText("Acesso desativado")).toHaveCount(0);

  await row.getByRole("button", { name: "Ações de Nova Pessoa" }).click();
  await page.getByRole("menuitem", { name: "Remover da equipe" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remover" }).click();
  await expect(row).toHaveCount(0);
});
