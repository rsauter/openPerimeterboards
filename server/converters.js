// Converts uploaded vector graphics (SVG, PDF, AI, EPS) into a sanitized SVG string.
//  - SVG      -> sanitized and passed through
//  - PDF / AI -> MuPDF (WebAssembly, no native install needed)
//  - EPS / legacy PostScript AI -> Ghostscript (EPS -> PDF) -> MuPDF
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as mupdf from 'mupdf'
import { createHash } from 'node:crypto'
import { msg } from './i18n.js'

const run = promisify(execFile)

export class ConversionError extends Error {
  /** key: message key in server/i18n.js; the English text is used for logs */
  constructor(key, status = 422, params = {}) {
    super(msg('en', key, params))
    this.key = key
    this.params = params
    this.status = status
  }
  localized(lang) {
    return msg(lang, this.key, this.params)
  }
}

// ---------------------------------------------------------------- Ghostscript

const GS_CANDIDATES = process.env.GS_PATH
  ? [process.env.GS_PATH]
  : process.platform === 'win32'
    ? ['gswin64c', 'gswin32c', 'gs']
    : ['gs']

let gsBinary // undefined = not probed yet, null = not available

export async function findGhostscript() {
  if (gsBinary !== undefined) return gsBinary
  gsBinary = null
  for (const bin of GS_CANDIDATES) {
    try {
      const { stdout } = await run(bin, ['--version'], { timeout: 5000 })
      gsBinary = { bin, version: stdout.trim() }
      break
    } catch { /* try next */ }
  }
  return gsBinary
}

async function postscriptToPdf(buffer) {
  const gs = await findGhostscript()
  if (!gs) {
    throw new ConversionError('gsRequired', 501)
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'adgen-'))
  const input = path.join(dir, 'in.eps')
  const output = path.join(dir, 'out.pdf')
  try {
    await writeFile(input, buffer)
    await run(gs.bin, [
      '-q', '-dNOPAUSE', '-dBATCH', '-dSAFER',
      '-sDEVICE=pdfwrite', '-dEPSCrop', '-dCompatibilityLevel=1.5',
      `-sOutputFile=${output}`, input,
    ], { timeout: 30000 })
    return await readFile(output)
  } catch (err) {
    if (err instanceof ConversionError) throw err
    throw new ConversionError('gsFailed', 422, { detail: err.message.split('\n')[0] })
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

// ---------------------------------------------------------------- MuPDF

function openPdf(buffer) {
  try {
    return mupdf.Document.openDocument(buffer, 'application/pdf')
  } catch (err) {
    throw new ConversionError('pdfUnreadable', 422, { detail: err.message })
  }
}

function pdfToSvg(buffer, pageIndex = 0, { previewMaxBytes = Infinity, previewPx = 2400 } = {}) {
  const doc = openPdf(buffer)
  const pageCount = doc.countPages()
  if (pageCount < 1) throw new ConversionError('noPages')
  const index = Math.min(Math.max(0, pageIndex | 0), pageCount - 1)
  const page = doc.loadPage(index)
  const out = new mupdf.Buffer()
  // text=path: glyphs become outlines -> independent of installed fonts
  const writer = new mupdf.DocumentWriter(out, 'svg', 'text=path')
  const device = writer.beginPage(page.getBounds())
  page.run(device, mupdf.Matrix.identity)
  writer.endPage()
  writer.close()
  const svg = out.asString()
  let png = null
  if (svg.length > previewMaxBytes) {
    // too heavy for a smooth editor: raster preview instead (print still uses the original)
    const [x0, y0, x1, y1] = page.getBounds()
    const zoom = Math.min(8, previewPx / Math.max(x1 - x0, y1 - y0))
    const pix = page.toPixmap(mupdf.Matrix.scale(zoom, zoom), mupdf.ColorSpace.DeviceRGB, true, true)
    png = Buffer.from(pix.asPNG())
  }
  return { svg, png, pageCount, page: index }
}

/** Page count / sanity check of an original before print. */
export function pdfPageCount(buffer) {
  return openPdf(buffer).countPages()
}

// ---------------------------------------------------------------- SVG

export function sanitizeSvg(svg) {
  let s = svg
    .replace(/^﻿/, '')
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\])?\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href\s*=\s*["'])\s*javascript:[^"']*(["'])/gi, '$1#$2')
    .trim()
  const start = s.search(/<svg[\s>]/i)
  if (start < 0) throw new ConversionError('invalidSvg')
  s = s.slice(start)
  // ensure namespace (needed when used as data-URI image)
  if (!/<svg[^>]*\sxmlns\s*=/i.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  return s
}

export function svgDimensions(svg) {
  const tag = (svg.match(/<svg[^>]*>/i) || [''])[0]
  const attr = (name) => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
    return m ? m[1] : null
  }
  const num = (v) => {
    if (!v || /%$/.test(v)) return null
    const n = parseFloat(v)
    if (!isFinite(n) || n <= 0) return null
    if (/mm$/i.test(v)) return n * 3.7795
    if (/cm$/i.test(v)) return n * 37.795
    if (/in$/i.test(v)) return n * 96
    if (/pt$/i.test(v)) return n * 1.3333
    return n
  }
  const vb = attr('viewBox')?.trim().split(/[\s,]+/).map(Number)
  let width = num(attr('width'))
  let height = num(attr('height'))
  if (vb?.length === 4 && vb[2] > 0 && vb[3] > 0) {
    if (!width && !height) { width = vb[2]; height = vb[3] }
    else if (!width) width = (height * vb[2]) / vb[3]
    else if (!height) height = (width * vb[3]) / vb[2]
  }
  return { width: width || 100, height: height || 100, hasViewBox: vb?.length === 4 }
}

/** Ensure the SVG has a viewBox and explicit pixel size so it scales cleanly. */
function normalizeSvg(svg) {
  const dims = svgDimensions(svg)
  if (!dims.hasViewBox) {
    svg = svg.replace(/<svg/i, `<svg viewBox="0 0 ${dims.width} ${dims.height}"`)
  }
  svg = svg.replace(/<svg([^>]*)>/i, (_, attrs) => {
    const cleaned = attrs
      .replace(/\swidth\s*=\s*["'][^"']*["']/i, '')
      .replace(/\sheight\s*=\s*["'][^"']*["']/i, '')
      .replace(/\spreserveAspectRatio\s*=\s*["'][^"']*["']/i, '')
    return `<svg${cleaned} width="${dims.width}" height="${dims.height}" preserveAspectRatio="none">`
  })
  return { svg, width: dims.width, height: dims.height }
}

// ---------------------------------------------------------------- detection

export const SUPPORTED_EXTENSIONS = ['svg', 'pdf', 'ai', 'eps']
const PREVIEW_SVG_MAX_BYTES = (Number(process.env.PREVIEW_SVG_MAX_KB) || 2048) * 1024

export function detectFormat(buffer, filename) {
  const ext = path.extname(filename || '').slice(1).toLowerCase()
  const head = buffer.subarray(0, 1024).toString('latin1')
  if (head.startsWith('%PDF') || head.includes('%PDF-')) return { ext, kind: 'pdf' }
  if (buffer.length >= 4 && (buffer.readUInt32BE(0) === 0xc5d0d3c6 || head.startsWith('%!PS'))) return { ext, kind: 'postscript' }
  if (/<svg[\s>]/i.test(buffer.subarray(0, 4096).toString('utf8'))) return { ext, kind: 'svg' }
  return { ext, kind: null }
}

function unsupported(ext) {
  return new ConversionError(ext === 'ai' ? 'aiNotPdf' : 'unknownContent')
}

/** Sanitized, normalized SVG from SVG source text (used for preview and print). */
export function prepareSvg(text) {
  return normalizeSvg(sanitizeSvg(text))
}

/** Original (PDF / AI / EPS) -> PDF bytes suitable for embedding into the print PDF. */
export async function originalToPdf(buffer, filename) {
  const { kind, ext } = detectFormat(buffer, filename)
  if (kind === 'pdf') return buffer
  if (kind === 'postscript') return postscriptToPdf(buffer)
  throw unsupported(ext)
}

export function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 32)
}

/**
 * Convert an uploaded original into an editor preview. Nothing is stored:
 * the browser keeps original + preview, the server forgets everything.
 */
export async function convertUpload(buffer, filename, { page = 0 } = {}) {
  const { ext, kind } = detectFormat(buffer, filename)
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new ConversionError('unsupportedType', 415, { ext, allowed: SUPPORTED_EXTENSIONS.join(', ') })
  }
  let result
  switch (kind) {
    case 'svg':
      result = { svg: buffer.toString('utf8'), png: null, pageCount: 1, page: 0 }
      break
    case 'pdf': // PDF and PDF-compatible AI files
      result = pdfToSvg(buffer, page, { previewMaxBytes: PREVIEW_SVG_MAX_BYTES })
      break
    case 'postscript': // EPS and legacy (non PDF-compatible) AI files
      result = pdfToSvg(await postscriptToPdf(buffer), page, { previewMaxBytes: PREVIEW_SVG_MAX_BYTES })
      break
    default:
      throw unsupported(ext)
  }
  const normalized = prepareSvg(result.svg)
  const preview = result.png
    ? { kind: 'png', mime: 'image/png', data: result.png.toString('base64') }
    : { kind: 'svg', mime: 'image/svg+xml', svg: normalized.svg }
  return {
    id: hashBuffer(buffer),
    sourceFormat: ext,
    kind,
    size: buffer.length,
    width: normalized.width,
    height: normalized.height,
    pageCount: result.pageCount,
    page: result.page,
    preview,
  }
}

/** v0.5/0.6 compatible: returns the SVG directly. */
export async function convertToSvg(buffer, filename, opts) {
  const r = await convertUpload(buffer, filename, opts)
  if (r.preview.kind !== 'svg') throw new ConversionError('tooComplex')
  return { svg: r.preview.svg, width: r.width, height: r.height, sourceFormat: r.sourceFormat, pageCount: r.pageCount, page: r.page }
}
