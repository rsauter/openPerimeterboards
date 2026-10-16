import { buildSvg } from './render.js'
import { APP_VERSION } from './version.js'
import { graphicHref } from './assets.js'
import { buildProjectFile, FILE_EXT } from './projects.js'

export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function baseName(banner) {
  const slug = (banner.name || 'banner').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'banner'
  return `${slug}_${banner.width}x${banner.height}`
}

export function exportSvg(banner) {
  download(new Blob([buildSvg(banner, graphicHref)], { type: 'image/svg+xml' }), `${baseName(banner)}.svg`)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Rendering failed'))
    img.src = src
  })
}

/** Render to a canvas blob. format: 'png' | 'jpeg' */
export async function renderRaster(banner, { format = 'png', scale = 1, quality = 0.92 } = {}) {
  const svg = buildSvg(banner, graphicHref)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(banner.width * scale)
    canvas.height = Math.round(banner.height * scale)
    const ctx = canvas.getContext('2d')
    if (format === 'jpeg') {
      // JPEG has no alpha: flatten onto background (or white when transparent)
      ctx.fillStyle = banner.transparent ? '#ffffff' : banner.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), `image/${format}`, quality),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportRaster(banner, opts) {
  const blob = await renderRaster(banner, opts)
  const ext = opts.format === 'jpeg' ? 'jpg' : 'png'
  const suffix = opts.scale && opts.scale !== 1 ? `@${opts.scale}x` : ''
  download(blob, `${baseName(banner)}${suffix}.${ext}`)
  return blob.size
}

export async function exportProject(banner) {
  const bytes = await buildProjectFile(banner, APP_VERSION)
  download(new Blob([bytes], { type: 'application/zip' }), `${baseName(banner)}${FILE_EXT}`)
  return bytes.length
}
