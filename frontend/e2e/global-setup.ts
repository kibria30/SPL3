import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export const E2E_DB = process.env.E2E_DB ?? "tsf_e2e";
export const ADMIN = {
  name: "E2E Admin",
  email: "e2e-admin@example.com",
  password: "adminpass123",
};
export const API = "http://localhost:8000";
export const ADMIN_STATE = path.join(__dirname, ".auth", "admin.json");

const backend = path.resolve(__dirname, "../../backend");
const py = path.resolve(__dirname, "../../env/bin/python");

function sh(cmd: string, env: Record<string, string> = {}) {
  execSync(cmd, { cwd: backend, stdio: "inherit", env: { ...process.env, ...env } });
}

/**
 * The isolated DB is created/migrated/seeded by the backend webServer command in
 * playwright.config.ts (it runs before this). Here we only create the admin account.
 */
export default async function globalSetup() {
  if (E2E_DB === "tsf_forecasting_app") throw new Error("Refusing to run e2e against the dev DB");
  const env = { DATABASE_URL: `postgresql+psycopg2:///${E2E_DB}` };

  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  if (reg.status !== 201) throw new Error(`admin register failed: ${reg.status}`);
  sh(`${py} -m app.promote_admin ${ADMIN.email}`, env);

  // Persist the admin session (cookie) for the `adminPage` fixture.
  const cookie = reg.headers.getSetCookie().find((c) => c.startsWith("access_token="))!;
  const value = cookie.split(";")[0].split("=")[1];
  fs.mkdirSync(path.dirname(ADMIN_STATE), { recursive: true });
  fs.writeFileSync(
    ADMIN_STATE,
    JSON.stringify({
      cookies: [
        { name: "access_token", value, domain: "localhost", path: "/", expires: -1,
          httpOnly: true, secure: false, sameSite: "Lax" },
      ],
      origins: [],
    }),
  );
}
