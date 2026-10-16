// Graphic assets: original upload (PDF/AI/EPS/SVG) + editor preview (SVG or PNG).
// Stored in IndexedDB; banner elements only reference them by `assetId`.
import { shallowReactive } from 'vue'
import { dbGet, dbPut, dbDelete, dbKeys } from './db.js'
import { svgDataUri } from './render.js'

/** id -> data URI of the preview (sync access for rendering / export) */
export const assetUrls = shallowReactive({})
/** id -> metadata without binary data */
export const assetMeta = shallowReactive({})

const metaOf = (rec) => ({
  id: rec.id,
  name: rec.name,
  mime: rec.mime,
  sourceFormat: rec.sourceFormat,
  size: rec.size,
  width: rec.width,
  height: rec.height,
  pageCount: rec.pageCount,
  previewKind: rec.preview.kind,
  legacy: Boolean(rec.legacy),
})

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function cache(rec) {
  assetMeta[rec.id] = metaOf(rec)
  assetUrls[rec.id] = rec.preview.kind === 'svg' ? svgDataUri(rec.preview.svg) : await blobToDataUrl(rec.preview.png)
}

export function base64ToBlob(b64, type) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

/**
 * rec: { id, name, mime, sourceFormat, size, width, height, pageCount,
 *        original: Blob, preview: { kind: 'svg', svg } | { kind: 'png', png: Blob }, legacy? }
 */
export async function putAsset(rec) {
  await dbPut('assets', { ...rec, createdAt: Date.now() })
  await cache(rec)
  return rec.id
}

/** Build an asset record from an /api/convert response + the uploaded File. */
export function assetFromUpload(result, file) {
  return {
    id: result.id,
    name: file.name,
    mime: file.type || result.mime || 'application/octet-stream',
    sourceFormat: result.sourceFormat,
    size: file.size,
    width: result.width,
    height: result.height,
    pageCount: result.pageCount,
    original: file,
    preview:
      result.preview.kind === 'png'
        ? { kind: 'png', png: base64ToBlob(result.preview.data, 'image/png') }
        : { kind: 'svg', svg: result.preview.svg },
  }
}

export async function getAsset(id) {
  return dbGet('assets', id)
}

/** Load previews of the given asset ids into the in-memory cache. Returns missing ids. */
export async function loadAssets(ids) {
  const missing = []
  await Promise.all(
    [...new Set(ids)].filter((id) => id && !assetUrls[id]).map(async (id) => {
      const rec = await dbGet('assets', id)
      if (rec) await cache(rec)
      else missing.push(id)
    }),
  )
  return missing
}

export async function deleteAssets(ids) {
  for (const id of ids) {
    await dbDelete('assets', id)
    delete assetUrls[id]
    delete assetMeta[id]
  }
}

export async function allAssetIds() {
  return dbKeys('assets')
}

export function assetIdsOf(banner) {
  return (banner?.elements || []).filter((e) => e.type === 'graphic' && e.assetId).map((e) => e.assetId)
}

// small, fast string hash for legacy inline SVGs (crypto.subtle needs a secure context)
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

/** v0.5/0.6 projects kept the SVG inline in the element — move it into the asset store. */
export async function migrateInlineSvgs(banner) {
  for (const el of banner.elements || []) {
    if (el.type !== 'graphic' || el.assetId || !el.svg) continue
    const id = `svg-${cyrb53(el.svg)}`
    if (!(await dbGet('assets', id))) {
      await putAsset({
        id,
        name: `${el.name || 'graphic'}.svg`,
        mime: 'image/svg+xml',
        sourceFormat: el.sourceFormat || 'svg',
        size: el.svg.length,
        width: el.naturalWidth,
        height: el.naturalHeight,
        pageCount: 1,
        original: new Blob([el.svg], { type: 'image/svg+xml' }),
        preview: { kind: 'svg', svg: el.svg },
        legacy: true, // original file was not kept by older versions
      })
    }
    el.assetId = id
    delete el.svg
  }
  return banner
}

/** href for an element: cached preview, legacy inline SVG, or null (missing). */
export function graphicHref(el) {
  return assetUrls[el.assetId] || (el.svg ? svgDataUri(el.svg) : null)
}
