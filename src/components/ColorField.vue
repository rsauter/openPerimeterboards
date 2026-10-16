<script setup>
import { ref, watch } from 'vue'
import { COLOR_SWATCHES } from '../lib/presets.js'

const props = defineProps({
  modelValue: { type: String, default: null },
  label: String,
  allowInherit: { type: Boolean, default: false },
  inheritLabel: { type: String, default: '' },
  inheritValue: { type: String, default: '#000000' },
})
const emit = defineEmits(['update:modelValue'])

const text = ref(props.modelValue || '')
watch(() => props.modelValue, (v) => (text.value = v || ''))

function normalize(v) {
  let s = String(v).trim()
  if (!s.startsWith('#')) s = `#${s}`
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + [...s.slice(1)].map((c) => c + c).join('')
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null
}
function commitText() {
  const v = normalize(text.value)
  if (v) emit('update:modelValue', v)
  else text.value = props.modelValue || ''
}
</script>

<template>
  <fieldset class="fieldset py-1">
    <legend v-if="label" class="fieldset-legend py-1">{{ label }}</legend>
    <div class="flex items-center gap-2">
      <input
        type="color"
        class="h-8 w-10 shrink-0 cursor-pointer rounded border border-base-300 bg-transparent p-0.5"
        :value="modelValue || inheritValue"
        @input="emit('update:modelValue', $event.target.value)"
      />
      <input
        v-model="text"
        class="input input-sm w-full font-mono"
        :placeholder="allowInherit ? `${inheritLabel} (${inheritValue})` : '#rrggbb'"
        maxlength="7"
        @change="commitText"
        @keydown.enter="commitText"
      />
      <button
        v-if="allowInherit && modelValue"
        class="btn btn-ghost btn-xs"
        :title="t('color.reset')"
        @click="emit('update:modelValue', null)"
      >↺</button>
    </div>
    <div class="mt-1 flex flex-wrap gap-1">
      <button
        v-for="c in COLOR_SWATCHES" :key="c"
        class="h-4 w-4 rounded-sm border border-base-300"
        :class="{ 'ring-2 ring-primary ring-offset-1': (modelValue || '').toLowerCase() === c }"
        :style="{ background: c }"
        :title="c"
        @click="emit('update:modelValue', c)"
      />
    </div>
  </fieldset>
</template>
