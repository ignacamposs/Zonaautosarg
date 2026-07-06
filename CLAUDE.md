# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Zona Autos is a static website for a used car dealership in Bariloche, Argentina (zonaautosarg.com). It is pure HTML/CSS/JS — no bundler, no framework, no build step. Tailwind CSS is loaded from CDN at runtime.

## Development

Open with VS Code Live Server (or any static file server) to preview locally. There is no build, lint, or test command. All pages reference Tailwind via CDN so styles work without any compilation step. The `input.css` and `tailwind.css` files are not wired into the pages — the CDN version is what runs.

To run the Python image importer:
```
pip install pillow-heif Pillow google-api-python-client google-auth-oauthlib
python convertir_autos.py
```
`credentials.json` and `token.json` are Google OAuth files required for Drive access. First run will open a browser for auth; subsequent runs use the cached token.

### Google Drive auth on Railway (`admin.py`)

`convertir_autos.autenticar()` tries a service account first (`service_account.json`, or the `GOOGLE_SERVICE_ACCOUNT_JSON` env var on Railway), falling back to the OAuth flow (`credentials.json`/`token.json`, or `GOOGLE_CREDENTIALS`/`GOOGLE_TOKEN` on Railway) if no service account is configured.

The service account is the preferred path for Railway: unlike the OAuth refresh token, its key doesn't expire, so the admin panel never shows `invalid_grant: Token has been expired or revoked`. Setup:
1. In Google Cloud Console (same project as the OAuth credentials), create a service account and download its JSON key.
2. Share the Drive root folder (`CARPETA_RAIZ_DRIVE` in `convertir_autos.py`) with the service account's email (Viewer is enough — the app only needs `drive.readonly`).
3. Set `GOOGLE_SERVICE_ACCOUNT_JSON` on Railway to the full contents of the key file.
4. The old `GOOGLE_CREDENTIALS`/`GOOGLE_TOKEN` vars can stay or be removed; they're only used when `GOOGLE_SERVICE_ACCOUNT_JSON` is absent.

## Architecture

### Data flow

`autos.json` is the single source of truth for all car data. `index.js` fetches it at runtime and renders cards dynamically into three different containers depending on which page is loaded:

- `contenedor-destacados` → home page (first 4 entries)
- `contenedor-catalogo` → `catalogo.html` (cars where `km > 0`)
- `contenedor-0km` → `0km.html` (cars where `km === 0`)

### Car listing pages

Each car in `unidades/` is a standalone static HTML file. The filename is derived from `{marca}-{modelo}` slugified (lowercase, NFD-normalized, no accents, spaces replaced by hyphens). This same slug logic lives in `index.js:renderizarTarjetas` and must match the actual filenames.

`unidad.js` is loaded by every individual car page and manages the image slider. Each page initializes the slider by calling `initSlider([...])` with its own image array inline. `unidad-schema.js` reads the DOM elements (`car-name`, `car-year`, `car-km`, `car-price`, `main-img`) and injects a JSON-LD `Car` schema into `<head>`.

### Image naming

Images follow the pattern `img/auto-{N}-{M}.webp` where `N` is an internal sequence number assigned by the Python script (not the `id` field in `autos.json`) and `M` is the photo index. The `id` in `autos.json` and the image number are independent.

### Key fields in autos.json

| Field | Notes |
|---|---|
| `km: 0` | Treated as a 0km vehicle |
| `precio: 0` | Displayed as "Consultar" |
| `moneda` | `"ARS"` or `"USD"` |
| `vendido: true` | Shows VENDIDO overlay, card is not clickable |

## Adding a new car

1. Upload photos to the Google Drive root folder (`1Kldd-Srn9PrgdL_NAlNtKww-9aHWywO9`).
2. Run `convertir_autos.py` — it downloads, converts to WebP at quality 85, and prints a JSON preview block to fill in.
3. Add the completed entry to `autos.json`.
4. Create `unidades/{marca}-{modelo}.html` by copying an existing unit page and updating all hardcoded values (title, meta, car name, year, km, price, transmission, description, image path, and the `initSlider([...])` call).
