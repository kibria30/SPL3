import { test as base, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import { ADMIN, ADMIN_STATE, API } from "./global-setup";
import { writeCsv } from "./helpers/csv";

export { expect, API, ADMIN };

export type Creds = { name: string; email: string; password: string };

let counter = 0;
export function uniqueCreds(prefix = "user"): Creds {
  const id = `${Date.now()}-${process.pid}-${counter++}-${Math.random().toString(36).slice(2, 6)}`;
  return { name: `E2E ${prefix} ${counter}`, email: `e2e+${id}@example.com`, password: "password123" };
}

/** Thin wrapper over an authenticated APIRequestContext (cookie lives in the request context). */
export class Api {
  constructor(public req: APIRequestContext) {}

  async register(c: Creds) {
    const r = await this.req.post(`${API}/auth/register`, { data: c });
    expect(r.status(), await r.text()).toBe(201);
    return r.json();
  }
  async login(c: Pick<Creds, "email" | "password">) {
    const r = await this.req.post(`${API}/auth/login`, { data: c });
    expect(r.status()).toBe(200);
    return r.json();
  }
  async get(path: string) {
    const r = await this.req.get(`${API}${path}`);
    expect(r.ok(), `${path}: ${await r.text()}`).toBeTruthy();
    return r.json();
  }
  async systemDataset(slug: "ili" | "traffic" | "weather") {
    const list = await this.get("/datasets");
    const d = list.find((x: { slug: string }) => x.slug === slug);
    expect(d, `system dataset ${slug}`).toBeTruthy();
    return d as { id: number; name: string; available_columns: { name: string }[]; selected_columns: string[] };
  }
  /** Upload a generated CSV and select all numeric columns -> a `ready` dataset. */
  async uploadReadyDataset(dir: string, name: string, opts: { rows?: number; period?: number } = {}) {
    const file = writeCsv(dir, { name: `${name.replace(/\W+/g, "_")}.csv`, rows: opts.rows ?? 150 });
    const up = await this.req.post(`${API}/datasets/upload`, {
      multipart: {
        name,
        frequency: "monthly",
        period_length: String(opts.period ?? 12),
        file: { name: "series.csv", mimeType: "text/csv", buffer: fs.readFileSync(file) },
      },
    });
    expect(up.status(), await up.text()).toBe(201);
    const ds = await up.json();
    const ready = await this.req.patch(`${API}/datasets/${ds.id}`, {
      data: { selected_columns: ["alpha", "beta", "gamma"] },
    });
    expect(ready.status(), await ready.text()).toBe(200);
    return (await ready.json()) as { id: number; name: string };
  }
  async createExperiment(body: Record<string, unknown>) {
    const r = await this.req.post(`${API}/experiments`, {
      data: { task_type: "forecasting", test_periods: 3, input_periods: 2, val_ratio: 0.2, hyperparams: {}, ...body },
    });
    expect(r.status(), await r.text()).toBe(201);
    return (await r.json()) as { id: number; status: string };
  }
  async waitForExperiment(id: number, timeoutMs = 90_000) {
    await expect
      .poll(async () => (await this.get(`/experiments/${id}`)).status, { timeout: timeoutMs, intervals: [500, 1000, 2000] })
      .toMatch(/completed|failed/);
    return this.get(`/experiments/${id}`);
  }
}

type Fixtures = {
  /** Page logged in as a brand-new regular user (registered through the API). */
  userPage: Page;
  user: Creds;
  api: Api;
  /** Page logged in as the pre-promoted admin. */
  adminPage: Page;
  adminApi: Api;
  newBrowserUser: (prefix?: string) => Promise<{ page: Page; api: Api; creds: Creds }>;
};

async function authedUser(browser: Browser, prefix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  const api = new Api(context.request);
  const creds = uniqueCreds(prefix);
  await api.register(creds);
  return { context, page, api, creds };
}

export const test = base.extend<Fixtures>({
  // Every page auto-accepts window.confirm() (all deletes use it).
  page: async ({ page }, use) => {
    page.on("dialog", (d) => d.accept());
    await use(page);
  },
  newBrowserUser: async ({ browser }, use) => {
    const made: { close: () => Promise<void> }[] = [];
    await use(async (prefix = "extra") => {
      const u = await authedUser(browser, prefix);
      made.push(u.context);
      return { page: u.page, api: u.api, creds: u.creds };
    });
    for (const c of made) await c.close();
  },
  userPage: async ({ browser }, use) => {
    const u = await authedUser(browser, "user");
    await use(u.page);
    await u.context.close();
  },
  user: async ({ userPage }, use, testInfo) => {
    // creds are carried via the page's context: re-derive by calling /auth/me
    void testInfo;
    const me = await userPage.context().request.get(`${API}/auth/me`);
    await use({ ...(await me.json()), password: "password123" });
  },
  api: async ({ userPage }, use) => use(new Api(userPage.context().request)),
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    page.on("dialog", (d) => d.accept());
    await use(page);
    await context.close();
  },
  adminApi: async ({ adminPage }, use) => use(new Api(adminPage.context().request)),
});
