import { test, expect, API } from "./fixtures";
import { chooseDataset, fieldInput, modelTile, setSlider } from "./helpers/locators";

const runBtn = (p: import("@playwright/test").Page, label: RegExp | string) => p.getByRole("button", { name: label });

test("empty state", async ({ userPage: page }) => {
  await page.goto("/compare");
  await expect(page.getByRole("heading", { name: "Compare", level: 1 })).toBeVisible();
  await expect(page.getByText("No comparisons yet")).toBeVisible();
  await expect(page.getByText("Run two or more models on the same dataset and split.")).toBeVisible();
  await page.getByRole("link", { name: "Start a comparison" }).click();
  await expect(page).toHaveURL(/\/compare\/new/);
});

test.describe("new comparison form", () => {
  test("model multi-select, counters and gating", async ({ userPage: page }) => {
    await page.goto("/compare/new");
    await expect(page.getByRole("heading", { name: "New comparison", level: 1 })).toBeVisible();
    await expect(fieldInput(page, "Comparison name")).toHaveAttribute("placeholder", "e.g. ILI baseline sweep");
    await expect(runBtn(page, "Run comparison (0 models)")).toBeDisabled();
    await expect(modelTile(page, /Tensor-AR/, "checkbox")).toBeDisabled();

    await fieldInput(page, "Comparison name").fill("form gating");
    await chooseDataset(page, /ILI/);
    await setSlider(page, 0, 3);
    await setSlider(page, 1, 2);
    await page.getByRole("button", { name: "Select all eligible" }).click();
    await expect(page.getByRole("heading", { name: "Models (7 selected)" })).toBeVisible();
    for (const n of [/SARIMA/, /ETS/, /DLinear/, /iTransformer/, /TimeXer/, /TimeMixer/]) await modelTile(page, n, "checkbox").click();
    await expect(page.getByRole("heading", { name: "Models (1 selected)" })).toBeVisible();
    await expect(runBtn(page, "Run comparison (1 model)")).toBeEnabled();
    await expect(page.getByText("Tensor-AR decomposition")).toBeVisible();
    await modelTile(page, /Tensor-AR/, "checkbox").click();
    await expect(page.getByText("Tensor-AR decomposition")).toHaveCount(0);
    await expect(runBtn(page, "Run comparison (0 models)")).toBeDisabled();
  });

  test("changing to an ineligible split drops deep learning models", async ({ userPage: page }) => {
    await page.goto("/compare/new");
    await chooseDataset(page, /ILI/);
    await setSlider(page, 0, 3);
    await setSlider(page, 1, 2);
    await modelTile(page, /DLinear/, "checkbox").click();
    await modelTile(page, /Tensor-AR/, "checkbox").click();
    await expect(page.getByRole("heading", { name: "Models (2 selected)" })).toBeVisible();
    await setSlider(page, 0, 25);
    await expect(modelTile(page, /DLinear/, "checkbox")).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Models (1 selected)" })).toBeVisible();
  });
});

test.describe("running a comparison", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test("create, leaderboard, charts, group card, delete", async ({ userPage: page }) => {
    await page.goto("/compare/new");
    await fieldInput(page, "Comparison name").fill("E2E sweep");
    await chooseDataset(page, /ILI/);
    await setSlider(page, 0, 3);
    await setSlider(page, 1, 2);
    for (const n of [/Tensor-AR/, /ETS/, /DLinear/]) await modelTile(page, n, "checkbox").click();
    await runBtn(page, "Run comparison (3 models)").click();

    await expect(page).toHaveURL(/\/compare\/view\?.*dataset_id=\d+/);
    await expect(page.getByRole("heading", { name: "E2E sweep", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "← Compare" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
    await expect(page.getByText("Tensor-AR = Classical")).toBeVisible();
    await expect(page.getByText("DLinear = Deep learning")).toBeVisible();

    await expect(page.getByRole("button", { name: "Delete comparison" })).toBeEnabled({ timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
    for (const h of ["Model", "Status", "MSE", "MAE", "RMSE", "MASE", "sMAPE", "Time (s)", "Params", "val_ratio"])
      await expect(page.getByRole("columnheader", { name: h, exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /Tensor-AR/ })).toContainText("completed");
    // sorted by MSE ascending
    const mse = await page.locator("table tbody tr").evaluateAll((rows) =>
      rows.map((r) => parseFloat((r.querySelectorAll("td")[2] as HTMLElement).innerText)).filter((n) => !Number.isNaN(n)));
    expect(mse.length).toBe(3);
    expect([...mse].sort((a, b) => a - b)).toEqual(mse);

    await expect(page.getByRole("heading", { name: "Actual vs. predicted" })).toBeVisible();
    await expect(page.locator(".js-plotly-plot").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Efficiency" })).toBeVisible();
    await expect(page.getByText("Training time (s)").first()).toBeVisible();
    await expect(page.getByText("Parameters").first()).toBeVisible();

    // group card on /compare
    await page.goto("/compare");
    const card = page.getByRole("link", { name: /E2E sweep/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Completed");
    for (const f of ["Models", "Input", "Forecast"]) await expect(card).toContainText(f);
    await expect(card).toContainText("Tensor-AR");
    await card.click();
    await expect(page).toHaveURL(/\/compare\/view/);
    await page.getByRole("button", { name: "Delete comparison" }).click();
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page.getByText("No comparisons yet")).toBeVisible();
  });

  test("delete from the card list", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const r = await api.req.post(`${API}/experiments/compare-batch`, {
      data: { dataset_id: ili.id, experiment_name_prefix: "Card del", test_periods: 3, input_periods: 2, model_slugs: ["tensor_ar", "ets"] },
    });
    expect(r.status()).toBe(201);
    const batch = await r.json();
    for (const e of batch.created) await api.waitForExperiment(e.id);
    await page.goto("/compare");
    await expect(page.getByRole("link", { name: /Card del/ })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("link", { name: /Card del/ })).toHaveCount(0);
  });

  test("weather datasets show the live-refresh warning (mocked)", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const r = await api.req.post(`${API}/experiments/compare-batch`, {
      data: { dataset_id: ili.id, experiment_name_prefix: "Warn", test_periods: 3, input_periods: 2, model_slugs: ["tensor_ar", "ets"] },
    });
    const batch = await r.json();
    for (const e of batch.created) await api.waitForExperiment(e.id);
    await page.route(`${API}/experiments/compare?*`, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...(await res.json()), dataset_slug: "weather" } });
    });
    await page.goto(`/compare/view?dataset_id=${ili.id}&test_periods=3&input_periods=2`);
    await expect(page.getByText(/This dataset refreshes live/)).toBeVisible();
  });
});

test("ineligible models are skipped, not fatal, by the batch API", async ({ api }) => {
  const ili = await api.systemDataset("ili");
  const r = await api.req.post(`${API}/experiments/compare-batch`, {
    data: { dataset_id: ili.id, experiment_name_prefix: "Skip", test_periods: 25, input_periods: 5, model_slugs: ["tensor_ar", "dlinear"] },
  });
  expect(r.status()).toBe(201);
  const b = await r.json();
  expect(b.created.map((e: { id: number }) => e.id).length).toBe(1);
  expect(b.skipped[0].model_slug).toBe("dlinear");
  await api.waitForExperiment(b.created[0].id);
});
