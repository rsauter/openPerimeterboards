<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import {
  banner, selected, selectedId, addText, removeElement, duplicateElement,
  undo, redo, canUndo, canRedo, APP_VERSION, initStore, ready, saveState, missingAssets,
} from './lib/store.js'
import { exportSvg, exportRaster, exportProject } from './lib/export.js'
import ProjectsDialog from './components/ProjectsDialog.vue'
import { fetchHealth } from './lib/api.js'
import BannerCanvas from './components/BannerCanvas.vue'
import BannerSettings from './components/BannerSettings.vue'
import UploadDropzone from './components/UploadDropzone.vue'
import LayersPanel from './components/LayersPanel.vue'
import ElementProperties from './components/ElementProperties.vue'
import PdfExportDialog from './components/PdfExportDialog.vue'

// ------------------------------------------------------------ theme
const theme = ref(localStorageGet('adgen.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
function applyTheme() {
  document.documentElement.dataset.theme = theme.value
  localStorageSet('adgen.theme', theme.value)
}
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme()
}
function localStorageGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

// ------------------------------------------------------------ toasts
const toasts = ref([])
let toastId = 0
function notify({ type = 'info', text }) {
  const id = ++toastId
  toasts.value.push({ id, type, text })
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), type === 'error' ? 7000 : 3500)
}

// ------------------------------------------------------------ server status
const health = ref(null)
const formats = reactive({})
onMounted(async () => {
  applyTheme()
  health.value = await fetchHealth()
  if (health.value) {
    Object.assign(formats, health.value.formats)
    if (health.value.version !== APP_VERSION) {
      notify({ type: 'error', text: `API server is v${health.value.version}, app is v${APP_VERSION} – run "npm install" and restart "npm run dev".` })
    }
  } else notify({ type: 'warning', text: 'API server not reachable – vector upload unavailable. Start it with "npm run dev".' })
})

// ------------------------------------------------------------ zoom
const zoom = ref('fit')
const currentScale = ref(1)

// ------------------------------------------------------------ export
const exporting = ref(false)
const pdfDialog = ref(null)
function openPdf() {
  document.activeElement?.blur()
  pdfDialog.value?.open()
}
const jpegQuality = ref(0.9)
async function doExport(kind, scale = 1) {
  exporting.value = true
  try {
    if (kind === 'svg') {
      exportSvg(banner)
      notify({ type: 'success', text: 'SVG exported' })
    } else {
      const size = await exportRaster(banner, { format: kind, scale, quality: jpegQuality.value })
      notify({ type: 'success', text: `${kind.toUpperCase()} exported (${(size / 1024).toFixed(1)} KB)` })
    }
  } catch (err) {
    notify({ type: 'error', text: `Export failed: ${err.message}` })
  } finally {
    exporting.value = false
    document.activeElement?.blur()
  }
}

// ------------------------------------------------------------ project files
const projectsDialog = ref(null)
const saving = ref(false)
async function saveProjectFile() {
  saving.value = true
  try {
    const size = await exportProject(banner)
    notify({ type: 'success', text: `Project saved (${(size / 1024).toFixed(0)} KB)` })
  } catch (err) {
    notify({ type: 'error', text: `Save failed: ${err.message}` })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await initStore()
    if (missingAssets.value.length) notify({ type: 'error', text: `${missingAssets.value.length} graphic(s) missing in browser storage – re-open the project file.` })
  } catch (err) {
    notify({ type: 'error', text: `Browser storage unavailable: ${err.message}` })
    ready.value = true
  }
})

// ------------------------------------------------------------ keyboard
function isTyping(e) {
  const t = e.target
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}
function onKey(e) {
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z' && !isTyping(e)) {
    e.preventDefault()
    e.shiftKey ? redo() : undo()
    return
  }
  if (mod && e.key.toLowerCase() === 'y' && !isTyping(e)) { e.preventDefault(); redo(); return }
  if (isTyping(e)) return
  const el = selected.value
  if (mod && e.key.toLowerCase() === 'd' && el) { e.preventDefault(); duplicateElement(); return }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProjectFile(); return }
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); projectsDialog.value?.openFile(); return }
  if (!el) return
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeElement(); return }
  if (e.key === 'Escape') { selectedId.value = null; return }
  const step = e.shiftKey ? 10 : 1
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
  if (moves[e.key] && !el.locked) {
    e.preventDefault()
    el.x += moves[e.key][0]
    el.y += moves[e.key][1]
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const tab = ref('properties')
</script>

<template>
  <div class="flex h-screen flex-col bg-base-200 text-base-content">
    <!-- ============ NAVBAR ============ -->
    <header class="navbar min-h-12 gap-2 border-b border-base-300 bg-base-100 px-3 py-1">
      <div class="flex flex-1 items-center gap-2">
        <img src="/favicon.svg" class="h-6 w-6" alt="" />
        <span class="font-semibold">Adbanner Generator</span>
        <span class="badge badge-soft badge-primary badge-sm">v{{ APP_VERSION }}</span>
        <div class="divider divider-horizontal mx-1" />
        <div class="join">
          <button class="btn btn-ghost btn-sm join-item" title="Projects in this browser, new banner" @click="projectsDialog.open()">Projects</button>
          <button class="btn btn-ghost btn-sm join-item" title="Open .adbanner file (Ctrl+O)" @click="projectsDialog.openFile()">Open</button>
          <button class="btn btn-ghost btn-sm join-item" title="Download project as .adbanner file incl. original logos (Ctrl+S)" :disabled="saving" @click="saveProjectFile">
            <span v-if="saving" class="loading loading-spinner loading-xs" />Save
          </button>
        </div>
        <span class="hidden text-xs opacity-60 lg:inline" :title="'Autosave in this browser'">
          {{ saveState === 'pending' ? 'saving…' : saveState === 'error' ? '⚠ autosave failed' : '✓ saved in browser' }}
        </span>
        <div class="join">
          <button class="btn btn-ghost btn-sm join-item" :disabled="!canUndo" title="Undo (Ctrl+Z)" @click="undo">↶</button>
          <button class="btn btn-ghost btn-sm join-item" :disabled="!canRedo" title="Redo (Ctrl+Y)" @click="redo">↷</button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <select v-model="zoom" class="select select-sm w-28" title="Zoom">
          <option value="fit">Fit ({{ Math.round(currentScale * 100) }}%)</option>
          <option v-for="z in [0.25, 0.5, 1, 1.5, 2, 3]" :key="z" :value="z">{{ z * 100 }}%</option>
        </select>

        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-primary btn-sm">
            <span v-if="exporting" class="loading loading-spinner loading-xs" />
            Export
          </div>
          <ul tabindex="0" class="dropdown-content menu z-50 mt-2 w-64 rounded-box bg-base-100 p-2 shadow-lg">
            <li class="menu-title">Raster</li>
            <li><a @click="doExport('png', 1)">PNG <span class="badge badge-ghost badge-sm">{{ banner.width }}×{{ banner.height }}</span></a></li>
            <li><a @click="doExport('png', 2)">PNG @2x <span class="badge badge-ghost badge-sm">{{ banner.width * 2 }}×{{ banner.height * 2 }}</span></a></li>
            <li><a @click="doExport('jpeg', 1)">JPG <span class="badge badge-ghost badge-sm">{{ Math.round(jpegQuality * 100) }}%</span></a></li>
            <li class="px-3 py-1">
              <input v-model.number="jpegQuality" type="range" min="0.4" max="1" step="0.05" class="range range-xs" title="JPG quality" @click.stop />
            </li>
            <li class="menu-title">Vector</li>
            <li><a @click="doExport('svg')">SVG</a></li>
            <li class="menu-title">Print</li>
            <li><a :class="{ 'menu-disabled': !health }" @click="health && openPdf()">PDF for print… <span class="badge badge-ghost badge-sm">mm · bleed</span></a></li>
          </ul>
        </div>

        <button class="btn btn-ghost btn-sm btn-square" :title="theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="toggleTheme">
          {{ theme === 'dark' ? '☀' : '☾' }}
        </button>
      </div>
    </header>

    <!-- ============ MAIN ============ -->
    <div class="flex min-h-0 flex-1">
      <!-- left: banner + add -->
      <aside class="w-72 shrink-0 space-y-4 overflow-y-auto border-r border-base-300 bg-base-100 p-3">
        <section>
          <h2 class="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">Banner</h2>
          <BannerSettings />
        </section>
        <section class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide opacity-60">Add elements</h2>
          <button class="btn btn-outline btn-sm w-full" @click="addText">
            <span class="font-serif font-bold">T</span> Add text
          </button>
          <UploadDropzone :formats="formats" @notify="notify" />
        </section>
      </aside>

      <!-- center: canvas -->
      <main class="flex min-w-0 flex-1 flex-col">
        <BannerCanvas :zoom="zoom" @scale="currentScale = $event" />
        <footer class="flex items-center justify-between border-t border-base-300 bg-base-100 px-3 py-1 text-xs opacity-70">
          <span>{{ banner.width }} × {{ banner.height }} px · {{ banner.elements.length }} element(s)</span>
          <span class="hidden md:inline">Drag to move · corner handle to resize · arrows nudge (Shift ×10) · Alt disables snapping</span>
          <span :class="health ? 'text-success' : 'text-error'">● API {{ health ? 'online' : 'offline' }}</span>
        </footer>
      </main>

      <!-- right: properties + layers -->
      <aside class="flex w-80 shrink-0 flex-col border-l border-base-300 bg-base-100">
        <div role="tablist" class="tabs tabs-border px-2 pt-1">
          <a role="tab" class="tab" :class="{ 'tab-active': tab === 'properties' }" @click="tab = 'properties'">Properties</a>
          <a role="tab" class="tab" :class="{ 'tab-active': tab === 'layers' }" @click="tab = 'layers'">
            Layers <span class="badge badge-ghost badge-xs ml-1">{{ banner.elements.length }}</span>
          </a>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <ElementProperties v-if="tab === 'properties'" @notify="notify" />
          <LayersPanel v-else />
        </div>
        <div v-if="tab === 'properties'" class="max-h-[40%] overflow-y-auto border-t border-base-300 p-3">
          <h2 class="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">Layers</h2>
          <LayersPanel />
        </div>
      </aside>
    </div>

    <ProjectsDialog ref="projectsDialog" @notify="notify" />
    <PdfExportDialog ref="pdfDialog" :caps="health?.pdfExport || {}" @notify="notify" />

    <div v-if="!ready" class="fixed inset-0 z-40 flex items-center justify-center bg-base-200/80">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- ============ TOASTS ============ -->
    <div class="toast toast-end toast-bottom z-50">
      <div
        v-for="t in toasts" :key="t.id"
        class="alert alert-soft max-w-sm py-2 text-sm"
        :class="{ 'alert-success': t.type === 'success', 'alert-error': t.type === 'error', 'alert-warning': t.type === 'warning', 'alert-info': t.type === 'info' }"
      >
        <span>{{ t.text }}</span>
      </div>
    </div>
  </div>
</template>
