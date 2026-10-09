import { test, expect } from "./fixtures";

const PROTECTED = ["/datasets", "/datasets/upload", "/models", "/experiments", "/experiments/new", "/compare", "/compare/new", "/admin"];

test.describe("anonymous visitors", () => {
  for (const path of PROTECTED) {
    test(`${path} redirects to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
  test("public routes stay reachable", async ({ page }) => {
    for (const p of ["/", "/login", "/register"]) {
      await page.goto(p);
      await expect(page).toHaveURL(new RegExp(`${p === "/" ? "/$" : p}$`));
    }
  });
});

test.describe("authenticated users", () => {
  test("/login and /register redirect to /", async ({ userPage: page }) => {
    for (const p of ["/login", "/register"]) {
      await page.goto(p);
      await expect(page).toHaveURL("http://localhost:3000/");
    }
  });
  test("landing page swaps to the overview", async ({ userPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  });
});

test("a garbage cookie passes the proxy but the API rejects it", async ({ page, context }) => {
  await context.addCookies([{ name: "access_token", value: "garbage", url: "http://localhost:3000" }]);
  await page.goto("/datasets");
  await expect(page).toHaveURL(/\/datasets$/);
  await expect(page.getByText(/Invalid or expired token|Failed to load datasets|Not authenticated/)).toBeVisible();
});
