import { test, expect, API, Api, uniqueCreds } from "./fixtures";
import { request as pwRequest } from "@playwright/test";

test.describe("public + auth", () => {
  test("health and stats", async ({ request }) => {
    expect(await (await request.get(`${API}/health`)).json()).toEqual({ status: "ok" });
    const s = await (await request.get(`${API}/stats`)).json();
    for (const k of ["dataset_count", "model_count", "experiment_count", "completed_experiment_count", "user_count"]) expect(typeof s[k]).toBe("number");
    expect(s.model_count).toBe(7);
  });
  test("register / login / me / logout status codes", async ({ playwright }) => {
    const req = await playwright.request.newContext();
    const c = uniqueCreds("contract");
    expect((await req.post(`${API}/auth/register`, { data: c })).status()).toBe(201);
    expect((await req.post(`${API}/auth/register`, { data: c })).status()).toBe(409);
    expect((await req.post(`${API}/auth/register`, { data: { ...c, email: "not-an-email" } })).status()).toBe(422);
    expect((await req.get(`${API}/auth/me`)).status()).toBe(200);
    expect((await req.post(`${API}/auth/logout`)).status()).toBe(204);
    expect((await req.get(`${API}/auth/me`)).status()).toBe(401);
    expect((await req.post(`${API}/auth/login`, { data: { email: c.email, password: "nope" } })).status()).toBe(401);
    const ok = await req.post(`${API}/auth/login`, { data: c });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).role).toBe("user");
    await req.dispose();
  });
  test("protected routes need a cookie", async ({ playwright }) => {
    const anon = await playwright.request.newContext();
    for (const p of ["/auth/me", "/models", "/datasets", "/experiments", "/experiments/compare/groups", "/admin/users"])
      expect((await anon.get(`${API}${p}`)).status(), p).toBe(401);
    await anon.dispose();
  });
  test("models endpoint returns the seven seeded slugs", async ({ api }) => {
    const m = await api.get("/models");
    expect(m.map((x: { slug: string }) => x.slug)).toEqual(["tensor_ar", "sarima", "ets", "dlinear", "itransformer", "timexer", "timemixer"]);
  });
});

test.describe("datasets", () => {
  test("PATCH validation and ownership", async ({ api, newBrowserUser }, testInfo) => {
    const ds = await api.uploadReadyDataset(testInfo.outputPath("d"), "Contract ds");
    const bad = (data: object) => api.req.patch(`${API}/datasets/${ds.id}`, { data });
    expect((await bad({ selected_columns: ["date"] })).status()).toBe(422);
    expect((await bad({ selected_columns: [] })).status()).toBe(422);
    expect((await bad({ selected_columns: ["nope"] })).status()).toBe(422);
    const other = await newBrowserUser("intruder");
    expect((await other.api.req.patch(`${API}/datasets/${ds.id}`, { data: { selected_columns: ["alpha"] } })).status()).toBe(403);
    expect((await other.api.req.delete(`${API}/datasets/${ds.id}`)).status()).toBe(403);
    expect((await api.req.get(`${API}/datasets/999999`)).status()).toBe(404);
  });
  test("upload rejects bad files and missing fields", async ({ api }) => {
    const r = await api.req.post(`${API}/datasets/upload`, {
      multipart: { name: "x", frequency: "daily", period_length: "7", file: { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hi") } },
    });
    expect(r.status()).toBe(422);
    expect((await api.req.post(`${API}/datasets/upload`, { multipart: { name: "x" } })).status()).toBe(422);
  });
  test("preview and split-preview", async ({ api }) => {
    const ili = await api.systemDataset("ili");
    const p = await api.get(`/datasets/${ili.id}/preview?rows=5`);
    expect(p.preview_rows.length).toBe(5);
    expect(p.total_rows).toBe(966);
    expect((await api.req.get(`${API}/datasets/${ili.id}/preview?rows=0`)).status()).toBe(422);
    const sp = await api.get(`/datasets/${ili.id}/split-preview?test_periods=3&input_periods=2`);
    expect(sp.dl_eligible).toBe(true);
    expect(sp.eligible_model_slugs).toContain("dlinear");
    expect((await api.req.get(`${API}/datasets/${ili.id}/split-preview?test_periods=3&input_periods=3`)).status()).toBe(422);
    const long = await api.get(`/datasets/${ili.id}/split-preview?test_periods=25&input_periods=5`);
    expect(long.dl_eligible).toBe(false);
    expect(long.eligible_model_slugs).toEqual(["tensor_ar", "sarima", "ets"]);
  });
});

test.describe("experiments", () => {
  const body = (id: number, extra: object = {}) => ({
    dataset_id: id, model_slug: "tensor_ar", experiment_name: "c", task_type: "forecasting",
    test_periods: 3, input_periods: 2, val_ratio: 0.2, hyperparams: {}, ...extra,
  });
  test("validation rules", async ({ api }) => {
    const ili = await api.systemDataset("ili");
    const post = (extra: object) => api.req.post(`${API}/experiments`, { data: body(ili.id, extra) });
    expect((await post({ test_periods: 2, input_periods: 1 })).status()).toBe(422);
    expect((await post({ test_periods: 26 })).status()).toBe(422);
    expect((await post({ input_periods: 3 })).status()).toBe(422);
    expect((await post({ model_slug: "nope" })).status()).toBe(404);
    expect((await post({ model_slug: "dlinear", task_type: "anomaly_detection" })).status()).toBe(422);
    expect((await post({ model_slug: "dlinear", test_periods: 25, input_periods: 5 })).status()).toBe(422);
    expect((await post({ selected_columns: ["nope"] })).status()).toBe(422);
    expect((await post({ val_ratio: 1.5 })).status()).toBe(422);
    expect((await api.req.post(`${API}/experiments`, { data: body(999999) })).status()).toBe(404);
  });
  test("lifecycle: result, series, delete", async ({ api }) => {
    const ili = await api.systemDataset("ili");
    const e = await api.createExperiment({ dataset_id: ili.id, model_slug: "tensor_ar", experiment_name: "lifecycle" });
    expect(["pending", "running", "completed"]).toContain(e.status);
    const done = await api.waitForExperiment(e.id);
    expect(done.status).toBe("completed");
    const res = await api.get(`/experiments/${e.id}/result`);
    expect(res.metrics_avg).toBeTruthy();
    const series = await api.get(`/experiments/${e.id}/series`);
    expect(series.feature_names.length).toBeGreaterThan(0);
    expect(series.anomaly).toBeNull();
    expect((await api.req.delete(`${API}/experiments/${e.id}`)).status()).toBe(204);
    expect((await api.req.get(`${API}/experiments/${e.id}`)).status()).toBe(404);
  });
  test("other users get 403", async ({ api, newBrowserUser }) => {
    const ili = await api.systemDataset("ili");
    const e = await api.createExperiment({ dataset_id: ili.id, model_slug: "tensor_ar", experiment_name: "private" });
    const o = await newBrowserUser("nosy");
    expect((await o.api.req.get(`${API}/experiments/${e.id}`)).status()).toBe(403);
    expect((await o.api.req.delete(`${API}/experiments/${e.id}`)).status()).toBe(403);
    await api.waitForExperiment(e.id);
  });
  test("comparison grouping and 404 on unknown comparison", async ({ api }) => {
    const ili = await api.systemDataset("ili");
    const r = await api.req.post(`${API}/experiments/compare-batch`, {
      data: { dataset_id: ili.id, experiment_name_prefix: "Grp", test_periods: 3, input_periods: 2, model_slugs: ["tensor_ar", "ets", "nope"] },
    });
    const b = await r.json();
    expect(b.created.length).toBe(2);
    expect(b.skipped[0].model_slug).toBe("nope");
    expect(b.created.map((x: { experiment_name: string }) => x.experiment_name)).toContain("Grp (Tensor-AR)");
    for (const x of b.created) await api.waitForExperiment(x.id);
    const groups = await api.get("/experiments/compare/groups");
    expect(groups.length).toBe(1);
    expect(groups[0].model_slugs.sort()).toEqual(["ets", "tensor_ar"]);
    const q = `dataset_id=${ili.id}&test_periods=3&input_periods=2`;
    expect((await api.get(`/experiments/compare?${q}`)).entries.length).toBe(2);
    expect((await api.req.delete(`${API}/experiments/compare?${q}`)).status()).toBe(204);
    expect((await api.req.delete(`${API}/experiments/compare?${q}`)).status()).toBe(404);
  });
});

void pwRequest; void Api;
