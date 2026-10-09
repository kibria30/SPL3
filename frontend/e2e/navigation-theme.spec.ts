import { test, expect } from "./fixtures";

test.describe("navigation", () => {
  test("nav links route and mark the active page", async ({ userPage: page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    for (const [name, url] of [["Datasets", "/datasets"], ["Models", "/models"], ["Experiments", "/experiments"], ["Compare", "/compare"]] as const) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${url}$`));
      await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    }
  });
  test("sub-routes keep the parent active; brand link goes home", async ({ userPage: page }) => {
    await page.goto("/compare/new");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Compare", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "TS Forecasting Library" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  });
  test("regular users get no Admin entry points", async ({ userPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });
  test("overview: empty state and quick actions", async ({ userPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Recent experiments" })).toBeVisible();
    await expect(page.getByText("No experiments yet.")).toBeVisible();
    await page.getByRole("link", { name: "Run your first comparison" }).click();
    await expect(page).toHaveURL(/\/compare\/new/);
    await page.goto("/");
    await page.getByRole("link", { name: "New experiment" }).click();
    await expect(page).toHaveURL(/\/experiments\/new/);
  });
  test("overview 'Go to' cards navigate", async ({ userPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Go to" })).toBeVisible();
    await page.getByRole("link", { name: /Browse and upload data/ }).click();
    await expect(page).toHaveURL(/\/datasets$/);
  });
});

test.describe("theme", () => {
  test("toggle flips html.dark, is stored and survives reload", async ({ page }) => {
    await page.goto("/login");
    const html = page.locator("html");
    const toggle = page.getByRole("button", { name: /Switch to (night|day) mode/ });
    const before = await html.evaluate((h) => h.classList.contains("dark"));
    await toggle.click();
    const after = await html.evaluate((h) => h.classList.contains("dark"));
    expect(after).toBe(!before);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(after ? "dark" : "light");
    await page.reload();
    expect(await html.evaluate((h) => h.classList.contains("dark"))).toBe(after);
  });
});

test.describe("browser tab titles", () => {
  test("public pages", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("TS Forecasting Library");
    await page.goto("/login");
    await expect(page).toHaveTitle("Log in · TS Forecasting Library");
    await page.goto("/register");
    await expect(page).toHaveTitle("Create an account · TS Forecasting Library");
  });
  test("dashboard sections", async ({ userPage: page }) => {
    for (const [path, title] of [["/datasets", "Datasets"], ["/models", "Models"], ["/experiments/new", "Experiments"], ["/compare", "Compare"], ["/admin", "Admin"]])
      {
        await page.goto(path);
        await expect(page).toHaveTitle(`${title} · TS Forecasting Library`);
      }
  });
});
