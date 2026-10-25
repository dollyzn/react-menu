import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";
import { API_URL } from "../playwright.config";

const ZONE = "America/Sao_Paulo";
const DAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const hhmm = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const dateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
/** How the app says when (formatWhen): "às 18:00" today, "amanhã às 01:00" past midnight. */
const when = (date: Date) =>
  `${dateKey(date) === dateKey(new Date()) ? "" : "amanhã "}às ${hhmm(date)}`;
const dayOf = (date: Date) =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: ZONE, weekday: "short" }).format(date)
  );

test("a store on a schedule opens and closes by itself; 'Fechar agora' pauses it", async ({ page }) => {
  const store = await createStoreViaApi(page, "Horário");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  await api.post(`/categories/${category.id}/items`, { name: "Pastel de carne", price: 12 });
  const base = `${API_URL}/api/v1/stores/${store.id}`;
  const { slug } = (await (await page.request.get(base)).json()).data;

  // The manager turns the schedule on: opening in about two hours (the
  // form offers half hours), for an hour. Late at night that is tomorrow.
  const half = 30 * 60 * 1000;
  const start = new Date(Math.ceil((Date.now() + 2 * 60 * 60 * 1000) / half) * half);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const day = DAYS[dayOf(start)];
  await page.context().clearCookies();
  await login(page);
  await page.goto(`/app/stores/${store.id}`, { timeout: 30_000 });
  await page.getByText("Abrir e fechar sozinha pelo horário").click();
  await page.getByRole("checkbox", { name: `Abre ${day}` }).click();
  await page.getByRole("combobox", { name: `Abre às (${day})` }).click();
  await page.getByRole("option", { name: hhmm(start), exact: true }).click();
  await page.getByRole("combobox", { name: `Fecha às (${day})` }).click();
  await page.getByRole("option", { name: hhmm(end), exact: true }).click();
  await expect(page.getByRole("table", { name: "Horários da semana" })).toContainText("1h");
  await page.getByRole("button", { name: "Salvar horário" }).click();
  await expect(page.getByText("Horário de funcionamento salvo")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Status da loja: Fechado · abre/ })).toBeVisible();

  // The menu says when it opens and lists the week.
  await page.goto(`/${slug}`);
  await expect(page.getByText(`Fechado · abre ${when(start)}`)).toBeVisible();
  await expect(page.getByText(/e abrimos (amanhã )?às/)).toBeVisible();
  await page.getByRole("button", { name: "Horários" }).click();
  const week = page.getByRole("dialog", { name: "Horário de funcionamento" });
  await expect(week.getByText(`${hhmm(start)} – ${hhmm(end)}`)).toBeVisible();
  await expect(week.getByText("Hoje")).toBeVisible();
  await page.keyboard.press("Escape");

  // Open now (since an hour ago, for two hours): then "Fechar agora".
  const opened = new Date(Date.now() - 60 * 60 * 1000);
  const closes = new Date(Date.now() + 60 * 60 * 1000);
  const set = await page.request.put(`${base}/hours`, {
    data: {
      scheduleEnabled: true,
      openingHours: [{ day: dayOf(opened), opens: hhmm(opened), closes: hhmm(closes) }],
    },
  });
  expect(set.ok()).toBeTruthy();
  await page.goto(`/${slug}`);
  await expect(page.getByText(`Aberto agora · fecha ${when(closes)}`)).toBeVisible();

  await page.goto(`/app/stores/${store.id}`);
  await page.getByRole("button", { name: /^Status da loja: Aberto · até/ }).click();
  await page.getByRole("menuitem", { name: /Fechar agora/ }).click();
  await expect(page.getByRole("button", { name: /^Status da loja: Fechado/ })).toBeVisible();
  await page.goto(`/${slug}`);
  await expect(page.getByText(/^Fechado/).first()).toBeVisible();
});
