<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import {
  banner, selected, selectedId, addText, removeElement, duplicateElement,
  undo, redo, canUndo, canRedo, APP_VERSION, initStore, ready, saveState, missingAssets,
} from './lib/store.js'
import { exportSvg, exportRaster, exportProject } from './lib/export.js'
import ProjectsDialog from './components/ProjectsDialog.vue'
import { SOURCE_URL } from './lib/version.js'
import { lenToDisplay, lenUnit } from './lib/units.js'
import { t, locale, setLocale, LOCALES } from './i18n/index.js'
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
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== id)), type === 'error' ? 7000 : 3500)
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
      notify({ type: 'error', text: t('toast.versionMismatch', { api: health.value.version, app: APP_VERSION }) })
    }
  } else notify({ type: 'warning', text: t('toast.apiOffline') })
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
      notify({ type: 'success', text: t('toast.exportedSvg') })
    } else {
      const size = await exportRaster(banner, { format: kind, scale, quality: jpegQuality.value })
      notify({ type: 'success', text: t('toast.exported', { kind: kind === 'jpeg' ? 'JPG' : kind.toUpperCase(), size: `${(size / 1024).toFixed(1)} KB` }) })
    }
  } catch (err) {
    notify({ type: 'error', text: t('toast.exportFailed', { msg: err.message }) })
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
    notify({ type: 'success', text: t('toast.projectSaved', { size: (size / 1024).toFixed(0) }) })
  } catch (err) {
    notify({ type: 'error', text: t('toast.saveFailed', { msg: err.message }) })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await initStore()
    if (missingAssets.value.length) notify({ type: 'error', text: t('toast.missingAssets', { n: missingAssets.value.length }) })
  } catch (err) {
    notify({ type: 'error', text: t('toast.storageUnavailable', { msg: err.message }) })
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
          <button class="btn btn-ghost btn-sm join-item" :title="t('nav.projectsHint')" @click="projectsDialog.open()">{{ t('nav.projects') }}</button>
          <button class="btn btn-ghost btn-sm join-item" :title="t('nav.openHint')" @click="projectsDialog.openFile()">{{ t('nav.open') }}</button>
          <button class="btn btn-ghost btn-sm join-item" :title="t('nav.saveHint')" :disabled="saving" @click="saveProjectFile">
            <span v-if="saving" class="loading loading-spinner loading-xs" />{{ t('nav.save') }}
          </button>
        </div>
        <span class="hidden text-xs opacity-60 lg:inline" :title="t('nav.autosaveHint')">
          {{ saveState === 'pending' ? t('nav.saving') : saveState === 'error' ? t('nav.autosaveFailed') : t('nav.saved') }}
        </span>
        <div class="join">
          <button class="btn btn-ghost btn-sm join-item" :disabled="!canUndo" :title="t('nav.undo')" @click="undo">↶</button>
          <button class="btn btn-ghost btn-sm join-item" :disabled="!canRedo" :title="t('nav.redo')" @click="redo">↷</button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <select v-model="zoom" class="select select-sm w-36" :title="t('nav.zoom')">
          <option value="fit">{{ t('nav.fit') }} ({{ Math.round(currentScale * 100) }}%)</option>
          <option v-for="z in [0.25, 0.5, 1, 1.5, 2, 3]" :key="z" :value="z">{{ z * 100 }}%</option>
        </select>

        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-primary btn-sm">
            <span v-if="exporting" class="loading loading-spinner loading-xs" />
            {{ t('export.button') }}
          </div>
          <ul tabindex="0" class="dropdown-content menu z-50 mt-2 w-64 rounded-box bg-base-100 p-2 shadow-lg">
            <li class="menu-title">{{ t('export.raster') }}</li>
            <li><a @click="doExport('png', 1)">PNG <span class="badge badge-ghost badge-sm">{{ banner.width }}×{{ banner.height }}</span></a></li>
            <li><a @click="doExport('png', 2)">PNG @2x <span class="badge badge-ghost badge-sm">{{ banner.width * 2 }}×{{ banner.height * 2 }}</span></a></li>
            <li><a @click="doExport('jpeg', 1)">JPG <span class="badge badge-ghost badge-sm">{{ Math.round(jpegQuality * 100) }}%</span></a></li>
            <li class="px-3 py-1">
              <input v-model.number="jpegQuality" type="range" min="0.4" max="1" step="0.05" class="range range-xs" :title="t('export.jpgQuality')" @click.stop />
            </li>
            <li class="menu-title">{{ t('export.vector') }}</li>
            <li><a @click="doExport('svg')">SVG</a></li>
            <li class="menu-title">{{ t('export.print') }}</li>
            <li><a :class="{ 'menu-disabled': !health }" @click="health && openPdf()">{{ t('export.pdfPrint') }} <span class="badge badge-ghost badge-sm">{{ t('export.pdfBadge') }}</span></a></li>
          </ul>
        </div>

        <select :value="locale" class="select select-sm w-20" :title="t('nav.language')" @change="setLocale($event.target.value)">
          <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.short }}</option>
        </select>

        <button class="btn btn-ghost btn-sm btn-square" :title="theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')" @click="toggleTheme">
          {{ theme === 'dark' ? '☀' : '☾' }}
        </button>
      </div>
    </header>

    <!-- ============ MAIN ============ -->
    <div class="flex min-h-0 flex-1">
      <!-- left: banner + add -->
      <aside class="w-72 shrink-0 space-y-4 overflow-y-auto border-r border-base-300 bg-base-100 p-3">
        <section>
          <h2 class="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">{{ t('side.banner') }}</h2>
          <BannerSettings />
        </section>
        <section class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide opacity-60">{{ t('side.addElements') }}</h2>
          <button class="btn btn-outline btn-sm w-full" @click="addText">
            <span class="font-serif font-bold">T</span> {{ t('side.addText') }}
          </button>
          <UploadDropzone :formats="formats" @notify="notify" />
        </section>
      </aside>

      <!-- center: canvas -->
      <main class="flex min-w-0 flex-1 flex-col">
        <BannerCanvas :zoom="zoom" @scale="currentScale = $event" />
        <footer class="flex items-center justify-between border-t border-base-300 bg-base-100 px-3 py-1 text-xs opacity-70">
          <span>{{ lenToDisplay(banner.width) }} × {{ lenToDisplay(banner.height) }} {{ lenUnit }} · {{ t('footer.elements', { n: banner.elements.length }) }}</span>
          <span class="hidden 2xl:inline">{{ t('footer.hint') }}</span>
          <span class="flex items-center gap-3">
            <a :href="SOURCE_URL" target="_blank" rel="noopener" class="link link-hover" :title="t('footer.sourceHint')">{{ t('footer.source') }} · AGPL-3.0</a>
            <span :class="health ? 'text-success' : 'text-error'">● API {{ health ? t('footer.online') : t('footer.offline') }}</span>
          </span>
        </footer>
      </main>

      <!-- right: properties + layers -->
      <aside class="flex w-80 shrink-0 flex-col border-l border-base-300 bg-base-100">
        <div role="tablist" class="tabs tabs-border px-2 pt-1">
          <a role="tab" class="tab" :class="{ 'tab-active': tab === 'properties' }" @click="tab = 'properties'">{{ t('side.properties') }}</a>
          <a role="tab" class="tab" :class="{ 'tab-active': tab === 'layers' }" @click="tab = 'layers'">
            {{ t('side.layers') }} <span class="badge badge-ghost badge-xs ml-1">{{ banner.elements.length }}</span>
          </a>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <ElementProperties v-if="tab === 'properties'" @notify="notify" />
          <LayersPanel v-else />
        </div>
        <div v-if="tab === 'properties'" class="max-h-[40%] overflow-y-auto border-t border-base-300 p-3">
          <h2 class="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">{{ t('side.layers') }}</h2>
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
        v-for="toast in toasts" :key="toast.id"
        class="alert alert-soft max-w-sm py-2 text-sm"
        :class="{ 'alert-success': toast.type === 'success', 'alert-error': toast.type === 'error', 'alert-warning': toast.type === 'warning', 'alert-info': toast.type === 'info' }"
      >
        <span>{{ toast.text }}</span>
      </div>
    </div>
  </div>
</template>
