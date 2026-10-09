import { test, expect } from "./fixtures";

test("lists classical and deep-learning models with defaults", async ({ userPage: page }) => {
  await page.goto("/models");
  await expect(page.getByRole("heading", { name: "Models", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Classical models (3)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deep learning models (4)" })).toBeVisible();
  for (const n of ["Tensor-AR", "SARIMA", "ETS (Holt-Winters)", "DLinear", "iTransformer", "TimeXer", "TimeMixer"])
    await expect(page.getByRole("heading", { name: n, level: 3 })).toBeVisible();
  await expect(page.getByRole("link", { name: /DLinear/ })).toContainText("epochs = 100");
  await expect(page.getByRole("link", { name: /Tensor-AR/ })).toContainText("rank = 2");
});

test("model detail pages", async ({ userPage: page }) => {
  await page.goto("/models");
  await page.getByRole("link", { name: /DLinear/ }).click();
  await expect(page).toHaveURL(/\/models\/dlinear$/);
  await expect(page.getByRole("heading", { name: "DLinear", level: 1 })).toBeVisible();
  for (const s of ["Family", "Training", "Published", "Parameters set"]) await expect(page.getByText(s, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Required")).toBeVisible();
  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paper" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reference implementation/ })).toHaveAttribute("href", /github\.com/);
  await expect(page.getByRole("heading", { name: "Default hyperparameters" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "epochs" })).toBeVisible();
  await page.getByRole("link", { name: "← Models" }).click();
  await expect(page).toHaveURL(/\/models$/);
});

test("classical model needs no training", async ({ userPage: page }) => {
  await page.goto("/models/ets");
  await expect(page.getByRole("heading", { name: /ETS/, level: 1 })).toBeVisible();
  await expect(page.getByText("None").first()).toBeVisible();
});

test("unknown slug shows an error", async ({ userPage: page }) => {
  await page.goto("/models/does-not-exist");
  await expect(page.getByText("No model with slug 'does-not-exist'")).toBeVisible();
});
