<script setup>
import { ref } from 'vue'
import { convertVector } from '../lib/api.js'
import { addGraphic } from '../lib/store.js'
import { putAsset, assetFromUpload } from '../lib/assets.js'

const props = defineProps({ formats: { type: Object, default: () => ({}) } })
const emit = defineEmits(['notify'])

const ACCEPT = '.svg,.pdf,.ai,.eps,image/svg+xml,application/pdf,application/postscript,application/illustrator'
const input = ref(null)
const over = ref(false)
const busy = ref(0)

async function handleFiles(files) {
  for (const file of files) {
    busy.value++
    try {
      const result = await convertVector(file)
      await putAsset(assetFromUpload(result, file))
      addGraphic({
        assetId: result.id,
        name: file.name.replace(/\.[^.]+$/, ''),
        width: result.width,
        height: result.height,
        sourceFormat: result.sourceFormat,
      })
      const notes = []
      if (result.pageCount > 1) notes.push(`page 1 of ${result.pageCount}`)
      if (result.preview.kind === 'png') notes.push('complex graphic: image preview, print uses original')
      emit('notify', { type: 'success', text: `${file.name} added${notes.length ? ` (${notes.join(', ')})` : ''}` })
    } catch (err) {
      const msg = err.name === 'QuotaExceededError' ? 'browser storage full – delete old projects' : err.message
      emit('notify', { type: 'error', text: `${file.name}: ${msg}` })
    } finally {
      busy.value--
    }
  }
}

function onDrop(e) {
  over.value = false
  handleFiles([...e.dataTransfer.files])
}
function onPick(e) {
  handleFiles([...e.target.files])
  e.target.value = ''
}
</script>

<template>
  <div
    class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-box border-2 border-dashed p-4 text-center transition"
    :class="over ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/60'"
    @click="input.click()"
    @dragover.prevent="over = true"
    @dragleave.prevent="over = false"
    @drop.prevent="onDrop"
  >
    <span v-if="busy" class="loading loading-spinner loading-md text-primary" />
    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
    <span class="text-sm font-medium">{{ busy ? 'Converting…' : 'Drop vector graphic or click' }}</span>
    <span class="flex flex-wrap justify-center gap-1">
      <span
        v-for="f in ['svg', 'pdf', 'ai', 'eps']" :key="f"
        class="badge badge-xs uppercase"
        :class="formats[f] === false ? 'badge-ghost line-through' : 'badge-outline'"
        :title="formats[f] === false ? 'Not available on server (Ghostscript missing)' : ''"
      >{{ f }}</span>
    </span>
    <input ref="input" type="file" :accept="ACCEPT" multiple class="hidden" @change="onPick" />
  </div>
</template>
