import { test, expect, login, createStoreViaApi, storeApi } from "./fixtures";

/** Every visible interactive element must have an accessible name. */
test("admin screens have no unnamed controls", async ({ page }) => {
  const store = await createStoreViaApi(page, "A11y");
  const api = storeApi(page, store.id);
  const category = await api.post("/categories", { name: "Pastéis" });
  await api.post(`/categories/${category.id}/items`, { name: "Pastel", price: 10 });
  await page.context().clearCookies();
  await login(page);

  for (const path of ["", "/overview", "/reports", "/categories", "/items", "/addons"]) {
    await page.goto(`/app/stores/${store.id}${path}`);
    await page.waitForLoadState("networkidle");

    const unnamed = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll("button, [role=button], a[href], [aria-haspopup]")
      )
        .filter((el) => {
          const he = el as HTMLElement;
          if (he.closest("nextjs-portal")) return false;
          if (!he.offsetParent && getComputedStyle(he).position !== "fixed") return false;
          const name =
            he.getAttribute("aria-label") ||
            he.getAttribute("aria-labelledby") ||
            he.getAttribute("title") ||
            he.innerText.trim() ||
            he.querySelector(".sr-only");
          return !name;
        })
        .map((el) => el.outerHTML.slice(0, 160))
    );

    expect(unnamed, `unnamed controls on ${path || "/"}`).toEqual([]);
  }
});
