import { reactive, ref, computed, watch, toRaw } from 'vue'
import { FONT_FAMILIES } from './presets.js'
import { APP_VERSION } from './version.js'
import { loadAssets, assetIdsOf, migrateInlineSvgs } from './assets.js'
import { saveProject, loadProject, listProjects, newProjectId, collectGarbage } from './projects.js'
import { requestPersistence } from './db.js'
import { renderRaster } from './export.js'

export { APP_VERSION }
const LEGACY_KEY = 'adgen.project.v1' // v0.5/0.6 autosave (localStorage)
const CURRENT_KEY = 'adgen.currentProject'

let idCounter = Date.now()
const uid = (prefix) => `${prefix}_${(idCounter++).toString(36)}`

function defaultBanner() {
  return {
    id: newProjectId(),
    name: 'New banner',
    width: 300,
    height: 250,
    background: '#0f172a',
    transparent: false,
    fontColor: '#ffffff',
    fontFamily: FONT_FAMILIES[1].value,
    print: defaultPrint(),
    elements: [
      makeText({ text: 'Your headline', x: 24, y: 70, fontSize: 30, fontWeight: 700 }),
      makeText({ text: 'Short subline goes here', x: 24, y: 112, fontSize: 16, fontWeight: 400, color: '#cbd5e1' }),
      makeText({ text: 'Learn more ›', x: 24, y: 190, fontSize: 18, fontWeight: 700, color: '#38bdf8' }),
    ],
  }
}

export function defaultPrint() {
  return { mmPerPx: null, bleedMm: 3, cropMarks: true, colorMode: 'rgb', outlineText: false, bothVersions: false }
}

export function makeText(over = {}) {
  return {
    id: uid('txt'),
    type: 'text',
    name: over.text ? String(over.text).split('\n')[0].slice(0, 24) : 'Text',
    text: 'New text',
    x: 20,
    y: 20,
    fontSize: 24,
    fontFamily: null, // null = banner default
    fontWeight: 400,
    italic: false,
    underline: false,
    color: null, // null = banner font colour
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    ...over,
  }
}

export function makeGraphic({ name, assetId, width, height, sourceFormat }, banner) {
  // fit into 60 % of the banner, never upscale beyond natural size by default
  const scale = Math.min(1, (banner.width * 0.6) / width, (banner.height * 0.6) / height)
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  return {
    id: uid('gfx'),
    type: 'graphic',
    name: name || 'Graphic',
    sourceFormat,
    assetId,
    page: 0,
    naturalWidth: width,
    naturalHeight: height,
    x: Math.round((banner.width - w) / 2),
    y: Math.round((banner.height - h) / 2),
    width: w,
    height: h,
    keepRatio: true,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
  }
}

// ------------------------------------------------------------------ state

export const banner = reactive(defaultBanner())
export const selectedId = ref(null)
export const selected = computed(() => banner.elements.find((e) => e.id === selectedId.value) || null)
export const ready = ref(false)
export const saveState = ref('saved') // 'saved' | 'pending' | 'error'
export const missingAssets = ref([])

function normalize(data) {
  const next = { ...defaultBanner(), ...data, print: { ...defaultPrint(), ...(data.print || {}) } }
  if (!data.id) next.id = newProjectId()
  next.elements = (next.elements || []).map((e) => ({ ...e, id: e.id || uid(e.type === 'graphic' ? 'gfx' : 'txt') }))
  return next
}

function setCurrentId(id) {
  try { localStorage.setItem(CURRENT_KEY, id) } catch { /* ignore */ }
}

/** Replace the edited banner (open project, new project). Resets undo history. */
export async function replaceBanner(data) {
  const next = normalize(data)
  missingAssets.value = await loadAssets(assetIdsOf(next))
  history.applying = true
  Object.keys(banner).forEach((k) => delete banner[k])
  Object.assign(banner, next)
  selectedId.value = null
  setCurrentId(banner.id)
  history.stack = [snapshot()]
  history.index = 0
  updateFlags()
  setTimeout(() => (history.applying = false))
  await persistNow()
}

export async function newProject() {
  await replaceBanner(defaultBanner())
}

export async function openStoredProject(id) {
  const data = await loadProject(id)
  if (!data) throw new Error('Project not found')
  await replaceBanner(data)
}

/** Load last project from IndexedDB, migrating the v0.5/0.6 localStorage autosave once. */
export async function initStore() {
  requestPersistence()
  let data = null
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      data = await migrateInlineSvgs(normalize(JSON.parse(legacy)))
      await saveProject(data)
      localStorage.removeItem(LEGACY_KEY)
    }
  } catch (err) {
    console.warn('Legacy autosave migration failed', err)
  }
  if (!data) {
    let id = null
    try { id = localStorage.getItem(CURRENT_KEY) } catch { /* ignore */ }
    data = (id && (await loadProject(id))) || null
    if (!data) {
      const [latest] = await listProjects()
      if (latest) data = await loadProject(latest.id)
    }
  }
  await replaceBanner(data || defaultBanner())
  collectGarbage(assetIdsOf(banner)).catch(() => {})
  ready.value = true
}

// ------------------------------------------------------------------ actions

export function addText() {
  const el = makeText({
    x: Math.round(banner.width * 0.1),
    y: Math.round(banner.height * 0.4),
    fontSize: Math.max(12, Math.round(Math.min(banner.width, banner.height) / 10)),
  })
  banner.elements.push(el)
  selectedId.value = el.id
}

export function addGraphic(result) {
  const el = makeGraphic(result, banner)
  banner.elements.push(el)
  selectedId.value = el.id
  return el
}

export function removeElement(id = selectedId.value) {
  const i = banner.elements.findIndex((e) => e.id === id)
  if (i < 0) return
  banner.elements.splice(i, 1)
  if (selectedId.value === id) selectedId.value = banner.elements[Math.min(i, banner.elements.length - 1)]?.id ?? null
}

export function duplicateElement(id = selectedId.value) {
  const src = banner.elements.find((e) => e.id === id)
  if (!src) return
  const copy = { ...structuredClone(toRaw(src)), id: uid(src.type === 'graphic' ? 'gfx' : 'txt'), x: src.x + 10, y: src.y + 10, name: `${src.name} copy` }
  banner.elements.splice(banner.elements.indexOf(src) + 1, 0, copy)
  selectedId.value = copy.id
}

/** dir: +1 = forward (towards top), -1 = backward, 'front' / 'back' */
export function moveLayer(id, dir) {
  const els = banner.elements
  const i = els.findIndex((e) => e.id === id)
  if (i < 0) return
  const [el] = els.splice(i, 1)
  let j = dir === 'front' ? els.length : dir === 'back' ? 0 : i + dir
  j = Math.max(0, Math.min(els.length, j))
  els.splice(j, 0, el)
}

export function setSize(width, height, mmPerPx) {
  if (mmPerPx) banner.print.mmPerPx = mmPerPx
  banner.width = Math.max(1, Math.min(4000, Math.round(width)))
  banner.height = Math.max(1, Math.min(4000, Math.round(height)))
}

// ------------------------------------------------------------------ undo / redo + autosave

const history = { stack: [], index: -1, applying: false }
export const canUndo = ref(false)
export const canRedo = ref(false)

function snapshot() {
  return JSON.stringify({ banner: toRaw(banner), selectedId: selectedId.value })
}

function updateFlags() {
  canUndo.value = history.index > 0
  canRedo.value = history.index < history.stack.length - 1
}

async function makeThumb() {
  try {
    const scale = Math.min(1, 240 / Math.max(banner.width, banner.height))
    const blob = await renderRaster(banner, { format: 'png', scale })
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

let saveTimer
let lastThumb = 0
async function persistNow() {
  clearTimeout(saveTimer)
  try {
    const thumb = Date.now() - lastThumb > 3000 ? await makeThumb() : undefined
    if (thumb) lastThumb = Date.now()
    await saveProject(banner, thumb)
    saveState.value = 'saved'
  } catch (err) {
    console.error('Autosave failed', err)
    saveState.value = 'error'
  }
}
function schedulePersist() {
  saveState.value = 'pending'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNow, 800)
}

let timer
watch(
  banner,
  () => {
    if (!ready.value) return
    schedulePersist()
    if (history.applying) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      const snap = snapshot()
      if (history.stack[history.index] === snap) return
      history.stack.splice(history.index + 1)
      history.stack.push(snap)
      if (history.stack.length > 100) history.stack.shift()
      history.index = history.stack.length - 1
      updateFlags()
    }, 250)
  },
  { deep: true },
)

function applySnapshot(snap) {
  history.applying = true
  const { banner: b, selectedId: sel } = JSON.parse(snap)
  Object.keys(banner).forEach((k) => delete banner[k])
  Object.assign(banner, b)
  selectedId.value = sel
  setTimeout(() => (history.applying = false))
  updateFlags()
}

export function undo() {
  if (history.index <= 0) return
  history.index--
  applySnapshot(history.stack[history.index])
}

export function redo() {
  if (history.index >= history.stack.length - 1) return
  history.index++
  applySnapshot(history.stack[history.index])
}
