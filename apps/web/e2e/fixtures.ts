import { test as base, expect, type Page } from "@playwright/test";
import { API_URL, E2E_ADMIN } from "../playwright.config";

type ConsoleEntry = { type: string; text: string; url: string };

/**
 * Console noise that is not a defect of this app (dev-only tooling banners).
 */
const IGNORED = [
  /Download the React DevTools/,
  /\[HMR\]/,
  /\[Fast Refresh\]/,
  // The browser logs every non-2xx response; expected API errors (e.g. wrong
  // password) are asserted by the tests themselves.
  /Failed to load resource: the server responded with a status of/,
  // Dropped connections simulated by the flaky-network tests.
  /Failed to load resource: net::ERR_CONNECTION_RESET/,
];

/**
 * Every test fails if the browser logs a warning or error: runtime warnings
 * (React, Base UI, hydration) are treated as defects, not noise.
 */
export const test = base.extend<{ consoleEntries: ConsoleEntry[] }>({
  consoleEntries: [async ({ page }, use) => {
    const entries: ConsoleEntry[] = [];
    page.on("console", (msg) => {
      if (!["warning", "error"].includes(msg.type())) return;
      if (IGNORED.some((re) => re.test(msg.text()))) return;
      entries.push({ type: msg.type(), text: msg.text(), url: page.url() });
    });
    page.on("pageerror", (error) =>
      entries.push({ type: "pageerror", text: error.message, url: page.url() })
    );
    await use(entries);
    expect(entries, "browser console warnings/errors").toEqual([]);
  }, { auto: true }],
});

export { expect };

/** Demo staff created by the API seeders (development). */
export const DEMO_STAFF = {
  attendant: { email: "atendente@jjpasteis.dev", password: "demo12345" },
  kitchen: { email: "cozinha@jjpasteis.dev", password: "demo12345" },
};

export async function login(page: Page, credentials = E2E_ADMIN) {
  await page.goto("/app/login");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/app\/stores\/[^/]+/);
}

/** Creates a store through the API as the seeded admin (who becomes a member). */
export async function createStoreViaApi(page: Page, name: string) {
  const login = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    data: E2E_ADMIN,
  });
  expect(login.ok()).toBeTruthy();

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const response = await page.request.post(`${API_URL}/api/v1/stores`, {
    data: { name, slug },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data as { id: string; name: string };
}

/** Authenticated API helper bound to the page's cookie jar. */
export function storeApi(page: Page, storeId: string) {
  const url = (path: string) => `${API_URL}/api/v1/stores/${storeId}${path}`;
  return {
    post: async (path: string, data: unknown) =>
      (await (await page.request.post(url(path), { data })).json()).data,
  };
}
