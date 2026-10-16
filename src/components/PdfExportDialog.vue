<script setup>
import { ref, computed } from 'vue'
import { banner } from '../lib/store.js'
import { DPI_PRESETS, BLEED_PRESETS } from '../lib/presets.js'
import { exportPdf } from '../lib/api.js'
import { download } from '../lib/export.js'
import { buildSvg, svgDataUri } from '../lib/render.js'
import { graphicHref, getAsset, assetIdsOf, assetMeta } from '../lib/assets.js'

const props = defineProps({ caps: { type: Object, default: () => ({}) } })
const emit = defineEmits(['notify'])

const dlg = ref(null)
const busy = ref(false)
const p = computed(() => banner.print)
const DEFAULT_MM_PER_PX = 25.4 / 96

const mmPerPx = computed({
  get: () => p.value.mmPerPx || DEFAULT_MM_PER_PX,
  set: (v) => (p.value.mmPerPx = v),
})
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d
const widthMm = computed({
  get: () => round(banner.width * mmPerPx.value),
  set: (v) => v > 0 && (mmPerPx.value = v / banner.width),
})
const heightMm = computed({
  get: () => round(banner.height * mmPerPx.value),
  set: (v) => v > 0 && (mmPerPx.value = v / banner.height),
})
const dpi = computed(() => Math.round(25.4 / mmPerPx.value))
const isPreset = (v) => Math.abs(mmPerPx.value - v) < 1e-6

const canGs = computed(() => Boolean(props.caps?.cmyk))
const originalCount = computed(
  () => new Set(banner.elements.filter((e) => e.type === 'graphic' && e.visible !== false && ['pdf', 'ai', 'eps'].includes(assetMeta[e.assetId]?.sourceFormat) && !assetMeta[e.assetId]?.legacy).map((e) => e.assetId)).size,
)

// ---- preview geometry (in mm)
const preview = computed(() => {
  const w = banner.width * mmPerPx.value
  const h = banner.height * mmPerPx.value
  const b = p.value.bleedMm
  const m = p.value.cropMarks || p.value.bothVersions ? b + 9 : b
  return { w, h, b, m, pw: w + 2 * m, ph: h + 2 * m, src: svgDataUri(buildSvg(banner, graphicHref)) }
})

function open() {
  dlg.value?.showModal()
}
defineExpose({ open })

async function submit() {
  busy.value = true
  try {
    const plain = JSON.parse(JSON.stringify(banner))
    const ids = [...new Set(assetIdsOf({ elements: plain.elements.filter((e) => e.visible !== false) }))]
    const records = (await Promise.all(ids.map((id) => getAsset(id)))).filter(Boolean)
    if (records.length < ids.length) throw new Error('Some graphics are missing in this browser – re-open the project file or upload them again.')
    const { blob, filename, report } = await exportPdf(plain, {
      mmPerPx: mmPerPx.value,
      bleedMm: p.value.bleedMm,
      cropMarks: p.value.cropMarks,
      bothVersions: p.value.bothVersions,
      colorMode: canGs.value ? p.value.colorMode : 'rgb',
      outlineText: canGs.value && p.value.outlineText,
    }, records)
    download(blob, filename)
    dlg.value.close()
    emit('notify', { type: 'success', text: `${filename} (${(blob.size / 1024).toFixed(0)} KB)` })
    const missing = report?.fonts?.filter((f) => !f.embedded) || []
    const subst = report?.fonts?.filter((f) => f.embedded && f.substituted) || []
    if (missing.length) emit('notify', { type: 'error', text: `Fonts not found, not embedded: ${missing.map((f) => f.requested).join(', ')}` })
    if (subst.length) emit('notify', { type: 'warning', text: `Font substituted: ${subst.map((f) => `${f.requested} → ${f.used}`).join(', ')}` })
  } catch (err) {
    emit('notify', { type: 'error', text: err.message })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <dialog ref="dlg" class="modal">
    <div class="modal-box max-w-3xl">
      <h3 class="text-lg font-bold">Print PDF</h3>
      <p class="mb-3 text-sm opacity-70">
        Vector PDF with embedded fonts, trim and bleed box.
        <template v-if="originalCount">Logos ({{ originalCount }}) are embedded from the original file – colours stay exactly as delivered.</template>
      </p>

      <div class="grid gap-6 md:grid-cols-[1fr_15rem]">
        <div class="space-y-3">
          <!-- size -->
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Final size (trim)</legend>
            <div class="flex items-center gap-2">
              <label class="input input-sm w-full">
                <span class="text-xs opacity-60">W</span>
                <input type="number" step="0.1" min="1" :value="widthMm" @change="widthMm = +$event.target.value" />
                <span class="text-xs opacity-50">mm</span>
              </label>
              <span class="opacity-50">×</span>
              <label class="input input-sm w-full">
                <span class="text-xs opacity-60">H</span>
                <input type="number" step="0.1" min="1" :value="heightMm" @change="heightMm = +$event.target.value" />
                <span class="text-xs opacity-50">mm</span>
              </label>
            </div>
            <div class="mt-1 flex flex-wrap gap-1">
              <button
                v-for="d in DPI_PRESETS" :key="d.label"
                class="btn btn-xs" :class="isPreset(d.mmPerPx) ? 'btn-primary' : 'btn-ghost border-base-300'"
                @click="mmPerPx = d.mmPerPx"
              >{{ d.label }}</button>
            </div>
            <p class="label mt-1 text-xs">
              Banner {{ banner.width }}×{{ banner.height }} px · 1 px = {{ round(mmPerPx, 3) }} mm (≈ {{ dpi }} dpi) · aspect ratio is kept
            </p>
          </fieldset>

          <!-- bleed -->
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Bleed (Beschnitt)</legend>
            <div class="flex items-center gap-2">
              <div class="join">
                <button
                  v-for="b in BLEED_PRESETS" :key="b"
                  class="btn btn-sm join-item" :class="{ 'btn-primary': p.bleedMm === b }"
                  @click="p.bleedMm = b"
                >{{ b }} mm</button>
              </div>
              <label class="input input-sm w-28">
                <input v-model.number="p.bleedMm" type="number" min="0" max="20" step="0.5" />
                <span class="text-xs opacity-50">mm</span>
              </label>
            </div>
            <p class="label mt-1 whitespace-normal text-xs">
              The background extends into the bleed automatically. Graphics touching the edge: drag them past the banner edge so they fill the bleed too.
            </p>
          </fieldset>

          <!-- options -->
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Options</legend>
            <label class="label cursor-pointer justify-start gap-2" :class="{ 'opacity-50': p.bothVersions }">
              <input v-model="p.cropMarks" type="checkbox" class="toggle toggle-sm toggle-primary" :disabled="p.bothVersions" />
              Crop marks (Schnittmarken)
            </label>
            <label class="label mt-1 cursor-pointer justify-start gap-2">
              <input v-model="p.bothVersions" type="checkbox" class="toggle toggle-sm toggle-primary" />
              Both versions as ZIP (with + without crop marks)
            </label>
            <div class="mt-1 flex items-center gap-3" :class="{ 'opacity-50': !canGs }">
              <span class="text-sm">Color</span>
              <label class="label cursor-pointer gap-1" title="Text/background RGB, logos keep their original colours"><input v-model="p.colorMode" type="radio" value="rgb" class="radio radio-xs" :disabled="!canGs" /> As designed</label>
              <label class="label cursor-pointer gap-1" title="Everything converted to CMYK by Ghostscript (CMYK logos stay unchanged)"><input v-model="p.colorMode" type="radio" value="cmyk" class="radio radio-xs" :disabled="!canGs" /> Convert all to CMYK</label>
            </div>
            <label class="label mt-1 cursor-pointer justify-start gap-2" :class="{ 'opacity-50': !canGs }">
              <input v-model="p.outlineText" type="checkbox" class="toggle toggle-sm" :disabled="!canGs" />
              Convert text to outlines
            </label>
            <p v-if="!canGs" class="label mt-1 whitespace-normal text-xs text-warning">
              CMYK and text outlines need Ghostscript on the server (see README). Export is RGB with embedded fonts.
            </p>
          </fieldset>
        </div>

        <!-- preview -->
        <div>
          <div class="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">Preview</div>
          <div class="rounded-box bg-base-200 p-3">
            <svg :viewBox="`0 0 ${preview.pw} ${preview.ph}`" class="w-full" style="max-height: 18rem">
              <rect :width="preview.pw" :height="preview.ph" fill="#fff" />
              <rect
                v-if="!banner.transparent"
                :x="preview.m - preview.b" :y="preview.m - preview.b"
                :width="preview.w + 2 * preview.b" :height="preview.h + 2 * preview.b"
                :fill="banner.background"
              />
              <image :href="preview.src" :x="preview.m" :y="preview.m" :width="preview.w" :height="preview.h" preserveAspectRatio="none" />
              <rect
                v-if="preview.b"
                :x="preview.m - preview.b" :y="preview.m - preview.b"
                :width="preview.w + 2 * preview.b" :height="preview.h + 2 * preview.b"
                fill="none" stroke="#ef4444" :stroke-width="preview.pw / 300" :stroke-dasharray="`${preview.pw / 80}`"
              />
              <rect :x="preview.m" :y="preview.m" :width="preview.w" :height="preview.h" fill="none" stroke="#22d3ee" :stroke-width="preview.pw / 300" />
            </svg>
            <div class="mt-2 space-y-0.5 text-xs">
              <div><span class="inline-block h-2 w-3 bg-cyan-400 align-middle" /> Trim {{ round(preview.w) }} × {{ round(preview.h) }} mm</div>
              <div v-if="preview.b"><span class="inline-block h-2 w-3 bg-red-500 align-middle" /> Bleed {{ round(preview.w + 2 * preview.b) }} × {{ round(preview.h + 2 * preview.b) }} mm</div>
              <div class="opacity-60">Page {{ round(preview.pw) }} × {{ round(preview.ph) }} mm</div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <form method="dialog"><button class="btn btn-ghost">Cancel</button></form>
        <button class="btn btn-primary" :disabled="busy" @click="submit">
          <span v-if="busy" class="loading loading-spinner loading-sm" />
          {{ p.bothVersions ? 'Download ZIP' : 'Download PDF' }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>
</template>
