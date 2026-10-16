# openPerimeterboards – Adbanner Generator

Small web app to compose ad banners in individual sizes — **Node.js · Vue 3 · Tailwind CSS 4 · DaisyUI 5**.

Version **0.8.0** · License **AGPL-3.0-or-later** (see [CHANGELOG](CHANGELOG.md)).

## Features (v0.5)

| Project goal | Implementation |
|---|---|
| Individual banner sizes | 14 presets (IAB display, mobile, social) + custom W×H (1–4000 px), swap W/H |
| Background color | Color picker + hex input + swatches, optional transparent background |
| Font color | Banner-wide default font color, overridable per text element |
| Vector upload `.svg` `.pdf` `.ai` `.eps` | Drag & drop / file picker → server converts to sanitized SVG (vector stays vector) |
| Text elements with individual size | Unlimited text layers: size, font, weight, italic/underline, color, alignment, line height, letter spacing, multi-line |

Projects are stored **in the browser** (IndexedDB, incl. the original logo files) and can be saved/opened as **`.adbanner`** files. The server stores nothing.

Plus: drag & drop positioning with snap guides (edges / centre), resize handle (graphics: size, text: font size), rotation, opacity, layer list (order, hide, lock, delete, duplicate), undo/redo, autosave in the browser, project save/open (`.adbanner.json`), export to **PNG**, **PNG @2x**, **JPG** (quality slider), **SVG** and **print PDF** (mm, bleed, crop marks, embedded fonts, optional CMYK), light/dark theme.

## Quick start

Requirements: **Node.js ≥ 20**.

```bash
npm install
npm run dev        # API on :3001 + Vite dev server on http://localhost:5173
```

Production-like:

```bash
npm run build
npm start          # serves app + API on http://localhost:3001
```

## Languages

The UI is available in **German, French, Italian and English** (switcher in the top bar; default = browser language).

- Texts: `src/i18n/{de,fr,it,en}.js` — same keys in every file, `{placeholder}` interpolation, English is the fallback.
- Server error messages: `server/i18n.js`, selected via the `Accept-Language` header the app sends.
- Add a language: copy `en.js`, translate, register it in `src/i18n/index.js` (`MESSAGES`, `LOCALES`) and in `server/i18n.js`.

## Projects & storage

| Where | What |
|---|---|
| Server | **nothing** – converts uploads and renders PDFs per request, keeps no files |
| Browser (IndexedDB) | all projects ("Projects" dialog), original uploads + previews, autosave |
| `.adbanner` file | ZIP: `project.json` + `assets/<id>.<ext>` (original) + `assets/<id>.preview.svg/png` |

- **Save** (Ctrl+S) downloads the `.adbanner` file – use it as backup, to share or to continue on another computer.
- **Open** (Ctrl+O) imports a `.adbanner` (or a v0.5/0.6 `.json`). If the project already exists locally you can replace it or open it as a copy.
- Clearing browser data deletes the local project list – keep the `.adbanner` files.
- Graphics from v0.5/0.6 projects only exist as converted SVG (badge *SVG only*). Use **Properties → Replace file…** to attach the original EPS/AI/PDF.
- Identical uploads are stored once (SHA-256 content id); deleting a project removes graphics no other project uses.

## Vector conversion

| Format | Converter | Extra install |
|---|---|---|
| SVG | sanitized pass-through (scripts / event handlers removed) | – |
| PDF | [MuPDF](https://mupdf.com) via the `mupdf` npm package (WebAssembly) | – |
| AI  | Illustrator files saved *PDF-compatible* (default) → MuPDF | – |
| EPS | Ghostscript (EPS → PDF) → MuPDF | **Ghostscript** |

Only the **first page** of a multi-page PDF/AI is imported. The editor preview has text converted to outlines. If the preview SVG would exceed 2 MB, a PNG preview is used instead (editing stays fast). **For print, the original file is embedded**, not the preview.

### Ghostscript for EPS

- **Windows:** install from <https://ghostscript.com/releases/gsdnld.html>. The server looks for `gswin64c` / `gswin32c` on the `PATH`; otherwise set `GS_PATH`, e.g.
  `set GS_PATH=C:\Program Files\gs\gs10.05.1\bin\gswin64c.exe`
- **Linux / Docker:** `apt install ghostscript`
- `GET /api/health` shows whether EPS is available; the upload area strikes out *EPS* if not.

## Print PDF

*Export → PDF for print…* creates a vector PDF for the print shop:

| Setting | Notes |
|---|---|
| Final size (mm) | Banner px are scaled: `1 px = 1 mm` (default for the *Print* size presets), 72/96/150/300 dpi or any width in mm |
| Bleed | 0 / 2 / 3 / 5 mm or custom. Background is extended; let edge graphics overlap the banner edge |
| Crop marks | Outside the bleed, page gets a 9 mm slug |
| Both versions as ZIP | One download containing the PDF with and without crop marks (`…_mit-schnittmarken.pdf` / `…_ohne-schnittmarken.pdf`) |
| Page boxes | `TrimBox` = final size, `BleedBox` = final size + bleed |
| Fonts | Embedded as subsets. Looked up in the OS font folder (`C:\Windows\Fonts`, `/usr/share/fonts`, …), a project `fonts/` folder or `FONTS_DIR`. Missing fonts fall back to Liberation/DejaVu; the app warns about substitutions |
| CMYK / text outlines | Ghostscript post-processing (`-sColorConversionStrategy=CMYK`, `-dNoOutputFonts`) — only available when Ghostscript is installed |

Uploaded PDF/AI/EPS logos are embedded **from the original file** (vector, CMYK values and spot colours as delivered). With *As designed*, text and background are RGB and logos keep their original colours. *Convert all to CMYK* runs Ghostscript over the whole page (DeviceCMYK content stays unchanged; RGB is converted generically, no ICC profile choice such as PSO Coated v3 yet).

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API / production port |
| `GS_PATH` | auto | Path to the Ghostscript executable |
| `MAX_UPLOAD_MB` | `25` | Upload size limit |
| `PREVIEW_SVG_MAX_KB` | `2048` | Above this SVG size a PNG preview is used in the editor |
| `FONTS_DIR` | – | Extra font folder(s) for PDF embedding (`;`-separated on Windows) |

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Status, version, available formats |
| `POST` | `/api/convert?page=0` | multipart field `file` → `{ id, name, sourceFormat, width, height, pageCount, page, preview: { kind: 'svg', svg } \| { kind: 'png', data } }` |
| `POST` | `/api/export/pdf` | multipart: `project` = JSON `{ banner, options, assets }`, files `asset` (filename = asset id) → PDF or ZIP, report in header `X-Pdf-Report` |

## Docker

```bash
docker build -t adbanner-generator .
docker run -p 3001:3001 adbanner-generator
```

The image contains Ghostscript (EPS, CMYK) and Liberation/DejaVu fonts. Optional licensed fonts go into `fonts/`.

## Deployment on Railway

See [docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md) — one stateless container, no volume or database, about 5 USD/month.

## Project structure

```
server/
  index.js          Express: /api routes, serves dist/ in production
  converters.js     SVG sanitizing, PDF/AI (MuPDF), EPS (Ghostscript)
  pdf.js            Print PDF: PDFKit layers + embedded originals (pdf-lib), bleed, crop marks, Ghostscript pass
  fonts.js          Maps CSS font families to installed TTF files for embedding
  i18n.js           Localized server error messages
src/
  App.vue           Layout, toolbar, export, shortcuts, toasts
  components/       BannerCanvas, BannerSettings, ElementProperties,
                    LayersPanel, UploadDropzone, ColorField, NumberField,
                    PdfExportDialog
  lib/
    store.js        Reactive banner state, actions, undo/redo, autosave
    db.js           IndexedDB helper
    assets.js       Original uploads + previews (IndexedDB), migration of inline SVGs
    projects.js     Project list, .adbanner read/write
    zip.js          Minimal ZIP reader/writer (browser + server)
    units.js        px / mm / pt display units
  i18n/             UI translations (de, fr, it, en) + t() helper
    render.js       Shared geometry + SVG serialization (editor = export)
    export.js       PNG/JPG/SVG/project export
    presets.js      Banner sizes, fonts, swatches
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| Arrows / Shift+Arrows | Nudge selection 1 px / 10 px |
| Del / Backspace | Delete selection |
| Ctrl+D | Duplicate |
| Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) | Undo / Redo |
| Ctrl+S | Save project file (.adbanner) |
| Ctrl+O | Open project file |
| Esc | Deselect |
| Alt while dragging | Disable snapping |

## Known limitations (v0.5)

- Fonts are limited to common system fonts (an SVG rendered into a canvas cannot load web fonts). Custom/web fonts are planned.
- Multi-page PDF/AI: first page only.
- Projects live in one browser; there is no shared server storage by design.
- PDF pages with a `/Rotate` entry are embedded unrotated.
- Uploaded graphics are kept as a whole — individual colors inside a logo cannot be recolored yet.
- CMYK conversion without ICC profile selection.
- `mupdf` is AGPL-3.0 licensed — fine for internal use; check before distributing the app externally.

## Roadmap ideas

- Page picker for multi-page PDF/AI
- Web font upload / Google Fonts embedding in export
- Shapes (rectangle, CTA button with background), gradients, image (PNG/JPG) layers
- Batch export: one design → multiple sizes (responsive layout rules)
- Templates / brand presets (Quickline colors & logos)
- File-size budget check for ad networks (e.g. ≤ 150 KB)

## License

Copyright (C) 2026 Roger Sauter

This program is free software: you can redistribute it and/or modify it under the terms of the
**GNU Affero General Public License** as published by the Free Software Foundation, either version 3
of the License, or (at your option) any later version. See [LICENSE](LICENSE).

AGPL was chosen because the PDF engine [MuPDF](https://mupdf.com) (`mupdf` npm package) is AGPL-3.0.
If you run a modified version as a network service, you must offer its source code to the users
(the app links to the source in its footer).

Third-party components: Vue (MIT), Tailwind CSS (MIT), daisyUI (MIT), Express (MIT), multer (MIT),
PDFKit (MIT), svg-to-pdfkit (MIT), pdf-lib (MIT), MuPDF (AGPL-3.0), Ghostscript (AGPL-3.0, separate binary).
