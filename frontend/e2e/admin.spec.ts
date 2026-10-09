import { test, expect, API, uniqueCreds, Api } from "./fixtures";

test.describe("admin visibility", () => {
  test("admin sees nav link, badge and overview card", async ({ adminPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("navigation").getByText("Admin", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Datasets and user roles/ })).toBeVisible();
  });
  test("regular users see none of it, and admin pages report no privileges", async ({ userPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();
    await page.goto("/admin/users");
    await expect(page.getByText(/privileges|Admin privileges required/)).toBeVisible();
    // /admin/datasets lists visible datasets without needing admin; the 403 only appears on an action.
    await page.goto("/admin/datasets");
    await page.getByRole("button", { name: "Refresh" }).first().click();
    await expect(page.getByText("You don't have admin privileges.")).toBeVisible();
  });
  test("admin landing links to both sections", async ({ adminPage: page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: /Refresh built-in data and manage uploads/ }).click();
    await expect(page).toHaveURL(/\/admin\/datasets$/);
    await page.goto("/admin");
    await page.getByRole("link", { name: /Change roles and review accounts/ }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });
});

test.describe("user management", () => {
  test("lists users and changes a role; promoted user gains Admin access", async ({ adminPage: page, newBrowserUser }) => {
    const target = await newBrowserUser("promote");
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    for (const h of ["Name", "Email", "Role"]) await expect(page.getByRole("columnheader", { name: h })).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(target.creds.email.replace(/[+.]/g, "\\$&")) });
    await expect(row).toBeVisible();
    const sel = row.getByRole("combobox");
    await expect(sel).toHaveValue("user");
    await sel.selectOption("admin");
    await expect(sel).toHaveValue("admin");

    await target.page.goto("/");
    await expect(target.page.getByRole("navigation").getByRole("link", { name: "Admin" })).toBeVisible();

    await sel.selectOption("user");
    await expect(sel).toHaveValue("user");
    await target.page.reload();
    await expect(target.page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });
});

test.describe("dataset management", () => {
  test("system datasets can be refreshed", async ({ adminPage: page }) => {
    await page.goto("/admin/datasets");
    await expect(page.getByRole("heading", { name: "Datasets", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "System datasets" })).toBeVisible();
    const row = page.getByText(/ILI \(CDC/).locator("xpath=ancestor::*[.//button[normalize-space()='Refresh']][1]");
    await expect(row).toContainText("966 rows");
    await row.getByRole("button", { name: "Refresh" }).click();
    await expect(row).toContainText("966 rows", { timeout: 30_000 });
  });

  test("visibility toggle and delete of a user dataset", async ({ adminPage: page, adminApi }, testInfo) => {
    // The admin UI lists datasets via GET /datasets, so it only manages ones the admin can see (own or public).
    const api = adminApi;
    const ds = await api.uploadReadyDataset(testInfo.outputPath("d"), "Admin managed");
    await page.goto("/admin/datasets");
    await expect(page.getByRole("heading", { name: "User datasets" })).toBeVisible();
    const row = page.getByText("Admin managed").locator("xpath=ancestor::*[.//button[normalize-space()='Delete']][1]");
    await expect(row).toContainText(/owner #\d+/);
    await row.getByRole("combobox").selectOption("public");
    await expect(row.getByRole("combobox")).toHaveValue("public");
    const seen = await api.get(`/datasets/${ds.id}`);
    expect(seen.visibility).toBe("public");
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Admin managed")).toHaveCount(0);
  });

  test("another user's public dataset appears in the admin list", async ({ adminPage: page, api, newBrowserUser }, testInfo) => {
    const ds = await api.uploadReadyDataset(testInfo.outputPath("d"), "Public for admin");
    await api.req.patch(`${API}/datasets/${ds.id}`, { data: { selected_columns: ["alpha"], visibility: "public" } });
    await page.goto("/admin/datasets");
    await expect(page.getByText("Public for admin")).toBeVisible();
    void newBrowserUser;
  });


  test("API: system datasets are protected", async ({ adminApi }) => {
    const ili = await adminApi.systemDataset("ili");
    const del = await adminApi.req.delete(`${API}/admin/datasets/${ili.id}`);
    expect(del.status()).toBe(400);
    const vis = await adminApi.req.patch(`${API}/admin/datasets/${ili.id}/visibility`, { data: { visibility: "private" } });
    expect(vis.status()).toBe(400);
    const nf = await adminApi.req.post(`${API}/admin/datasets/system/nope/refresh`);
    expect(nf.status()).toBe(404);
  });

  test("API: non-admins get 403", async ({ api }) => {
    for (const [m, p] of [["get", "/admin/users"], ["post", "/admin/datasets/system/ili/refresh"]] as const) {
      const r = await api.req[m](`${API}${p}`);
      expect(r.status(), p).toBe(403);
    }
  });
});

void uniqueCreds; void Api;
