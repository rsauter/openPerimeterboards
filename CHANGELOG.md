# Changelog

## 0.7.2 — 2026-10-16

### Added
- License: **AGPL-3.0-or-later** (`LICENSE`, `package.json`, README) — required by MuPDF
- Footer link to the source code (AGPL §13 for network use)
- `docs/DEPLOY-RAILWAY.md`: deployment and operations guide for Railway
- `fonts/` folder for optional licensed font files

### Fixed
- Docker runtime image now contains `src/lib` (shared modules imported by the server) — the
  container failed to start since v0.6
- Docker image runs as non-root user and has a `HEALTHCHECK`

## 0.7.1 — 2026-10-16

### Added
- **Replace file…** for graphics: swap the file behind a logo (e.g. an SVG-only logo from v0.5/0.6
  with the original EPS/AI/PDF) while keeping position, width and layer order
- Layer list shows the kept original format (EPS, AI, PDF, SVG) or a warning badge *SVG only*
- Warning when the API server version does not match the app (forgot `npm install` / restart)

## 0.7.0 — 2026-10-16

### Added
- **Original graphics are kept**: uploaded PDF / AI / EPS / SVG files are stored in the
  browser (IndexedDB) and embedded **1:1 into the print PDF** (vector, original CMYK values)
- **Project files `.adbanner`** (ZIP: `project.json` + `assets/` with originals and previews);
  *Save* downloads, *Open* imports. Old `.json` projects still open
- **Projects dialog** ("recently edited"): all banners in this browser with thumbnail,
  open / delete, storage usage; *New* no longer discards the current banner
- **Image preview for complex graphics**: if the SVG preview would exceed 2 MB
  (`PREVIEW_SVG_MAX_KB`), the server returns a PNG preview — editing stays smooth, print uses the original
- Placeholder + warning for graphics missing in browser storage

### Changed
- Server is **stateless**: nothing is stored; PDF export receives originals per request (multipart)
- Banner JSON references graphics by `assetId` instead of inline SVG (small undo history / autosave)
- Autosave moved from localStorage to IndexedDB (v0.6 autosave is migrated automatically)
- PDF colour option renamed: *As designed* (logos keep original colours) / *Convert all to CMYK*

## 0.6.1 — 2026-10-16

### Added
- Print PDF: option *Both versions as ZIP* — one download with
  `…_mit-schnittmarken.pdf` and `…_ohne-schnittmarken.pdf`
- PDF file names now state whether crop marks are included

## 0.6.0 — 2026-10-16

### Added
- **Print PDF export** (Export → *PDF for print…*): vector PDF in millimetres
  - final size in mm (presets 1 px = 1 mm, 72 / 96 / 150 / 300 dpi or free input)
  - bleed (0 / 2 / 3 / 5 mm or custom) — background is extended automatically
  - crop marks, TrimBox / BleedBox set for the print shop
  - fonts embedded (system TrueType fonts, Liberation fallback); report of substitutions
  - optional CMYK conversion and text-to-outlines via Ghostscript
  - live preview of trim / bleed / page size
- Print size presets (A6–A2, DL flyer, roll-up 85 × 200 cm) at 1 px = 1 mm
- `POST /api/export/pdf` endpoint, print settings saved with the project

## 0.5.0 — 2026-10-16

First functional release covering the project goals.

### Added
- Banner sizes: IAB / mobile / social presets and custom size
- Background color (incl. transparent), banner-wide default font color and font
- Vector upload for SVG, PDF, AI (PDF-compatible) and EPS (via Ghostscript), converted server-side to sanitized SVG
- Text elements with individual font size, font, weight, style, color, alignment, line height, letter spacing
- Canvas editing: drag, snap guides, resize handle, rotation, opacity, keyboard nudging
- Layers: reorder, hide, lock, duplicate, delete
- Undo / redo, browser autosave, project save / open (JSON)
- Export: PNG, PNG @2x, JPG (quality), SVG
- Light / dark theme
- Express API (`/api/health`, `/api/convert`), Dockerfile
