// Projects saved in the browser ("recently edited") + .adbanner ZIP files.
import { toRaw } from 'vue'
import { dbGet, dbPut, dbDelete, dbGetAll } from './db.js'
import { getAsset, putAsset, deleteAssets, allAssetIds, assetIdsOf, migrateInlineSvgs } from './assets.js'
import { createZip, readZip, isZip, zipText } from './zip.js'

export const FILE_EXT = '.adbanner'

export function newProjectId() {
  return `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function listProjects() {
  const all = await dbGetAll('projects')
  return all
    .map(({ banner, ...rest }) => ({ ...rest, elementCount: banner?.elements?.length ?? 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveProject(banner, thumb) {
  const plain = JSON.parse(JSON.stringify(toRaw(banner)))
  const prev = await dbGet('projects', plain.id)
  await dbPut('projects', {
    id: plain.id,
    name: plain.name,
    width: plain.width,
    height: plain.height,
    updatedAt: Date.now(),
    createdAt: prev?.createdAt ?? Date.now(),
    thumb: thumb ?? prev?.thumb ?? null,
    banner: plain,
  })
}

export async function loadProject(id) {
  return (await dbGet('projects', id))?.banner ?? null
}

export async function projectExists(id) {
  return Boolean(await dbGet('projects', id))
}

/** Delete assets that no saved project references any more. `keep`: ids in use right now. */
export async function collectGarbage(keep = []) {
  const used = new Set(keep)
  for (const p of await dbGetAll('projects')) assetIdsOf(p.banner).forEach((id) => used.add(id))
  const unused = (await allAssetIds()).filter((id) => !used.has(id))
  if (unused.length) await deleteAssets(unused)
  return unused.length
}

export async function deleteProject(id, keep = []) {
  await dbDelete('projects', id)
  return collectGarbage(keep)
}

// ------------------------------------------------------------------ .adbanner file

const extOf = (name, fallback) => (name?.match(/\.([a-z0-9]+)$/i)?.[1] || fallback).toLowerCase()

/** banner -> Uint8Array (ZIP: project.json + assets/<id>.<ext> + assets/<id>.preview.<svg|png>) */
export async function buildProjectFile(banner, appVersion) {
  const plain = JSON.parse(JSON.stringify(toRaw(banner)))
  const files = []
  const assets = {}
  for (const id of new Set(assetIdsOf(plain))) {
    const rec = await getAsset(id)
    if (!rec) continue
    const ext = extOf(rec.name, rec.sourceFormat || 'bin')
    const original = `assets/${id}.${ext}`
    const preview = `assets/${id}.preview.${rec.preview.kind}`
    files.push({ name: original, data: new Uint8Array(await rec.original.arrayBuffer()) })
    files.push({
      name: preview,
      data: rec.preview.kind === 'svg' ? rec.preview.svg : new Uint8Array(await rec.preview.png.arrayBuffer()),
    })
    assets[id] = {
      name: rec.name, mime: rec.mime, sourceFormat: rec.sourceFormat, size: rec.size,
      width: rec.width, height: rec.height, pageCount: rec.pageCount, legacy: Boolean(rec.legacy),
      original, preview,
    }
  }
  const manifest = { app: 'adbanner-generator', format: 'adbanner', formatVersion: 1, version: appVersion, savedAt: new Date().toISOString(), banner: plain, assets }
  return createZip([{ name: 'project.json', data: JSON.stringify(manifest, null, 2) }, ...files])
}

/** File (.adbanner zip or legacy .json) -> banner (assets imported into IndexedDB) */
export async function readProjectFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isZip(bytes)) {
    // v0.5 / v0.6 JSON project with inline SVGs
    const data = JSON.parse(new TextDecoder().decode(bytes))
    const banner = data.banner ?? data
    if (!banner || !Array.isArray(banner.elements) || !banner.width) throw new Error('Not a valid banner project file')
    return { banner: await migrateInlineSvgs(banner), legacy: true }
  }
  const entries = new Map((await readZip(bytes)).map((f) => [f.name, f.data]))
  const manifestRaw = entries.get('project.json')
  if (!manifestRaw) throw new Error('project.json missing in file')
  const manifest = JSON.parse(zipText(manifestRaw))
  const banner = manifest.banner
  if (!banner || !Array.isArray(banner.elements)) throw new Error('Not a valid banner project file')
  const missing = []
  for (const [id, a] of Object.entries(manifest.assets || {})) {
    const original = entries.get(a.original)
    const preview = entries.get(a.preview)
    if (!original || !preview) { missing.push(a.name || id); continue }
    const kind = a.preview.endsWith('.png') ? 'png' : 'svg'
    await putAsset({
      id, name: a.name, mime: a.mime, sourceFormat: a.sourceFormat, size: a.size,
      width: a.width, height: a.height, pageCount: a.pageCount, legacy: a.legacy,
      original: new Blob([original], { type: a.mime }),
      preview: kind === 'png' ? { kind, png: new Blob([preview], { type: 'image/png' }) } : { kind, svg: zipText(preview) },
    })
  }
  return { banner, missing }
}
