# Deploying on Railway

The app is a single stateless container (API + built frontend). Nothing is stored on
the server, so no volume and no database are needed.

## 1. Create the service

1. Railway dashboard → **New Project → Deploy from GitHub repo** → `rsauter/openPerimeterboards`.
2. Railway detects the `Dockerfile` and builds it automatically (multi-stage: Vite build → Node runtime
   with Ghostscript and Liberation fonts).
3. Railway injects `PORT`; the server listens on it. No start command needed.

## 2. Service settings

| Setting | Value |
|---|---|
| Networking → Public domain | *Generate Domain* (or add a custom domain) |
| Deploy → Healthcheck path | `/api/health` |
| Deploy → Restart policy | On failure |
| Region | EU West (closest to Switzerland) |
| Serverless (optional) | On – sleeps after ~5–10 min without traffic; first request after a pause takes a few seconds and may return a 502 once |

Railway config-as-code (`railway.json`) is deprecated, so these settings are made in the dashboard.

## 3. Variables (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `MAX_UPLOAD_MB` | `25` | Max. size per uploaded graphic |
| `PREVIEW_SVG_MAX_KB` | `2048` | Above this, the editor gets a PNG preview |
| `FONTS_DIR` | – | Extra font folder inside the container |
| `GS_PATH` | auto | Ghostscript binary (installed in the image) |

## 4. Check the deployment

```bash
curl https://<your-domain>/api/health
```

Expected: `"status":"ok"`, `"eps":true`, `"pdfExport":{"cmyk":true,...}` (Ghostscript present).

## Fonts

The container has no Windows fonts. Arial / Times / Courier are replaced by the metric-compatible
Liberation fonts in print PDFs (the app shows a warning). To embed the exact CI fonts, add licensed
font files to `fonts/` — only if the license allows redistribution, because this repository is public.

## Costs (as of Oct 2026)

Measured: ~120–170 MB RAM, ~20–300 ms CPU per PDF export. With 0.2 GB RAM always on this is about
2–3 USD/month of usage, covered by the 5 USD included in the Hobby plan. Per banner the cost is below
0.0001 USD (mostly download traffic). See <https://docs.railway.com/pricing/plans>.

## Operations notes

- **Stateless:** a redeploy or restart loses nothing; projects live in the users' browsers and in their `.adbanner` files.
- **Logs:** one line per conversion / export (`[convert] …`, `[pdf] …`) incl. sizes and duration — no file contents are logged.
- **Updates:** push to `main` → Railway rebuilds and redeploys; the health check gates the switch.
- **Version check:** the frontend warns if the API version differs (stale deployment / cache).
- **License:** AGPL-3.0 — the app links to its source code in the footer, as required for network use.
