# Deploying with Docker Compose (Hetzner VPS)

Stack: **Caddy** (only public service) → **Next.js** frontend + **FastAPI** backend → **PostgreSQL**.
Caddy serves everything from one origin: `/api/*` goes to the backend (prefix stripped), the rest to the
frontend. Backend, frontend and DB have no published host ports, so nothing collides with 3000/8000/5432.

## 1. Prerequisites on the VPS
- Docker Engine + the Compose plugin (`docker compose version`).
- Outbound internet during the first start (the backend downloads the Traffic/ILI/Weather datasets) and during
  `build` (npm, pip, Google Fonts).
- Open the chosen `HTTP_PORT` in the Hetzner Cloud Firewall (and `ufw allow <port>/tcp` if ufw is on).

## 2. First deploy
```bash
git clone <repo-url> tsf && cd tsf
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32) and a free HTTP_PORT
docker compose up -d --build
docker compose ps            # wait until backend / frontend are "healthy"
```
Open `http://<vps-ip>:<HTTP_PORT>` (default `8742`), register an account, then make it an admin:
```bash
docker compose exec backend python -m app.promote_admin you@example.com
```

First start takes a few minutes (CPU-only PyTorch image, ~1.5 GB; dataset downloads). The backend entrypoint
runs `alembic upgrade head` and the idempotent seed on every start. If a dataset download failed (e.g. Weather),
use **Admin → Datasets → Refresh** later.

## 3. Day-2 operations
| Task | Command |
|---|---|
| Logs | `docker compose logs -f backend` (or `frontend`, `caddy`, `db`) |
| Update to new code | `git pull && docker compose up -d --build` |
| Stop / start | `docker compose stop` / `docker compose start` |
| DB backup | `docker compose exec -T db pg_dump -U tsf tsf_forecasting_app > backup.sql` |
| DB restore | `docker compose exec -T db psql -U tsf tsf_forecasting_app < backup.sql` |
| Wipe everything | `docker compose down -v` (**deletes DB, uploads, results**) |

Data lives in named volumes: `pgdata` (database), `storage` (uploads + experiment result arrays), `data`
(downloaded dataset caches), `caddy_data`/`caddy_config`.

## 4. Notes
- **One backend worker only.** Experiments run in an in-process `ProcessPoolExecutor` (2 jobs at a time);
  don't add `--workers` or scale the `backend` service. Running experiments are marked failed after a restart.
- Experiments are CPU-bound (no GPU in the image). SARIMA on big datasets can take minutes.
- `JWT_SECRET` must stay stable; changing it logs everyone out.
- Dependency versions in `backend/requirements.txt` are pinned on purpose (e.g. `statsmodels<0.15` is required by
  `AutoReg(old_names=False)`).

## 5. Adding HTTPS later
With the current setup Caddy is HTTP-only on a custom port. Caddy can only obtain Let's Encrypt certificates when
it is reachable on **80/443** (or via DNS challenge). When you have a domain and free 80/443:
1. In `docker-compose.yml` publish `"80:80"` and `"443:443"` for `caddy`.
2. Set `SITE_ADDRESS=your.domain.com` in `.env`.
3. In `deploy/caddy/Caddyfile` remove `auto_https off`.
4. `docker compose up -d`. The session cookie works unchanged over HTTPS.
