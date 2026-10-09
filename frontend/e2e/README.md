# End-to-end acceptance tests (Playwright)

Run from `frontend/`:

```
npm run test:e2e                      # whole suite
npx playwright test auth compare      # selected spec files
npm run test:e2e:ui                   # interactive UI mode
npx playwright show-report            # last HTML report
```

## How it works
- `playwright.config.ts` starts the **backend** (port 8000) after dropping/recreating an isolated
  PostgreSQL database `tsf_e2e` (override with `E2E_DB`), running `alembic upgrade head` and
  `python -m app.seed`; it then starts the **frontend** (`npm run dev`, port 3000).
- `e2e/global-setup.ts` registers `e2e-admin@example.com`, promotes it with `app.promote_admin`
  and stores its session in `e2e/.auth/admin.json` (used by the `adminPage` fixture).
- The dev database `tsf_forecasting_app` is never touched. **Stop your own dev backend first** (port 8000
  must be free); an already-running dev frontend on :3000 is reused.
- Each test registers its own users (`userPage`, `newBrowserUser`), so specs are independent.

## Notes
- Fast runs use the seeded ILI dataset with Tensor-AR (test 3 / input 2) or DLinear with 2–3 epochs.
  SARIMA (minutes) and the Weather dataset (needs network) are deliberately avoided.
- Labels in the UI are not linked to inputs, so `e2e/helpers/locators.ts` has `fieldInput`/`fieldSelect`/`setSlider`.
- Spec map: `auth`, `route-protection`, `navigation-theme`, `datasets`, `models`, `experiment-create`,
  `experiment-run`, `experiments-list`, `compare`, `admin`, `api-contract`.
- The admin dataset page only lists datasets the admin can see (own + public), so admin specs use
  admin-owned or public datasets.

## Watching the tests
`npm run test:e2e:demo` runs headed, one worker, with a 700 ms pause after every action.
Tune the pause: `E2E_SLOWMO=1500 npx playwright test --headed --workers=1 auth`.
