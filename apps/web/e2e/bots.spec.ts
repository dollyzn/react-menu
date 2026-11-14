import { test, expect } from "./fixtures";

test("scanners get a bare 404 before any page renders or the API is asked", async ({ request }) => {
  for (const path of ["/wp-login.php", "/hachk.php", "/.env", "/.git/config", "/backup/site.sql"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).toBe("");
  }
  // Not a store's slug: the menu's own "not found", without asking the API.
  const odd = await request.get("/Config.json");
  expect(odd.status()).toBe(404);
  expect(await odd.text()).toContain("<html");
});

test("a visitor the API limited gets a real 429 that goes back to the menu", async ({ request }) => {
  const limited = await request.get("/muitos-acessos?next=/jj-pasteis");
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBe("30");
  expect(await limited.text()).toContain('href="/jj-pasteis"');

  // Only this site's menu paths go into the page.
  const elsewhere = await request.get(`/muitos-acessos?next=${encodeURIComponent("//evil.example")}`);
  expect(await elsewhere.text()).toContain('href="/"');
  expect(await elsewhere.text()).not.toContain("evil.example");
});
