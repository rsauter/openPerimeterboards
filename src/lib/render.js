// Shared geometry + SVG serialization. The editor (BannerCanvas.vue) and the
// exporter both use these helpers so preview and export stay identical.

const ANCHOR = { left: 'start', center: 'middle', right: 'end' }

export function textAnchor(el) {
  return ANCHOR[el.align] || 'start'
}

/** Absolute baseline y for each line of a text element. */
export function textLines(el) {
  const lines = String(el.text ?? '').split('\n')
  const lh = el.fontSize * (el.lineHeight || 1.2)
  return lines.map((text, i) => ({
    text: text.length ? text : ' ',
    y: el.y + el.fontSize * 0.8 + i * lh,
  }))
}

export function textStyle(el, banner) {
  return {
    fill: el.color || banner.fontColor,
    fontFamily: el.fontFamily || banner.fontFamily,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.italic ? 'italic' : 'normal',
    letterSpacing: el.letterSpacing || 0,
    textDecoration: el.underline ? 'underline' : 'none',
  }
}

/** Rotation pivot: graphics rotate around their centre, text around its anchor point. */
export function rotationTransform(el) {
  if (!el.rotation) return undefined
  if (el.type === 'graphic') {
    return `rotate(${el.rotation} ${el.x + el.width / 2} ${el.y + el.height / 2})`
  }
  return `rotate(${el.rotation} ${el.x} ${el.y})`
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

const uriCache = new Map()
export function svgDataUri(svg) {
  let uri = uriCache.get(svg)
  if (!uri) {
    uri = `data:image/svg+xml;base64,${utf8ToBase64(svg)}`
    uriCache.set(svg, uri)
  }
  return uri
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const attrs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ')

/** SVG markup of a single text element (shared by SVG and PDF export). */
export function textMarkup(el, banner) {
  const st = textStyle(el, banner)
  const tspans = textLines(el)
    .map((l) => `<tspan x="${el.x}" y="${l.y}">${esc(l.text)}</tspan>`)
    .join('')
  return `<text ${attrs({
    fill: st.fill,
    'font-family': st.fontFamily,
    'font-size': st.fontSize,
    'font-weight': st.fontWeight,
    'font-style': el.italic ? 'italic' : undefined,
    'letter-spacing': st.letterSpacing || undefined,
    'text-decoration': el.underline ? 'underline' : undefined,
    'text-anchor': textAnchor(el),
    'xml:space': 'preserve',
    opacity: el.opacity < 1 ? el.opacity : undefined,
    transform: rotationTransform(el),
  })}>${tspans}</text>`
}

/** Serialize the banner into a standalone SVG document string. */
export function buildSvg(banner, resolveHref = (el) => (el.svg ? svgDataUri(el.svg) : null)) {
  const { width, height } = banner
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ]
  if (!banner.transparent) {
    parts.push(`<rect width="${width}" height="${height}" fill="${esc(banner.background)}"/>`)
  }
  for (const el of banner.elements) {
    if (el.visible === false) continue
    const transform = rotationTransform(el)
    const opacity = el.opacity < 1 ? el.opacity : undefined
    if (el.type === 'graphic') {
      const href = resolveHref(el)
      if (!href) continue
      parts.push(
        `<image ${attrs({ x: el.x, y: el.y, width: el.width, height: el.height, preserveAspectRatio: 'none', opacity, transform })} href="${href}" xlink:href="${href}"/>`,
      )
    } else if (el.type === 'text') {
      parts.push(textMarkup(el, banner))
    }
  }
  parts.push('</svg>')
  return parts.join('\n')
}
