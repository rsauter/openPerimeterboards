import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { convertUpload, findGhostscript, ConversionError, SUPPORTED_EXTENSIONS } from './converters.js'
import { bannerToPdf } from './pdf.js'
import { fontIndexSize } from './fonts.js'
import { createZip } from '../src/lib/zip.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 25
const VERSION = '0.7.3'

// The server is stateless: uploads are held in memory only for the duration of a request.
const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 200 } })

app.get('/api/health', async (_req, res) => {
  const gs = await findGhostscript()
  res.json({
    status: 'ok',
    version: VERSION,
    formats: { svg: true, pdf: true, ai: true, eps: Boolean(gs) },
    ghostscript: gs?.version ?? null,
    pdfExport: { available: true, cmyk: Boolean(gs), outlineText: Boolean(gs), originals: true, fontsFound: fontIndexSize() },
    maxUploadMb: MAX_UPLOAD_MB,
  })
})

app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received in field "file".' })
  const started = Date.now()
  try {
    const result = await convertUpload(req.file.buffer, req.file.originalname, { page: Number(req.query.page) || 0 })
    const pv = result.preview.kind === 'svg' ? `${result.preview.svg.length} B SVG` : `${result.preview.data.length} B PNG(b64) preview`
    console.log(`[convert] ${req.file.originalname} (${result.sourceFormat}, ${req.file.size} B) -> ${pv} in ${Date.now() - started} ms`)
    res.json({ name: req.file.originalname, mime: req.file.mimetype, ...result })
  } catch (err) {
    const status = err instanceof ConversionError ? err.status : 500
    console.warn(`[convert] ${req.file.originalname} failed: ${err.message}`)
    res.status(status).json({ error: err.message })
  }
})

// Multipart: field "project" = JSON { banner, options }, files "asset" named <assetId>.
// Also accepts plain JSON { banner, options } (graphics with inline SVG only).
function parseExportRequest(req, res, next) {
  if (req.is('application/json')) return express.json({ limit: '60mb' })(req, res, next)
  return upload.array('asset')(req, res, (err) => {
    if (err) return next(err)
    try {
      Object.assign(req.body, JSON.parse(req.body.project || '{}'))
      next()
    } catch {
      res.status(400).json({ error: 'Invalid project JSON' })
    }
  })
}

app.post('/api/export/pdf', parseExportRequest, async (req, res) => {
  const { banner, options = {} } = req.body || {}
  const assets = new Map((req.files || []).map((f) => [f.originalname, { buffer: f.buffer, name: f.originalname }]))
  for (const [id, meta] of Object.entries(req.body.assets || {})) {
    if (assets.has(id)) assets.get(id).name = meta.name || id
  }
  const started = Date.now()
  try {
    const slug = String(banner?.name || 'banner').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'banner'
    let body, filename, report, contentType
    if (options.bothVersions) {
      // same artwork twice: with and without crop marks, bundled as ZIP
      const withMarks = await bannerToPdf(banner, { ...options, cropMarks: true }, assets)
      const without = await bannerToPdf(banner, { ...options, cropMarks: false }, assets)
      report = { ...withMarks.report, cropMarks: 'both' }
      const base = `${slug}_${report.trimMm[0]}x${report.trimMm[1]}mm`
      body = Buffer.from(createZip([
        { name: `${base}_mit-schnittmarken.pdf`, data: withMarks.buffer },
        { name: `${base}_ohne-schnittmarken.pdf`, data: without.buffer },
      ]))
      filename = `${base}_print.zip`
      contentType = 'application/zip'
    } else {
      const result = await bannerToPdf(banner, options, assets)
      report = result.report
      body = result.buffer
      filename = `${slug}_${report.trimMm[0]}x${report.trimMm[1]}mm_${report.cropMarks ? 'mit' : 'ohne'}-schnittmarken.pdf`
      contentType = 'application/pdf'
    }
    console.log(`[pdf] ${filename} ${report.colorMode.toUpperCase()} bleed ${report.bleedMm}mm, ${report.originals} original(s) -> ${body.length} B in ${Date.now() - started} ms`)
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Pdf-Report': encodeURIComponent(JSON.stringify(report)),
      'Access-Control-Expose-Headers': 'X-Pdf-Report, Content-Disposition',
    })
    res.send(body)
  } catch (err) {
    const status = err instanceof ConversionError ? err.status : 500
    console.warn(`[pdf] failed: ${err.stack || err.message}`)
    res.status(status).json({ error: err.message })
  }
})

// multer / generic error handler
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Banner data too large.' })
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large (max. ${MAX_UPLOAD_MB} MB).` })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal error' })
})

// serve built frontend in production
const dist = path.resolve(__dirname, '..', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, async () => {
  const gs = await findGhostscript()
  console.log(`Adbanner API v${VERSION} listening on http://localhost:${PORT}`)
  console.log(`  formats: ${SUPPORTED_EXTENSIONS.join(', ')}  |  Ghostscript (EPS/CMYK): ${gs ? gs.version : 'not found'}`)
  console.log('  stateless: nothing is stored on the server')
  if (existsSync(dist)) console.log(`  serving frontend from ${dist}`)
})
