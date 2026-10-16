<script setup>
import { ref } from 'vue'
import { banner, openStoredProject, newProject, replaceBanner } from '../lib/store.js'
import { listProjects, deleteProject, readProjectFile, projectExists, newProjectId, FILE_EXT } from '../lib/projects.js'
import { assetIdsOf } from '../lib/assets.js'
import { storageEstimate } from '../lib/db.js'

const emit = defineEmits(['notify'])
const dlg = ref(null)
const fileInput = ref(null)
const projects = ref([])
const storage = ref(null)
const busy = ref(false)

async function refresh() {
  projects.value = await listProjects()
  storage.value = await storageEstimate()
}

async function open() {
  await refresh()
  dlg.value?.showModal()
}
defineExpose({ open, openFile: () => fileInput.value.click() })

async function openProject(id) {
  await openStoredProject(id)
  dlg.value.close()
}

async function create() {
  await newProject()
  dlg.value?.close()
  emit('notify', { type: 'info', text: 'New banner created – the previous one stays in "Projects".' })
}

async function remove(p) {
  if (!confirm(`Delete "${p.name}" from this browser? Download it first if you still need it.`)) return
  const freed = await deleteProject(p.id, assetIdsOf(banner))
  if (p.id === banner.id) await newProject()
  await refresh()
  emit('notify', { type: 'info', text: `"${p.name}" deleted${freed ? `, ${freed} unused graphic(s) removed` : ''}` })
}

async function onFile(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  busy.value = true
  try {
    const { banner: data, missing, legacy } = await readProjectFile(file)
    if (data.id && (await projectExists(data.id))) {
      const replace = confirm(`"${data.name}" already exists in this browser.\n\nOK = replace the local version with the file\nCancel = open the file as a copy`)
      if (!replace) {
        data.id = newProjectId()
        data.name = `${data.name} (copy)`
      }
    }
    await replaceBanner(data)
    dlg.value?.close()
    emit('notify', { type: 'success', text: `"${banner.name}" opened` })
    if (legacy) emit('notify', { type: 'warning', text: 'Old project format: logos were stored as SVG only, originals are not available.' })
    if (missing?.length) emit('notify', { type: 'error', text: `Missing in file: ${missing.join(', ')}` })
  } catch (err) {
    emit('notify', { type: 'error', text: `Could not open file: ${err.message}` })
  } finally {
    busy.value = false
  }
}

const fmtDate = (t) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const fmtMb = (b) => (b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1)
</script>

<template>
  <dialog ref="dlg" class="modal">
    <div class="modal-box max-w-4xl">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-lg font-bold">Projects</h3>
        <div class="flex gap-2">
          <button class="btn btn-sm" :disabled="busy" @click="fileInput.click()">
            <span v-if="busy" class="loading loading-spinner loading-xs" />
            Open file…
          </button>
          <button class="btn btn-primary btn-sm" @click="create">New banner</button>
        </div>
      </div>

      <div role="alert" class="alert alert-soft alert-info mt-3 py-2 text-sm">
        <span>
          Projects are kept in <b>this browser</b> only (incl. original logos). Use <b>Save</b> to download a
          <code>{{ FILE_EXT }}</code> file as backup or to share it – clearing browser data deletes the list below.
        </span>
      </div>

      <p v-if="!projects.length" class="py-10 text-center opacity-60">No projects yet.</p>
      <div class="mt-4 grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
        <div
          v-for="p in projects" :key="p.id"
          class="card card-sm cursor-pointer border bg-base-100 transition hover:border-primary"
          :class="p.id === banner.id ? 'border-primary' : 'border-base-300'"
          @click="openProject(p.id)"
        >
          <figure class="checkerboard flex h-28 items-center justify-center">
            <img v-if="p.thumb" :src="p.thumb" class="max-h-24 max-w-[90%] shadow" alt="" />
            <span v-else class="text-xs opacity-50">no preview</span>
          </figure>
          <div class="card-body gap-0.5 p-2">
            <div class="flex items-start justify-between gap-1">
              <span class="truncate text-sm font-semibold" :title="p.name">{{ p.name }}</span>
              <button class="btn btn-ghost btn-xs px-1 text-error" title="Delete from browser" @click.stop="remove(p)">✕</button>
            </div>
            <span class="text-xs opacity-60">{{ p.width }}×{{ p.height }} · {{ p.elementCount }} el.</span>
            <span class="text-xs opacity-60">{{ fmtDate(p.updatedAt) }}</span>
            <span v-if="p.id === banner.id" class="badge badge-primary badge-xs mt-1">open</span>
          </div>
        </div>
      </div>

      <p v-if="storage" class="mt-3 text-xs opacity-60">
        Browser storage used: {{ fmtMb(storage.usage) }} MB of ~{{ fmtMb(storage.quota) }} MB
        · {{ storage.persisted ? 'protected from automatic cleanup' : 'may be cleaned up by the browser when disk space is low' }}
      </p>

      <div class="modal-action mt-3">
        <form method="dialog"><button class="btn btn-ghost">Close</button></form>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
    <input ref="fileInput" type="file" :accept="`${FILE_EXT},.zip,.json,application/zip,application/json`" class="hidden" @change="onFile" />
  </dialog>
</template>
