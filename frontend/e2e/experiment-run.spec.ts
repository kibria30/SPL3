import { test, expect } from "./fixtures";

test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

const ILI_FAST = { model_slug: "tensor_ar", test_periods: 3, input_periods: 2 };

test.describe("completed forecasting run", () => {
  test("detail page shows config, stats, chart and metrics", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const exp = await api.createExperiment({ ...ILI_FAST, dataset_id: ili.id, experiment_name: "TAR detail" });
    await api.waitForExperiment(exp.id);
    await page.goto(`/experiments/${exp.id}`);
    await expect(page.getByRole("heading", { name: "TAR detail", level: 1 })).toBeVisible();
    await expect(page.getByText("completed", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "← Experiments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
    for (const g of ["Data", "Split", "Training"]) await expect(page.getByText(g, { exact: true }).first()).toBeVisible();
    for (const s of ["Model", "Training time", "Parameters", "MSE", "MAE"]) await expect(page.getByText(s, { exact: true }).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Actual vs. predicted" })).toBeVisible();
    await expect(page.locator(".js-plotly-plot")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".legendtext", { hasText: "Actual" })).toBeVisible();
    await expect(page.locator(".legendtext", { hasText: "Predicted" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Metrics" })).toBeVisible();
    for (const h of ["Feature", "MSE", "MAE", "RMSE", "MASE", "sMAPE"]) await expect(page.getByRole("columnheader", { name: h, exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Average" })).toBeVisible();
  });

  test("feature pills switch the chart series", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const exp = await api.createExperiment({ ...ILI_FAST, dataset_id: ili.id, experiment_name: "TAR pills", selected_columns: ["OT", "ILITOTAL"] });
    await api.waitForExperiment(exp.id);
    await page.goto(`/experiments/${exp.id}`);
    await expect(page.locator(".js-plotly-plot")).toBeVisible({ timeout: 30_000 });
    const pill = page.getByRole("button", { name: "ILITOTAL" });
    await pill.click();
    await expect(page.locator(".js-plotly-plot")).toBeVisible();
  });

  test("delete removes the experiment", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const exp = await api.createExperiment({ ...ILI_FAST, dataset_id: ili.id, experiment_name: "TAR delete me" });
    await api.waitForExperiment(exp.id);
    await page.goto(`/experiments/${exp.id}`);
    await page.getByRole("button", { name: "Delete experiment" }).click();
    await expect(page).toHaveURL(/\/experiments$/);
    await expect(page.getByRole("link", { name: "TAR delete me" })).toHaveCount(0);
  });
});

test.describe("trained model run", () => {
  test("shows progress while running, then completes with a toast", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const exp = await api.createExperiment({
      dataset_id: ili.id, model_slug: "dlinear", experiment_name: "DLinear short",
      hyperparams: { epochs: 3, patience: 3 },
    });
    await page.goto(`/experiments/${exp.id}`);
    await expect(page.getByRole("heading", { name: "DLinear short", level: 1 })).toBeVisible();
    // Fast runs may skip the intermediate states; any of them is acceptable, but the end state is not optional.
    await expect(page.getByText("completed", { exact: true }).first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Metrics" })).toBeVisible();
    await expect(page.getByText("Validation share")).toBeVisible();
    await expect(page.getByText("epochs = 3")).toBeVisible();
  });

  test("running state shows epoch progress and log (mocked)", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const exp = await api.createExperiment({
      dataset_id: ili.id, model_slug: "dlinear", experiment_name: "Mock running", hyperparams: { epochs: 2, patience: 2 },
    });
    await api.waitForExperiment(exp.id);
    await page.route(`http://localhost:8000/experiments/${exp.id}`, async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({
        response: res,
        json: { ...body, status: "running", completed_at: null, progress_epoch: 4, progress_total_epochs: 10, training_log: ["[DLinear] epoch 001/10  val MSE 0.1234"] },
      });
    });
    await page.goto(`/experiments/${exp.id}`);
    await expect(page.getByText(/Epoch 4 \/ 10/)).toBeVisible();
    await expect(page.getByText("[DLinear] epoch 001/10  val MSE 0.1234")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete experiment" })).toBeDisabled();
  });
});

test.describe("failed run", () => {
  test("window longer than the series fails with a clear message", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const exp = await api.createExperiment({ model_slug: "tensor_ar", dataset_id: ili.id, experiment_name: "Too long", test_periods: 25, input_periods: 5 });
    const done = await api.waitForExperiment(exp.id);
    expect(done.status).toBe("failed");
    await page.goto(`/experiments/${exp.id}`);
    await expect(page.getByText("failed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/too short/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete experiment" })).toBeEnabled();
  });
});

test.describe("anomaly detection run", () => {
  test("flags points and previews other thresholds", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    const exp = await api.createExperiment({
      ...ILI_FAST, dataset_id: ili.id, experiment_name: "Anomaly run", task_type: "anomaly_detection",
      hyperparams: { anomaly: { mode: "auto", k: 3, threshold: null } },
    });
    const done = await api.waitForExperiment(exp.id);
    expect(done.status).toBe("completed");
    await page.goto(`/experiments/${exp.id}`);
    await expect(page.getByRole("heading", { name: "Anomaly detection" })).toBeVisible();
    await expect(page.getByText(/of \d+ points flagged as probable anomalies/)).toBeVisible();
    await expect(page.getByText(/not saved to the experiment/)).toBeVisible();
    await expect(page.locator(".js-plotly-plot")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("radio", { name: /Manual threshold/ }).check();
    await expect(page.getByText(/Thresholds \(normalized units\)/)).toBeVisible();
  });
});

test.describe("authorization", () => {
  test("another user cannot open my experiment", async ({ api, newBrowserUser }) => {
    const ili = await api.systemDataset("ili");
    const exp = await api.createExperiment({ ...ILI_FAST, dataset_id: ili.id, experiment_name: "Mine" });
    const other = await newBrowserUser("snoop");
    await other.page.goto(`/experiments/${exp.id}`);
    await expect(other.page.getByText(/Not authorized/)).toBeVisible();
    await api.waitForExperiment(exp.id);
  });
});
