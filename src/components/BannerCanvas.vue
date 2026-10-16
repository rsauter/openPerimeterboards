<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, onUpdated, nextTick, watch } from 'vue'
import { banner, selectedId, selected } from '../lib/store.js'
import { textLines, textStyle, textAnchor, rotationTransform } from '../lib/render.js'
import { graphicHref } from '../lib/assets.js'

const props = defineProps({ zoom: { type: [Number, String], default: 'fit' } })
const emit = defineEmits(['scale'])

const wrapper = ref(null)
const svgEl = ref(null)
const textRefs = {}
const bboxes = reactive({}) // id -> {x,y,width,height} in banner units (pre-rotation)
const avail = reactive({ w: 800, h: 600 })
const guides = reactive({ v: [], h: [] })

const scale = computed(() => {
  if (props.zoom !== 'fit') return Number(props.zoom)
  const s = Math.min((avail.w - 48) / banner.width, (avail.h - 48) / banner.height)
  return Math.max(0.05, Math.min(s, 4))
})
watch(scale, (s) => emit('scale', s), { immediate: true })

// ------------------------------------------------------------ bboxes

function measure() {
  for (const el of banner.elements) {
    let box
    if (el.type === 'graphic') box = { x: el.x, y: el.y, width: el.width, height: el.height }
    else {
      const node = textRefs[el.id]
      if (!node) continue
      try {
        const b = node.getBBox()
        box = { x: b.x, y: b.y, width: b.width, height: b.height }
      } catch { continue }
    }
    const prev = bboxes[el.id]
    if (!prev || prev.x !== box.x || prev.y !== box.y || prev.width !== box.width || prev.height !== box.height) {
      bboxes[el.id] = box
    }
  }
}
onUpdated(measure)

let ro
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    avail.w = entry.contentRect.width
    avail.h = entry.contentRect.height
  })
  ro.observe(wrapper.value)
  nextTick(measure)
  document.fonts?.ready.then(measure)
})
onBeforeUnmount(() => ro?.disconnect())

const selBox = computed(() => (selected.value ? bboxes[selected.value.id] : null))

// ------------------------------------------------------------ pointer interaction

function toBanner(evt) {
  const pt = svgEl.value.createSVGPoint()
  pt.x = evt.clientX
  pt.y = evt.clientY
  return pt.matrixTransform(svgEl.value.getScreenCTM().inverse())
}

let drag = null

function onElementDown(evt, el) {
  if (evt.button !== 0) return
  evt.stopPropagation()
  selectedId.value = el.id
  if (el.locked) return
  const p = toBanner(evt)
  drag = { mode: 'move', el, start: p, x: el.x, y: el.y, box: { ...(bboxes[el.id] || { x: el.x, y: el.y, width: 0, height: 0 }) } }
  capture(evt)
}

function onHandleDown(evt) {
  const el = selected.value
  if (!el || el.locked) return
  evt.stopPropagation()
  const p = toBanner(evt)
  drag = {
    mode: 'resize', el, start: p,
    width: el.width, height: el.height, fontSize: el.fontSize,
    boxH: bboxes[el.id]?.height || el.fontSize,
  }
  capture(evt)
}

function capture(evt) {
  evt.currentTarget.setPointerCapture?.(evt.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

function snap(value, targets, threshold) {
  let best = null
  for (const t of targets) {
    const d = t.target - value
    if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t.target }
  }
  return best
}

function onMove(evt) {
  if (!drag) return
  const p = toBanner(evt)
  let dx = p.x - drag.start.x
  let dy = p.y - drag.start.y
  const el = drag.el

  if (drag.mode === 'move') {
    guides.v = []
    guides.h = []
    if (!evt.altKey) {
      const th = 6 / scale.value
      const b = drag.box
      const W = banner.width, H = banner.height
      const xCands = [
        { off: 0 }, { off: b.width / 2 }, { off: b.width },
      ].map((c) => snap(b.x + dx + c.off, [{ target: 0 }, { target: W / 2 }, { target: W }], th)).filter(Boolean)
      const yCands = [
        { off: 0 }, { off: b.height / 2 }, { off: b.height },
      ].map((c) => snap(b.y + dy + c.off, [{ target: 0 }, { target: H / 2 }, { target: H }], th)).filter(Boolean)
      const bx = xCands.sort((a, c) => Math.abs(a.d) - Math.abs(c.d))[0]
      const by = yCands.sort((a, c) => Math.abs(a.d) - Math.abs(c.d))[0]
      if (bx) { dx += bx.d; guides.v = [bx.line] }
      if (by) { dy += by.d; guides.h = [by.line] }
    }
    el.x = Math.round(drag.x + dx)
    el.y = Math.round(drag.y + dy)
  } else if (drag.mode === 'resize') {
    // project the pointer delta into the element's rotated frame
    const r = ((el.rotation || 0) * Math.PI) / 180
    const lx = dx * Math.cos(r) + dy * Math.sin(r)
    const ly = -dx * Math.sin(r) + dy * Math.cos(r)
    if (el.type === 'graphic') {
      const w = Math.max(4, drag.width + lx)
      if (el.keepRatio !== false && !evt.shiftKey) {
        el.width = Math.round(w)
        el.height = Math.round(w * (drag.height / drag.width))
      } else {
        el.width = Math.round(w)
        el.height = Math.round(Math.max(4, drag.height + ly))
      }
    } else {
      const factor = Math.max(0.1, (drag.boxH + ly) / drag.boxH)
      el.fontSize = Math.max(4, Math.round(drag.fontSize * factor))
    }
  }
}

function onUp() {
  drag = null
  guides.v = []
  guides.h = []
  window.removeEventListener('pointermove', onMove)
}

function onBackgroundDown() {
  selectedId.value = null
}

defineExpose({ svgEl })
</script>

<template>
  <div ref="wrapper" class="checkerboard relative flex-1 overflow-auto" @pointerdown.self="onBackgroundDown">
    <div class="flex min-h-full min-w-full items-center justify-center p-6" @pointerdown.self="onBackgroundDown">
      <svg
        ref="svgEl"
        :width="banner.width * scale"
        :height="banner.height * scale"
        :viewBox="`0 0 ${banner.width} ${banner.height}`"
        class="shrink-0 select-none overflow-visible shadow-xl"
        style="touch-action: none"
        @pointerdown="onBackgroundDown"
      >
        <defs>
          <clipPath id="banner-clip"><rect :width="banner.width" :height="banner.height" /></clipPath>
        </defs>

        <!-- banner content (clipped to banner bounds) -->
        <g clip-path="url(#banner-clip)">
          <rect v-if="!banner.transparent" :width="banner.width" :height="banner.height" :fill="banner.background" />
          <template v-for="el in banner.elements" :key="el.id">
            <image
              v-if="el.type === 'graphic' && el.visible !== false && graphicHref(el)"
              :href="graphicHref(el)"
              :x="el.x" :y="el.y" :width="el.width" :height="el.height"
              preserveAspectRatio="none"
              :opacity="el.opacity"
              :transform="rotationTransform(el)"
              :class="el.locked ? 'cursor-default' : 'cursor-move'"
              @pointerdown="onElementDown($event, el)"
            />
            <g
              v-else-if="el.type === 'graphic' && el.visible !== false"
              :transform="rotationTransform(el)"
              class="cursor-move"
              @pointerdown="onElementDown($event, el)"
            >
              <rect :x="el.x" :y="el.y" :width="el.width" :height="el.height" fill="rgba(239,68,68,.15)" stroke="#ef4444" :stroke-width="1.5 / scale" :stroke-dasharray="`${6 / scale} ${4 / scale}`" />
              <text :x="el.x + el.width / 2" :y="el.y + el.height / 2" text-anchor="middle" dominant-baseline="middle" fill="#ef4444" :font-size="Math.max(8, Math.min(el.width / 8, 14 / scale))" font-family="sans-serif">graphic missing</text>
            </g>
            <text
              v-else-if="el.type === 'text' && el.visible !== false"
              :ref="(n) => (n ? (textRefs[el.id] = n) : delete textRefs[el.id])"
              :text-anchor="textAnchor(el)"
              :style="textStyle(el, banner)"
              :opacity="el.opacity"
              :transform="rotationTransform(el)"
              xml:space="preserve"
              :class="el.locked ? 'cursor-default' : 'cursor-move'"
              @pointerdown="onElementDown($event, el)"
            >
              <tspan v-for="(line, i) in textLines(el)" :key="i" :x="el.x" :y="line.y">{{ line.text }}</tspan>
            </text>
          </template>
        </g>

        <!-- banner outline (outside clip) -->
        <rect :width="banner.width" :height="banner.height" fill="none" stroke="rgba(0,0,0,.25)" :stroke-width="1 / scale" pointer-events="none" />

        <!-- snap guides -->
        <line v-for="x in guides.v" :key="'v' + x" :x1="x" :x2="x" :y1="-10000" :y2="10000" stroke="#ec4899" :stroke-width="1 / scale" pointer-events="none" />
        <line v-for="y in guides.h" :key="'h' + y" :y1="y" :y2="y" :x1="-10000" :x2="10000" stroke="#ec4899" :stroke-width="1 / scale" pointer-events="none" />

        <!-- selection -->
        <g v-if="selected && selBox && selected.visible !== false" :transform="rotationTransform(selected)">
          <rect
            :x="selBox.x - 2 / scale" :y="selBox.y - 2 / scale"
            :width="selBox.width + 4 / scale" :height="selBox.height + 4 / scale"
            fill="none" stroke="#6366f1" :stroke-width="1.5 / scale" :stroke-dasharray="`${4 / scale} ${3 / scale}`"
            pointer-events="none"
          />
          <rect
            v-if="!selected.locked"
            :x="selBox.x + selBox.width + 2 / scale - 5 / scale"
            :y="selBox.y + selBox.height + 2 / scale - 5 / scale"
            :width="10 / scale" :height="10 / scale"
            fill="#fff" stroke="#6366f1" :stroke-width="1.5 / scale"
            class="cursor-nwse-resize"
            @pointerdown="onHandleDown"
          >
            <title>{{ selected.type === 'text' ? 'Drag to change font size' : 'Drag to resize (Shift = free ratio)' }}</title>
          </rect>
        </g>
      </svg>
    </div>
  </div>
</template>
