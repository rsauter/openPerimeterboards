<script setup>
import { computed } from 'vue'
import { banner, setSize, setUnit, MAX_SIZE_PX } from '../lib/store.js'
import { isMm, lenUnit, lenToDisplay, lenFromDisplay, mmPerPx, round } from '../lib/units.js'
import { SIZE_PRESETS, FONT_FAMILIES } from '../lib/presets.js'
import ColorField from './ColorField.vue'
import NumberField from './NumberField.vue'

const groups = computed(() => {
  const g = {}
  for (const p of SIZE_PRESETS) (g[p.group] ||= []).push(p)
  return g
})

const presetKey = computed({
  get: () => {
    const p = SIZE_PRESETS.find((p) => p.width === banner.width && p.height === banner.height)
    return p ? `${p.width}x${p.height}` : 'custom'
  },
  set: (v) => {
    if (v === 'custom') return
    const [w, h] = v.split('x').map(Number)
    const p = SIZE_PRESETS.find((p) => p.width === w && p.height === h)
    setSize(w, h, p?.mmPerPx)
    setUnit(p?.mmPerPx ? 'mm' : 'px')
  },
})

const maxDisplay = computed(() => Math.floor(lenToDisplay(MAX_SIZE_PX)))
const setW = (v) => setSize(lenFromDisplay(v), banner.height)
const setH = (v) => setSize(banner.width, lenFromDisplay(v))

function swap() {
  setSize(banner.height, banner.width)
}
</script>

<template>
  <div class="space-y-1">
    <fieldset class="fieldset py-1">
      <legend class="fieldset-legend py-1">Name</legend>
      <input v-model="banner.name" class="input input-sm w-full" placeholder="Banner name" />
    </fieldset>

    <fieldset class="fieldset py-1">
      <legend class="fieldset-legend flex w-full items-center justify-between py-1">
        <span>Size</span>
        <span class="join">
          <button class="btn btn-xs join-item" :class="{ 'btn-primary': !isMm }" @click="setUnit('px')">px</button>
          <button class="btn btn-xs join-item" :class="{ 'btn-primary': isMm }" @click="setUnit('mm')">mm</button>
        </span>
      </legend>
      <select v-model="presetKey" class="select select-sm w-full">
        <option value="custom">Custom size</option>
        <optgroup v-for="(items, name) in groups" :key="name" :label="name">
          <option v-for="p in items" :key="p.label" :value="`${p.width}x${p.height}`">
            {{ p.label }} — {{ p.width }}×{{ p.height }}
          </option>
        </optgroup>
      </select>
      <div class="mt-1 flex items-center gap-1">
        <NumberField :model-value="lenToDisplay(banner.width)" label="W" :min="0.1" :max="maxDisplay" :step="isMm ? 0.1 : 1" :suffix="lenUnit" @update:model-value="setW" />
        <button class="btn btn-ghost btn-xs px-1" title="Swap width / height" @click="swap">⇄</button>
        <NumberField :model-value="lenToDisplay(banner.height)" label="H" :min="0.1" :max="maxDisplay" :step="isMm ? 0.1 : 1" :suffix="lenUnit" @update:model-value="setH" />
      </div>
      <p v-if="isMm" class="label mt-1 whitespace-normal text-xs">
        Scale 1 px = {{ round(mmPerPx(), 3) }} mm · font sizes in pt · change scale in Export → PDF for print
      </p>
    </fieldset>

    <ColorField v-model="banner.background" label="Background color" />
    <label class="label cursor-pointer gap-2 text-xs">
      <input v-model="banner.transparent" type="checkbox" class="checkbox checkbox-xs" />
      Transparent background (PNG / SVG)
    </label>

    <ColorField v-model="banner.fontColor" label="Default font color" />

    <fieldset class="fieldset py-1">
      <legend class="fieldset-legend py-1">Default font</legend>
      <select v-model="banner.fontFamily" class="select select-sm w-full" :style="{ fontFamily: banner.fontFamily }">
        <option v-for="f in FONT_FAMILIES" :key="f.value" :value="f.value" :style="{ fontFamily: f.value }">{{ f.label }}</option>
      </select>
    </fieldset>
  </div>
</template>
