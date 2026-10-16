<script setup>
import { t } from '../i18n/index.js'
import { computed } from 'vue'
import { banner, selected, duplicateElement, removeElement, moveLayer } from '../lib/store.js'
import { FONT_FAMILIES, FONT_WEIGHTS } from '../lib/presets.js'
import ColorField from './ColorField.vue'
import { isMm, lenUnit, fontUnit, unitModel, lenToDisplay, lenFromDisplay } from '../lib/units.js'
import { assetMeta, putAsset, assetFromUpload } from '../lib/assets.js'
import { convertVector } from '../lib/api.js'
import { ref } from 'vue'

const emit = defineEmits(['notify'])
const replaceInput = ref(null)
const replacing = ref(false)

/** Swap the file behind a graphic (e.g. legacy SVG -> original EPS), keep position and width. */
async function replaceFile(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file || !el.value) return
  replacing.value = true
  try {
    const result = await convertVector(file)
    await putAsset(assetFromUpload(result, file))
    const g = el.value
    g.assetId = result.id
    g.sourceFormat = result.sourceFormat
    g.page = 0
    delete g.svg
    const oldRatio = g.height / g.width
    g.naturalWidth = result.width
    g.naturalHeight = result.height
    const newRatio = result.height / result.width
    if (g.keepRatio !== false && Math.abs(newRatio - oldRatio) > 0.01) g.height = Math.round(g.width * newRatio)
    emit('notify', { type: 'success', text: t('props.replaced', { name: file.name }) })
  } catch (err) {
    emit('notify', { type: 'error', text: `${file.name}: ${err.message}` })
  } finally {
    replacing.value = false
  }
}
import NumberField from './NumberField.vue'

const el = selected
const xModel = unitModel(() => el.value, 'x')
const yModel = unitModel(() => el.value, 'y')
const fontModel = unitModel(() => el.value, 'fontSize', 'font')
const spacingModel = unitModel(() => el.value, 'letterSpacing', 'font')

const ratio = computed(() => (el.value?.type === 'graphic' ? el.value.naturalHeight / el.value.naturalWidth : 1))

function setWidth(v) {
  el.value.width = Math.max(0.1, Math.round(v * 100) / 100)
  if (el.value.keepRatio !== false) el.value.height = Math.max(0.1, Math.round(v * ratio.value * 100) / 100)
}
function setHeight(v) {
  el.value.height = Math.max(0.1, Math.round(v * 100) / 100)
  if (el.value.keepRatio !== false) el.value.width = Math.max(0.1, Math.round((v / ratio.value) * 100) / 100)
}
function resetSize() {
  el.value.width = Math.round(el.value.naturalWidth)
  el.value.height = Math.round(el.value.naturalHeight)
}
function fitBanner() {
  const s = Math.min(banner.width / el.value.naturalWidth, banner.height / el.value.naturalHeight)
  el.value.width = Math.round(el.value.naturalWidth * s)
  el.value.height = Math.round(el.value.naturalHeight * s)
  el.value.x = Math.round((banner.width - el.value.width) / 2)
  el.value.y = Math.round((banner.height - el.value.height) / 2)
}
function centerH() {
  if (el.value.type === 'graphic') el.value.x = Math.round((banner.width - el.value.width) / 2)
  else {
    el.value.align = 'center'
    el.value.x = Math.round(banner.width / 2)
  }
}
function centerV() {
  if (el.value.type === 'graphic') el.value.y = Math.round((banner.height - el.value.height) / 2)
  else {
    const lines = el.value.text.split('\n').length
    const h = el.value.fontSize * (1 + (lines - 1) * el.value.lineHeight)
    el.value.y = Math.round((banner.height - h) / 2)
  }
}
</script>

<template>
  <div v-if="el" class="space-y-1">
    <div class="flex items-center justify-between">
      <span class="badge badge-soft badge-primary badge-sm uppercase">{{ el.type === 'text' ? t('props.text') : `${t('props.graphic')} · ${el.sourceFormat || 'svg'}` }}</span>
      <div class="join">
        <button class="btn btn-ghost btn-xs join-item" :title="t('props.duplicate')" @click="duplicateElement()">⧉</button>
        <button class="btn btn-ghost btn-xs join-item" :title="t('props.toFront')" @click="moveLayer(el.id, 'front')">⤒</button>
        <button class="btn btn-ghost btn-xs join-item" :title="t('props.toBack')" @click="moveLayer(el.id, 'back')">⤓</button>
        <button class="btn btn-ghost btn-xs join-item text-error" :title="t('props.delete')" @click="removeElement()">✕</button>
      </div>
    </div>

    <!-- TEXT -->
    <template v-if="el.type === 'text'">
      <fieldset class="fieldset py-1">
        <legend class="fieldset-legend py-1">{{ t('props.text') }}</legend>
        <textarea v-model="el.text" class="textarea textarea-sm h-20 w-full" :placeholder="t('props.textPlaceholder')" />
      </fieldset>

      <div class="grid grid-cols-2 gap-2">
        <fieldset class="fieldset py-1">
          <legend class="fieldset-legend py-1">{{ t('props.fontSize') }}</legend>
          <NumberField v-model="fontModel" label="A" :min="0.5" :max="100000" :step="isMm ? 0.5 : 1" :suffix="fontUnit" />
        </fieldset>
        <fieldset class="fieldset py-1">
          <legend class="fieldset-legend py-1">{{ t('props.weight') }}</legend>
          <select v-model.number="el.fontWeight" class="select select-sm w-full">
            <option v-for="w in FONT_WEIGHTS" :key="w.value" :value="w.value">{{ t(`weight.${w.key}`) }}</option>
          </select>
        </fieldset>
      </div>
      <input v-model.number="el.fontSize" type="range" min="1" :max="Math.max(200, Math.round(banner.height))" class="range range-xs range-primary w-full" />

      <fieldset class="fieldset py-1">
        <legend class="fieldset-legend py-1">{{ t('props.font') }}</legend>
        <select v-model="el.fontFamily" class="select select-sm w-full" :style="{ fontFamily: el.fontFamily || banner.fontFamily }">
          <option :value="null">{{ t('props.bannerDefault') }}</option>
          <option v-for="f in FONT_FAMILIES" :key="f.value" :value="f.value" :style="{ fontFamily: f.value }">{{ f.label }}</option>
        </select>
      </fieldset>

      <div class="flex items-center gap-2">
        <div class="join">
          <button v-for="a in ['left', 'center', 'right']" :key="a" class="btn btn-sm join-item" :class="{ 'btn-active btn-primary': el.align === a }" :title="t(`props.align.${a}`)" @click="el.align = a">
            {{ a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥' }}
          </button>
        </div>
        <div class="join">
          <button class="btn btn-sm join-item italic" :class="{ 'btn-active btn-primary': el.italic }" :title="t('props.italic')" @click="el.italic = !el.italic">I</button>
          <button class="btn btn-sm join-item underline" :class="{ 'btn-active btn-primary': el.underline }" :title="t('props.underline')" @click="el.underline = !el.underline">U</button>
        </div>
      </div>

      <ColorField v-model="el.color" :label="t('props.fontColor')" allow-inherit :inherit-label="t('side.banner')" :inherit-value="banner.fontColor" />

      <div class="grid grid-cols-2 gap-2">
        <fieldset class="fieldset py-1">
          <legend class="fieldset-legend py-1">{{ t('props.lineHeight') }}</legend>
          <NumberField v-model="el.lineHeight" label="↕" :min="0.5" :max="4" :step="0.05" />
        </fieldset>
        <fieldset class="fieldset py-1">
          <legend class="fieldset-legend py-1">{{ t('props.letterSpacing') }}</legend>
          <NumberField v-model="spacingModel" label="↔" :min="-1000" :max="1000" :step="0.5" :suffix="fontUnit" />
        </fieldset>
      </div>
    </template>

    <!-- GRAPHIC -->
    <template v-else>
      <fieldset class="fieldset py-1">
        <legend class="fieldset-legend py-1">{{ t('banner.name') }}</legend>
        <input v-model="el.name" class="input input-sm w-full" />
        <p v-if="assetMeta[el.assetId]" class="label mt-1 whitespace-normal text-xs">
          {{ assetMeta[el.assetId].name }} · {{ (assetMeta[el.assetId].size / 1024).toFixed(0) }} KB
          <template v-if="assetMeta[el.assetId].previewKind === 'png'"> · {{ t('props.pngPreview') }}</template>
        </p>
        <div v-if="assetMeta[el.assetId]?.legacy || el.svg" role="alert" class="alert alert-soft alert-warning mt-1 px-2 py-1 text-xs">
          {{ t('props.legacyWarning') }}
        </div>
        <button class="btn btn-xs mt-1" :class="{ 'btn-warning': assetMeta[el.assetId]?.legacy || el.svg }" :disabled="replacing" @click="replaceInput.click()">
          <span v-if="replacing" class="loading loading-spinner loading-xs" />
          {{ t('props.replaceFile') }}
        </button>
        <input ref="replaceInput" type="file" accept=".svg,.pdf,.ai,.eps" class="hidden" @change="replaceFile" />
      </fieldset>
      <fieldset class="fieldset py-1">
        <legend class="fieldset-legend py-1">{{ t('banner.size') }}</legend>
        <div class="flex items-center gap-1">
          <NumberField :model-value="lenToDisplay(el.width)" label="W" :min="0.1" :step="isMm ? 0.1 : 1" :suffix="lenUnit" @update:model-value="(v) => setWidth(lenFromDisplay(v))" />
          <button class="btn btn-ghost btn-xs px-1" :class="{ 'text-primary': el.keepRatio !== false }" :title="el.keepRatio !== false ? t('props.ratioLocked') : t('props.ratioFree')" @click="el.keepRatio = el.keepRatio === false">
            {{ el.keepRatio !== false ? '🔗' : '⛓︎' }}
          </button>
          <NumberField :model-value="lenToDisplay(el.height)" label="H" :min="0.1" :step="isMm ? 0.1 : 1" :suffix="lenUnit" @update:model-value="(v) => setHeight(lenFromDisplay(v))" />
        </div>
        <div class="mt-1 flex gap-1">
          <button class="btn btn-xs" @click="fitBanner">{{ t('props.fitBanner') }}</button>
          <button class="btn btn-xs" @click="resetSize">{{ t('props.originalSize') }}</button>
        </div>
      </fieldset>
    </template>

    <!-- COMMON -->
    <fieldset class="fieldset py-1">
      <legend class="fieldset-legend py-1">{{ t('props.position') }}</legend>
      <div class="flex items-center gap-1">
        <NumberField v-model="xModel" label="X" :step="isMm ? 0.1 : 1" :suffix="lenUnit" />
        <NumberField v-model="yModel" label="Y" :step="isMm ? 0.1 : 1" :suffix="lenUnit" />
      </div>
      <div class="mt-1 flex gap-1">
        <button class="btn btn-xs" @click="centerH">{{ t('props.centerH') }}</button>
        <button class="btn btn-xs" @click="centerV">{{ t('props.centerV') }}</button>
      </div>
    </fieldset>

    <div class="grid grid-cols-2 gap-2">
      <fieldset class="fieldset py-1">
        <legend class="fieldset-legend py-1">{{ t('props.rotation') }}</legend>
        <NumberField v-model="el.rotation" label="∠" :min="-360" :max="360" suffix="°" />
      </fieldset>
      <fieldset class="fieldset py-1">
        <legend class="fieldset-legend py-1">{{ t('props.opacity') }} {{ Math.round(el.opacity * 100) }}%</legend>
        <input v-model.number="el.opacity" type="range" min="0" max="1" step="0.05" class="range range-xs range-primary mt-2 w-full" />
      </fieldset>
    </div>
  </div>
  <div v-else class="px-2 py-6 text-center text-sm opacity-60">
    {{ t('props.nothingSelected') }}
  </div>
</template>
