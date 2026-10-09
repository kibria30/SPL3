import { test, expect } from "./fixtures";
import { writeCsv, writeRaw } from "./helpers/csv";
import { fieldInput, fieldSelect } from "./helpers/locators";

test.describe("dataset list", () => {
  test("shows system datasets with chips and fact boxes", async ({ userPage: page }) => {
    await page.goto("/datasets");
    await expect(page.getByRole("heading", { name: "Datasets", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "System datasets (3)" })).toBeVisible();
    for (const n of [/Traffic/, /ILI/, /Weather/]) await expect(page.getByRole("heading", { name: n, level: 3 })).toBeVisible();
    const ili = page.getByRole("link", { name: /ILI \(CDC/ });
    await expect(ili).toContainText("System");
    for (const f of ["Rows", "Columns", "Frequency", "Period"]) await expect(ili).toContainText(f);
    await expect(ili).toContainText("966");
    await expect(page.getByRole("link", { name: "Upload dataset" })).toHaveAttribute("href", "/datasets/upload");
  });
});

test.describe("dataset detail (system)", () => {
  test("stats, column table and preview", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    await page.goto(`/datasets/${ili.id}`);
    await expect(page.getByRole("heading", { name: /ILI/, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "← Datasets" })).toBeVisible();
    for (const s of ["Rows", "Columns", "Frequency", "Period length"]) await expect(page.getByText(s, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Columns" })).toBeVisible();
    for (const h of ["Column", "Missing", "Mean", "Std", "Min", "Max"]) await expect(page.getByRole("columnheader", { name: h, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Data" })).toBeVisible();
    await expect(page.getByText(/Rows 1.10 of 966/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete dataset" })).toHaveCount(0);
  });

  test("first/last rows and row-count select change the preview", async ({ userPage: page, api }) => {
    const ili = await api.systemDataset("ili");
    await page.goto(`/datasets/${ili.id}`);
    await expect(page.getByText(/of 966/)).toBeVisible();
    await page.getByLabel("Rows").selectOption("25");
    await expect(page.getByText(/Rows 1.25 of 966/)).toBeVisible();
    await page.getByRole("button", { name: "Last rows" }).click();
    await expect(page.getByText(/Rows 942.966 of 966/)).toBeVisible();
    await page.getByRole("button", { name: "First rows" }).click();
    await expect(page.getByText(/Rows 1.25 of 966/)).toBeVisible();
  });
});

test.describe("upload", () => {
  test("form fields and constraints", async ({ userPage: page }) => {
    await page.goto("/datasets/upload");
    await expect(page.getByRole("heading", { name: "Upload dataset", level: 1 })).toBeVisible();
    const freq = fieldSelect(page, "Frequency");
    await expect(freq.locator("option")).toHaveText(["Hourly", "Daily", "Weekly", "Monthly", "10-minute"]);
    await expect(page.locator("input[type=file]")).toHaveAttribute("accept", ".csv,.xlsx,.xls");
    await expect(page.locator("input[type=number]")).toHaveValue("24");
    await page.getByRole("button", { name: "Upload" }).click(); // required fields block submit
    await expect(page).toHaveURL(/\/datasets\/upload/);
  });

  test("happy path: upload, pick channels, confirm", async ({ userPage: page }, testInfo) => {
    const file = writeCsv(testInfo.outputPath("csv"), { rows: 120 });
    await page.goto("/datasets/upload");
    await page.locator("form input").first().fill("My monthly series");
    await fieldSelect(page, "Frequency").selectOption("monthly");
    await page.locator("input[type=number]").fill("12");
    await page.locator("input[type=file]").setInputFiles(file);
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByRole("heading", { name: "Select forecast channels" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /My monthly series \(120 rows\)/ })).toBeVisible();
    await expect(page.getByText(/Non-numeric columns, such as a timestamp, can't be selected/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /^date/ })).toBeDisabled();
    for (const c of ["alpha", "beta", "gamma"]) await expect(page.getByRole("checkbox", { name: new RegExp(`^${c}`) })).toBeChecked();
    const confirm = page.getByRole("button", { name: /^Confirm/ });
    await expect(confirm).toHaveText("Confirm 3 channels");
    await page.getByRole("checkbox", { name: /^gamma/ }).uncheck();
    await expect(confirm).toHaveText("Confirm 2 channels");
    await page.getByRole("checkbox", { name: /^beta/ }).uncheck();
    await expect(confirm).toHaveText("Confirm 1 channel");
    await page.getByRole("checkbox", { name: /^alpha/ }).uncheck();
    await expect(confirm).toBeDisabled();
    await page.getByRole("checkbox", { name: /^alpha/ }).check();
    await confirm.click();

    await expect(page).toHaveURL(/\/datasets\/\d+$/);
    await expect(page.getByRole("heading", { name: "My monthly series", level: 1 })).toBeVisible();
    await expect(page.getByText("Private").first()).toBeVisible();
    await page.goto("/datasets");
    await expect(page.getByRole("heading", { name: /Uploaded datasets \(\d+\)/ })).toBeVisible();
    const card = page.getByRole("link", { name: /My monthly series/ });
    await expect(card).toContainText("Private");
    await expect(card).toContainText("Ready");
  });

  test("rejects unsupported file types", async ({ userPage: page }, testInfo) => {
    const f = writeRaw(testInfo.outputPath("raw"), "notes.txt", "hello");
    await page.goto("/datasets/upload");
    await page.locator("form input").first().fill("bad");
    // `accept` is only a hint to the picker; setInputFiles bypasses it.
    await page.locator("input[type=file]").setInputFiles(f);
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText(/Unsupported file type/)).toBeVisible();
  });

  test("rejects an empty CSV", async ({ userPage: page }, testInfo) => {
    const f = writeRaw(testInfo.outputPath("raw"), "empty.csv", "");
    await page.goto("/datasets/upload");
    await page.locator("form input").first().fill("empty");
    await page.locator("input[type=file]").setInputFiles(f);
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText(/Could not parse uploaded file/)).toBeVisible();
  });
});

test.describe("owner actions & authorization", () => {
  test("owner can delete an unused dataset", async ({ userPage: page, api }, testInfo) => {
    const ds = await api.uploadReadyDataset(testInfo.outputPath("d"), "Disposable");
    await page.goto(`/datasets/${ds.id}`);
    await page.getByRole("button", { name: "Delete dataset" }).click();
    await expect(page).toHaveURL(/\/datasets$/);
    await expect(page.getByRole("link", { name: /Disposable/ })).toHaveCount(0);
  });

  test("delete is blocked while experiments reference the dataset", async ({ userPage: page, api }, testInfo) => {
    const ds = await api.uploadReadyDataset(testInfo.outputPath("d"), "In use");
    const exp = await api.createExperiment({ dataset_id: ds.id, model_slug: "tensor_ar", experiment_name: "uses it" });
    await api.waitForExperiment(exp.id);
    await page.goto(`/datasets/${ds.id}`);
    await page.getByRole("button", { name: "Delete dataset" }).click();
    await expect(page.getByText(/experiment\(s\) still reference this dataset/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/datasets/${ds.id}$`));
  });

  test("private datasets are invisible to other users", async ({ userPage: page, api, newBrowserUser }, testInfo) => {
    const ds = await api.uploadReadyDataset(testInfo.outputPath("d"), "Secret series");
    const other = await newBrowserUser("other");
    await other.page.goto("/datasets");
    await expect(other.page.getByRole("heading", { name: "System datasets (3)" })).toBeVisible();
    await expect(other.page.getByRole("link", { name: /Secret series/ })).toHaveCount(0);
    await other.page.goto(`/datasets/${ds.id}`);
    await expect(other.page.getByText(/Not authorized to view this dataset/)).toBeVisible();
    await expect(other.page.getByRole("button", { name: "Delete dataset" })).toHaveCount(0);
    void page; // owner still sees it
    await page.goto("/datasets");
    await expect(page.getByRole("link", { name: /Secret series/ })).toBeVisible();
  });

  test("public datasets are visible but not editable by others", async ({ api, adminApi, newBrowserUser }, testInfo) => {
    const ds = await api.uploadReadyDataset(testInfo.outputPath("d"), "Shared series");
    const r = await adminApi.req.patch(`http://localhost:8000/admin/datasets/${ds.id}/visibility`, { data: { visibility: "public" } });
    expect(r.status()).toBe(200);
    const other = await newBrowserUser("viewer");
    await other.page.goto(`/datasets/${ds.id}`);
    await expect(other.page.getByRole("heading", { name: "Shared series", level: 1 })).toBeVisible();
    await expect(other.page.getByText("Public").first()).toBeVisible();
    await expect(other.page.getByRole("button", { name: "Delete dataset" })).toHaveCount(0);
  });
});

void fieldInput;
