<script setup>
const props = defineProps({
  modelValue: Number,
  label: String,
  min: { type: Number, default: -100000 },
  max: { type: Number, default: 100000 },
  step: { type: Number, default: 1 },
  suffix: String,
})
const emit = defineEmits(['update:modelValue'])
function update(e) {
  const v = parseFloat(e.target.value)
  if (!isFinite(v)) return
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, v)))
}
</script>

<template>
  <label class="input input-sm w-full min-w-0 gap-1 px-2">
    <span class="shrink-0 text-xs opacity-60">{{ label }}</span>
    <input class="min-w-0 grow" type="number" :value="modelValue" :min="min" :max="max" :step="step" @change="update" @keydown.enter="update" />
    <span v-if="suffix" class="shrink-0 text-xs opacity-50">{{ suffix }}</span>
  </label>
</template>
