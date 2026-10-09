import { test, expect, uniqueCreds, Api, API } from "./fixtures";

test.describe("landing page (logged out)", () => {
  test("shows hero, CTAs and model catalogue", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find out which forecasting model works on your data");
    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
    await expect(page.getByRole("link", { name: "Log in" }).first()).toHaveAttribute("href", "/login");
    await expect(page.getByRole("heading", { name: "Seven models, one place" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Classical" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deep learning" })).toBeVisible();
    for (const h of ["Same split for every model", "Your data or ours", "One leaderboard"])
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
  });
  test("platform stat cards are rendered", async ({ page }) => {
    await page.goto("/");
    for (const s of ["Datasets", "Models", "Experiments run"]) await expect(page.getByText(s, { exact: true }).first()).toBeVisible();
  });
});

test.describe("register", () => {
  test("creates an account, logs in and lands on the overview", async ({ page, context }) => {
    const c = uniqueCreds("reg");
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await page.locator("form input").nth(0).fill(c.name);
    await page.locator("input[type=email]").fill(c.email);
    await page.locator("input[type=password]").fill(c.password);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: `Welcome back, ${c.name}` })).toBeVisible();
    const cookies = await context.cookies();
    const auth = cookies.find((k) => k.name === "access_token");
    expect(auth?.httpOnly).toBe(true);
  });

  test("blocks empty fields and short passwords natively", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/register/);
    expect(await page.locator("input[type=email]").evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
    await page.locator("form input").nth(0).fill("Short Pass");
    await page.locator("input[type=email]").fill(uniqueCreds().email);
    await page.locator("input[type=password]").fill("short");
    expect(await page.locator("input[type=password]").evaluate((e: HTMLInputElement) => e.validity.tooShort)).toBe(true);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("rejects a duplicate email", async ({ page, request }) => {
    const c = uniqueCreds("dup");
    await new Api(request).register(c);
    await page.goto("/register");
    await page.locator("form input").nth(0).fill(c.name);
    await page.locator("input[type=email]").fill(c.email);
    await page.locator("input[type=password]").fill(c.password);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText(/Email already registered/)).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("links to login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("login / logout", () => {
  test("logs in with valid credentials", async ({ page, request }) => {
    const c = uniqueCreds("login");
    await new Api(request).register(c);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await page.locator("input[type=email]").fill(c.email);
    await page.locator("input[type=password]").fill(c.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: new RegExp(`Welcome back, ${c.name}`) })).toBeVisible();
  });

  test("wrong password and unknown email give the same error", async ({ page, request }) => {
    const c = uniqueCreds("bad");
    await new Api(request).register(c);
    for (const creds of [{ email: c.email, password: "wrong-password" }, { email: uniqueCreds().email, password: "whatever123" }]) {
      await page.goto("/login");
      await page.locator("input[type=email]").fill(creds.email);
      await page.locator("input[type=password]").fill(creds.password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.getByText(/Invalid email or password/)).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("shows a pending state while logging in", async ({ page, request }) => {
    const c = uniqueCreds("slow");
    await new Api(request).register(c);
    await page.route(`${API}/auth/login`, async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await page.goto("/login");
    await page.locator("input[type=email]").fill(c.email);
    await page.locator("input[type=password]").fill(c.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("button", { name: "Logging in..." })).toBeDisabled();
    await expect(page).toHaveURL("/");
  });

  test("session persists across reload; logout clears it", async ({ userPage: page, context }) => {
    await page.goto("/datasets");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Datasets" })).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await context.cookies()).find((k) => k.name === "access_token")).toBeUndefined();
    await page.goto("/datasets");
    await expect(page).toHaveURL(/\/login/);
  });

  test("links to register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});
