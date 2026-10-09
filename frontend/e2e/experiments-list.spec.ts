import { test, expect } from "./fixtures";

test("empty state links to the form", async ({ userPage: page }) => {
  await page.goto("/experiments");
  await expect(page.getByRole("heading", { name: "Experiments", level: 1 })).toBeVisible();
  await expect(page.getByText("No experiments yet")).toBeVisible();
  await page.getByRole("link", { name: "Run an experiment" }).click();
  await expect(page).toHaveURL(/\/experiments\/new/);
});

test.describe("with experiments", () => {
  test.setTimeout(120_000);
  let ids: { ok: number; bad: number; anomaly: number };

  test.beforeEach(async ({ api }) => {
    const ili = await api.systemDataset("ili");
    const base = { dataset_id: ili.id, model_slug: "tensor_ar" };
    const ok = await api.createExperiment({ ...base, experiment_name: "list-ok" });
    const bad = await api.createExperiment({ ...base, experiment_name: "list-bad", test_periods: 25, input_periods: 5 });
    const anomaly = await api.createExperiment({
      ...base, experiment_name: "list-anomaly", task_type: "anomaly_detection",
      hyperparams: { anomaly: { mode: "auto", k: 3, threshold: null } },
    });
    for (const e of [ok, bad, anomaly]) await api.waitForExperiment(e.id);
    ids = { ok: ok.id, bad: bad.id, anomaly: anomaly.id };
  });

  test("table view: headers, rows, split text, anomaly tag, navigation", async ({ userPage: page }) => {
    await page.goto("/experiments");
    for (const h of ["Experiment", "Model", "Dataset", "Split", "Status", "Duration", "Created"])
      await expect(page.getByRole("columnheader", { name: h, exact: true })).toBeVisible();
    const row = page.getByRole("row", { name: /list-ok/ });
    await expect(row).toContainText("Tensor-AR");
    await expect(row).toContainText("2p in");
    await expect(row).toContainText("1p out");
    await expect(row).toContainText("completed");
    await expect(page.getByRole("row", { name: /list-anomaly/ })).toContainText("anomaly");
    await expect(page.getByRole("row", { name: /list-bad/ })).toContainText("failed");
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/experiments/${ids.ok}$`));
  });

  test("status filters show counts and filter rows", async ({ userPage: page }) => {
    await page.goto("/experiments");
    await expect(page.getByRole("button", { name: /^All 3$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Completed 2$/ })).toBeVisible();
    await page.getByRole("button", { name: /^Failed 1$/ }).click();
    await expect(page.getByRole("link", { name: "list-bad" })).toBeVisible();
    await expect(page.getByRole("link", { name: "list-ok" })).toHaveCount(0);
    await page.getByRole("button", { name: /^Completed/ }).click();
    await expect(page.getByRole("link", { name: "list-bad" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "list-ok" })).toBeVisible();
    await page.getByRole("button", { name: /^All/ }).click();
    await expect(page.getByRole("link", { name: "list-bad" })).toBeVisible();
  });

  test("card/list view toggle persists", async ({ userPage: page }) => {
    await page.goto("/experiments");
    await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Card view" }).click();
    await expect(page.getByRole("button", { name: "Card view" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "list-ok", level: 2 })).toBeVisible();
    for (const f of ["Input", "Forecast", "Duration"]) await expect(page.getByText(f, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("experiments-view"))).toBe("cards");
    await page.reload();
    await expect(page.getByRole("button", { name: "Card view" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: /list-ok/ }).click();
    await expect(page).toHaveURL(new RegExp(`/experiments/${ids.ok}$`));
  });

  test("overview shows recent experiments", async ({ userPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Recent experiments" })).toBeVisible();
    await expect(page.getByRole("link", { name: /list-ok/ })).toBeVisible();
    await page.getByRole("link", { name: "View all" }).click();
    await expect(page).toHaveURL(/\/experiments$/);
  });

  test("users only see their own experiments", async ({ newBrowserUser }) => {
    const other = await newBrowserUser("empty");
    await other.page.goto("/experiments");
    await expect(other.page.getByText("No experiments yet")).toBeVisible();
  });
});

test("list refreshes statuses without reload (polling)", async ({ userPage: page, api }) => {
  const ili = await api.systemDataset("ili");
  await page.goto("/experiments");
  await expect(page.getByText("No experiments yet")).toBeVisible();
  const e = await api.createExperiment({ dataset_id: ili.id, model_slug: "tensor_ar", experiment_name: "polled" });
  await expect(page.getByRole("link", { name: "polled" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("row", { name: /polled/ })).toContainText("completed", { timeout: 60_000 });
  void e;
});
