import { test, expect } from "./fixtures";
import { chooseDataset, fieldInput, modelTile, setSlider, slider } from "./helpers/locators";

const run = (p: import("@playwright/test").Page) => p.getByRole("button", { name: "Run experiment" });

test.describe("new experiment form", () => {
  test("is gated until dataset, model and columns are chosen", async ({ userPage: page }) => {
    await page.goto("/experiments/new");
    await expect(page.getByRole("heading", { name: "New experiment", level: 1 })).toBeVisible();
    await expect(run(page)).toBeDisabled();
    await expect(page.getByText("Choose a dataset to see which models can run.")).toBeVisible();
    await expect(modelTile(page, /Tensor-AR/)).toBeDisabled();
    await expect(page.getByRole("button", { name: "Forecasting" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Anomaly detection" })).toBeVisible();
  });

  test("dataset select lists only ready datasets and shows the split preview", async ({ userPage: page, api }, testInfo) => {
    await api.uploadReadyDataset(testInfo.outputPath("d"), "Ready one");
    await page.goto("/experiments/new");
    await expect(page.locator("select").first().locator("option", { hasText: /Ready one \(150 rows, period 12\)/ })).toHaveCount(1);
    await chooseDataset(page, /ILI/);
    for (const t of ["Training data", "Test window", "Input window", "Forecast window"]) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Deep learning models")).toBeVisible();
    // The default 10/6 split is too long for ILI (966 rows, period 52); shrink it to 3/2.
    await setSlider(page, 0, 3);
    await setSlider(page, 1, 2);
    await expect(page.getByText("Eligible", { exact: true })).toBeVisible();
    await expect(modelTile(page, /DLinear/)).toBeEnabled();
  });

  test("column picker: select all / clear / validation", async ({ userPage: page }) => {
    await page.goto("/experiments/new");
    await chooseDataset(page, /ILI/);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("Select at least one column.")).toBeVisible();
    await expect(run(page)).toBeDisabled();
    await page.getByRole("button", { name: "Select all" }).click();
    await expect(page.getByText("Select at least one column.")).toHaveCount(0);
  });

  test("sliders keep the input window below the test window", async ({ userPage: page }) => {
    await page.goto("/experiments/new");
    await chooseDataset(page, /ILI/);
    await setSlider(page, 0, 10);
    await setSlider(page, 1, 8);
    await setSlider(page, 0, 4);
    expect(Number(await slider(page, 1).inputValue())).toBeLessThan(4);
  });

  test("too-long test window disables deep learning models and suggests a split", async ({ userPage: page }) => {
    await page.goto("/experiments/new");
    await chooseDataset(page, /ILI/);
    await setSlider(page, 0, 25);
    await expect(page.getByText("Not eligible", { exact: true })).toBeVisible();
    await expect(page.getByText(/Try test \d+, input \d+/)).toBeVisible();
    await expect(modelTile(page, /DLinear/)).toBeDisabled();
    await expect(modelTile(page, /iTransformer/)).toBeDisabled();
    await expect(modelTile(page, /Tensor-AR/)).toBeEnabled();
  });

  test("hyperparameter fields depend on the chosen model", async ({ userPage: page }) => {
    await page.goto("/experiments/new");
    await chooseDataset(page, /ILI/);
    await modelTile(page, /Tensor-AR/).click();
    await expect(page.getByRole("heading", { name: "Hyperparameters" }).or(page.getByText("Hyperparameters")).first()).toBeVisible();
    for (const l of ["Rank", "AR lags", "Decomposition"]) await expect(page.getByText(l, { exact: true })).toBeVisible();
    await expect(page.locator("select").filter({ has: page.locator("option", { hasText: "CP Puzzle" }) })).toBeVisible();

    await modelTile(page, /SARIMA/).click();
    await expect(page.getByText("Order (p, d, q)", { exact: true })).toBeVisible();
    await expect(page.getByText("Seasonal order (P, D, Q)", { exact: true })).toBeVisible();

    await setSlider(page, 0, 3);
    await setSlider(page, 1, 2);
    await modelTile(page, /DLinear/).click();
    for (const l of ["Epochs", "Learning rate", "Batch size", "Early-stopping patience"]) await expect(page.getByText(l, { exact: true })).toBeVisible();
    const epochs = fieldInput(page, "Epochs");
    await epochs.fill("7");
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(epochs).toHaveValue("100");
  });

  test("anomaly detection mode forces Tensor-AR and offers thresholds", async ({ userPage: page }) => {
    await page.goto("/experiments/new");
    await chooseDataset(page, /ILI/);
    await page.getByRole("button", { name: "Anomaly detection" }).click();
    await expect(page.getByRole("radio", { name: /DLinear/ })).toHaveCount(0);
    await expect(page.getByText(/points where \|actual . predicted\| exceeds the threshold are flagged/)).toBeVisible();
    await expect(page.getByText(/k \(threshold = k × robust σ/)).toBeVisible();
    await expect(page.getByRole("radio", { name: "Auto" })).toBeChecked();
    await page.getByRole("radio", { name: "Manual" }).check();
    const thr = fieldInput(page, /Threshold \(normalized units/);
    await expect(thr).toHaveValue("1");
    await thr.fill("0");
    await fieldInput(page, "Experiment name").fill("anomaly gating");
    await expect(run(page)).toBeDisabled();
    await thr.fill("2");
    await expect(run(page)).toBeEnabled();
  });

  test("submitting creates the experiment and returns to the list", async ({ userPage: page }) => {
    await page.goto("/experiments/new");
    await fieldInput(page, "Experiment name").fill("UI created run");
    await chooseDataset(page, /ILI/);
    await setSlider(page, 0, 3);
    await setSlider(page, 1, 2);
    await modelTile(page, /Tensor-AR/).click();
    await expect(run(page)).toBeEnabled();
    await run(page).click();
    await expect(page).toHaveURL(/\/experiments$/);
    await expect(page.getByRole("link", { name: "UI created run" })).toBeVisible();
  });

  test("API error on create is surfaced", async ({ userPage: page }) => {
    await page.route("**/experiments", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ detail: "boom from api" }) })
        : route.continue(),
    );
    await page.goto("/experiments/new");
    await fieldInput(page, "Experiment name").fill("will fail");
    await chooseDataset(page, /ILI/);
    await modelTile(page, /Tensor-AR/).click();
    await run(page).click();
    await expect(page.getByText(/boom from api/)).toBeVisible();
    await expect(page).toHaveURL(/\/experiments\/new/);
  });
});
