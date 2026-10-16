// Print PDF export: vector output with embedded fonts, bleed, crop marks and
// optional CMYK conversion / text outlining via Ghostscript.
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { textMarkup, rotationTransform } from '../src/lib/render.js'
import { resolveFont } from './fonts.js'
import { findGhostscript, ConversionError, detectFormat, prepareSvg, originalToPdf } from './converters.js'
import {
  PDFDocument as LibDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix, rectangle, clip, endPath,
} from 'pdf-lib'

const run = promisify(execFile)
const PT_PER_MM = 72 / 25.4

const clamp = (v, min, max, def) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}

export function normalizeOptions(o = {}) {
  return {
    mmPerPx: clamp(o.mmPerPx, 0.001, 100, 25.4 / 96),
    bleedMm: clamp(o.bleedMm, 0, 20, 3),
    cropMarks: o.cropMarks !== false,
    colorMode: o.colorMode === 'cmyk' ? 'cmyk' : 'rgb',
    outlineText: Boolean(o.outlineText),
    bothVersions: Boolean(o.bothVersions),
  }
}

/** Replace the root <svg> tag so the graphic becomes a nested, positioned viewport. */
function nestGraphic(el, svg) {
  return svg.replace(/<svg\b([^>]*)>/i, (_, attrs) => {
    const vb = attrs.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1] || `0 0 ${el.naturalWidth} ${el.naturalHeight}`
    const keep = attrs.replace(/\s(x|y|width|height|viewBox|preserveAspectRatio)\s*=\s*["'][^"']*["']/gi, '')
    return `<svg${keep} x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" viewBox="${vb}" preserveAspectRatio="none">`
  })
}

function elementSvg(el, banner, view, svgSource) {
  let body
  if (el.type === 'graphic') {
    const t = rotationTransform(el)
    const op = el.opacity < 1 ? ` opacity="${el.opacity}"` : ''
    body = `<g${t ? ` transform="${t}"` : ''}${op}>${nestGraphic(el, svgSource)}</g>`
  } else {
    body = textMarkup(el, banner)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" width="${view.w}" height="${view.h}">${body}</svg>`
}

function drawCropMarks(doc, { m, trimW, trimH, bleed }) {
  const gap = bleed + 1 * PT_PER_MM // marks start outside the bleed
  const len = 6 * PT_PER_MM
  doc.save().lineWidth(0.25).strokeColor('black')
  for (const x of [m, m + trimW]) {
    doc.moveTo(x, m - gap).lineTo(x, m - gap - len).stroke()
    doc.moveTo(x, m + trimH + gap).lineTo(x, m + trimH + gap + len).stroke()
  }
  for (const y of [m, m + trimH]) {
    doc.moveTo(m - gap, y).lineTo(m - gap - len, y).stroke()
    doc.moveTo(m + trimW + gap, y).lineTo(m + trimW + gap + len, y).stroke()
  }
  doc.restore()
}

/**
 * Decide per graphic how it goes into the print PDF:
 *  - 'original': PDF / AI / EPS original is embedded 1:1 (vector, original colours incl. CMYK)
 *  - 'svg':      SVG original or legacy inline SVG, drawn via svg-to-pdfkit
 */
async function resolveGraphics(banner, assets) {
  const out = new Map()
  const missing = []
  for (const el of banner.elements) {
    if (el.type !== 'graphic' || el.visible === false) continue
    const asset = el.assetId ? assets.get(el.assetId) : null
    if (asset) {
      const { kind } = detectFormat(asset.buffer, asset.name)
      if (kind === 'svg') out.set(el, { mode: 'svg', svg: prepareSvg(asset.buffer.toString('utf8')).svg })
      else out.set(el, { mode: 'original', asset })
    } else if (el.svg) {
      out.set(el, { mode: 'svg', svg: el.svg })
    } else {
      missing.push(el.name || el.assetId)
    }
  }
  if (missing.length) throw new ConversionError(`Missing graphic data for: ${missing.join(', ')}. Re-open the project file or upload the graphic again.`, 400)
  return out
}

/** Build the print PDF. Returns { buffer, report }. */
export async function renderPdf(banner, rawOptions, assets = new Map()) {
  const opts = normalizeOptions(rawOptions)
  const W = Number(banner?.width)
  const H = Number(banner?.height)
  if (!(W > 0 && H > 0) || !Array.isArray(banner.elements)) throw new ConversionError('Invalid banner data', 400)

  const s = opts.mmPerPx * PT_PER_MM // pt per banner px
  const trimW = W * s
  const trimH = H * s
  const bleed = opts.bleedMm * PT_PER_MM
  const m = opts.cropMarks ? bleed + 9 * PT_PER_MM : bleed // page margin around trim
  const pageW = trimW + 2 * m
  const pageH = trimH + 2 * m
  if (pageW > 14400 || pageH > 14400) {
    throw new ConversionError('PDF page would exceed 5.08 m (PDF limit). Reduce the output size.', 400)
  }

  const graphics = await resolveGraphics(banner, assets)

  // ---- 1) layers: runs of PDFKit-drawn elements, interleaved with embedded originals
  const layers = [{ type: 'kit', items: [] }] // first kit layer also carries the background
  for (const el of banner.elements) {
    if (el.visible === false || (el.type !== 'graphic' && el.type !== 'text')) continue
    const g = graphics.get(el)
    if (g?.mode === 'original') layers.push({ type: 'original', el, asset: g.asset })
    else {
      if (layers.at(-1).type !== 'kit') layers.push({ type: 'kit', items: [] })
      layers.at(-1).items.push({ el, svg: g?.svg })
    }
  }
  if (opts.cropMarks) layers.push({ type: 'kit', items: [], cropMarks: true })

  // ---- 2) PDFKit: one page per kit layer (same page geometry)
  const kit = new PDFDocument({ size: [pageW, pageH], margin: 0, autoFirstPage: false })
  const chunks = []
  kit.on('data', (c) => chunks.push(c))
  const kitDone = new Promise((resolve) => kit.on('end', resolve))

  const registered = new Set()
  const fontReport = new Map()
  const fontCallback = (family, bold, italic) => {
    const res = resolveFont(family, bold, italic)
    const requested = `${String(family).split(',')[0].replace(/["']/g, '').trim()}${bold ? ' Bold' : ''}${italic ? ' Italic' : ''}`
    if (!res) {
      fontReport.set(requested, { requested, used: 'Helvetica (not embedded!)', embedded: false })
      return bold ? (italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold') : italic ? 'Helvetica-Oblique' : 'Helvetica'
    }
    const key = `F_${res.file}`
    if (!registered.has(key)) {
      kit.registerFont(key, res.file)
      registered.add(key)
    }
    fontReport.set(requested, { requested, used: path.basename(res.file), embedded: true, substituted: !res.exact })
    return key
  }

  const bpx = bleed / s // bleed in banner px
  const view = { x: -bpx, y: -bpx, w: W + 2 * bpx, h: H + 2 * bpx }
  const warnings = []
  let kitPages = 0
  for (const [i, layer] of layers.entries()) {
    if (layer.type !== 'kit') continue
    kit.addPage({ size: [pageW, pageH], margin: 0 })
    layer.kitPage = kitPages++
    if (layer.cropMarks) {
      drawCropMarks(kit, { m, trimW, trimH, bleed })
      continue
    }
    kit.save()
    kit.translate(m - bleed, m - bleed)
    kit.rect(0, 0, trimW + 2 * bleed, trimH + 2 * bleed).clip()
    if (i === 0 && !banner.transparent) {
      kit.rect(0, 0, trimW + 2 * bleed, trimH + 2 * bleed).fill(banner.background || '#ffffff')
    }
    for (const { el, svg } of layer.items) {
      SVGtoPDF(kit, elementSvg(el, banner, view, svg), 0, 0, {
        width: trimW + 2 * bleed,
        height: trimH + 2 * bleed,
        preserveAspectRatio: 'none',
        fontCallback,
        warningCallback: (w) => warnings.push(`${el.name || el.type}: ${w}`),
      })
    }
    kit.restore()
  }
  kit.end()
  await kitDone
  const kitPdf = await LibDocument.load(Buffer.concat(chunks))

  // ---- 3) compose final page with pdf-lib
  const out = await LibDocument.create()
  out.setTitle(banner.name || 'Banner')
  out.setCreator('Adbanner Generator')
  out.setProducer('Adbanner Generator / PDFKit / pdf-lib')
  const page = out.addPage([pageW, pageH])
  page.setTrimBox(m, m, trimW, trimH)
  page.setBleedBox(m - bleed, m - bleed, trimW + 2 * bleed, trimH + 2 * bleed)

  const embeddedKit = await out.embedPages(kitPdf.getPages())
  const originalCache = new Map()
  let originals = 0
  for (const layer of layers) {
    if (layer.type === 'kit') {
      page.drawPage(embeddedKit[layer.kitPage], { x: 0, y: 0, width: pageW, height: pageH })
      continue
    }
    const { el, asset } = layer
    const pageIndex = el.page || 0
    const key = `${el.assetId}#${pageIndex}`
    let emb = originalCache.get(key)
    if (!emb) {
      const pdfBytes = await originalToPdf(asset.buffer, asset.name)
      const src = await LibDocument.load(pdfBytes, { ignoreEncryption: true })
      const srcPage = src.getPage(Math.min(pageIndex, src.getPageCount() - 1))
      const cb = srcPage.getCropBox()
      emb = await out.embedPage(srcPage, { left: cb.x, bottom: cb.y, right: cb.x + cb.width, top: cb.y + cb.height })
      originalCache.set(key, emb)
    }
    originals++
    // banner px (y down) -> PDF pt (y up); rotate clockwise around the element centre
    const w = el.width * s
    const h = el.height * s
    const cx = m + (el.x + el.width / 2) * s
    const cy = pageH - m - (el.y + el.height / 2) * s
    const r = (-(el.rotation || 0) * Math.PI) / 180
    const cos = Math.cos(r)
    const sin = Math.sin(r)
    page.pushOperators(
      pushGraphicsState(),
      rectangle(m - bleed, m - bleed, trimW + 2 * bleed, trimH + 2 * bleed),
      clip(),
      endPath(),
      concatTransformationMatrix(
        cos * w, sin * w, -sin * h, cos * h,
        cx - (cos * w) / 2 + (sin * h) / 2,
        cy - (sin * w) / 2 - (cos * h) / 2,
      ),
    )
    page.drawPage(emb, { x: 0, y: 0, width: 1, height: 1, opacity: el.opacity ?? 1 })
    page.pushOperators(popGraphicsState())
  }

  const buffer = Buffer.from(await out.save())
  return {
    buffer,
    report: {
      trimMm: [+(W * opts.mmPerPx).toFixed(2), +(H * opts.mmPerPx).toFixed(2)],
      bleedMm: opts.bleedMm,
      cropMarks: opts.cropMarks,
      colorMode: opts.colorMode,
      outlineText: opts.outlineText,
      originals,
      fonts: [...fontReport.values()],
      warnings: warnings.slice(0, 10),
    },
  }
}

/** Optional Ghostscript pass: CMYK conversion and/or converting text to outlines. */
async function ghostscriptPass(buffer, { colorMode, outlineText }) {
  const gs = await findGhostscript()
  if (!gs) throw new ConversionError('CMYK / text outlines require Ghostscript (see README).', 501)
  const dir = await mkdtemp(path.join(tmpdir(), 'adgen-pdf-'))
  const input = path.join(dir, 'in.pdf')
  const output = path.join(dir, 'out.pdf')
  try {
    await writeFile(input, buffer)
    const args = ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.6', '-dAutoRotatePages=/None']
    if (colorMode === 'cmyk') args.push('-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK')
    if (outlineText) args.push('-dNoOutputFonts')
    args.push(`-sOutputFile=${output}`, input)
    await run(gs.bin, args, { timeout: 60000 })
    return await readFile(output)
  } catch (err) {
    if (err instanceof ConversionError) throw err
    throw new ConversionError(`Ghostscript post-processing failed: ${err.message.split('\n')[0]}`, 500)
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function bannerToPdf(banner, options, assets) {
  const { buffer, report } = await renderPdf(banner, options, assets)
  if (report.colorMode === 'cmyk' || report.outlineText) {
    return { buffer: await ghostscriptPass(buffer, report), report }
  }
  return { buffer, report }
}
