<script setup>
import { computed } from 'vue'
import { banner, selectedId, moveLayer, removeElement } from '../lib/store.js'
import { graphicHref, assetMeta } from '../lib/assets.js'

// top-most layer first
const layers = computed(() => [...banner.elements].reverse())
</script>

<template>
  <div>
    <p v-if="!layers.length" class="px-2 py-4 text-center text-sm opacity-60">No elements yet.</p>
    <ul class="menu menu-sm w-full p-0">
      <li v-for="el in layers" :key="el.id">
        <a
          class="group flex items-center gap-2 pr-1"
          :class="{ 'menu-active': el.id === selectedId, 'opacity-50': el.visible === false }"
          @click="selectedId = el.id"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-base-200">
            <img v-if="el.type === 'graphic' && graphicHref(el)" :src="graphicHref(el)" class="max-h-full max-w-full" alt="" />
            <span v-else-if="el.type === 'graphic'" class="text-xs text-error" title="Graphic missing">!</span>
            <span v-else class="font-serif text-sm font-bold">T</span>
          </span>
          <span class="flex-1 truncate">{{ el.type === 'text' ? el.text.split('\n')[0] || '(empty)' : el.name }}</span>
          <span v-if="el.type === 'graphic' && (assetMeta[el.assetId]?.legacy || el.svg)" class="badge badge-warning badge-xs" title="Original file missing (older version) – replace it in Properties">SVG only</span>
          <span v-else-if="el.type === 'graphic' && assetMeta[el.assetId]" class="badge badge-ghost badge-xs uppercase" title="Original file kept for print">{{ assetMeta[el.assetId].sourceFormat }}</span>
          <span class="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
            <button class="btn btn-ghost btn-xs px-1" :title="el.visible === false ? 'Show' : 'Hide'" @click.stop="el.visible = el.visible === false">
              {{ el.visible === false ? '◌' : '●' }}
            </button>
            <button class="btn btn-ghost btn-xs px-1" :title="el.locked ? 'Unlock' : 'Lock'" @click.stop="el.locked = !el.locked">
              {{ el.locked ? '🔒' : '🔓' }}
            </button>
            <button class="btn btn-ghost btn-xs px-1" title="Bring forward" @click.stop="moveLayer(el.id, 1)">▲</button>
            <button class="btn btn-ghost btn-xs px-1" title="Send backward" @click.stop="moveLayer(el.id, -1)">▼</button>
            <button class="btn btn-ghost btn-xs px-1 text-error" title="Delete" @click.stop="removeElement(el.id)">✕</button>
          </span>
        </a>
      </li>
    </ul>
  </div>
</template>
