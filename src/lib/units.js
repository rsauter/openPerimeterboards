// Display units. Internally all geometry is stored in banner px; in "mm" mode
// lengths are shown in mm and font sizes in pt, using the print scale (banner.print.mmPerPx).
import { computed } from 'vue'
import { banner } from './store.js'

const PT_PER_MM = 72 / 25.4
export const DEFAULT_MM_PER_PX = 25.4 / 96

export const isMm = computed(() => banner.unit === 'mm')
export const lenUnit = computed(() => (isMm.value ? 'mm' : 'px'))
export const fontUnit = computed(() => (isMm.value ? 'pt' : 'px'))

export const mmPerPx = () => banner.print?.mmPerPx || DEFAULT_MM_PER_PX
export const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d

export const lenToDisplay = (px) => (isMm.value ? round(px * mmPerPx(), 1) : round(px, 1))
export const lenFromDisplay = (v) => (isMm.value ? v / mmPerPx() : v)
export const fontToDisplay = (px) => (isMm.value ? round(px * mmPerPx() * PT_PER_MM, 1) : round(px, 1))
export const fontFromDisplay = (v) => (isMm.value ? v / (mmPerPx() * PT_PER_MM) : v)

/** v-model helper: wraps a px property of obj as a display-unit value. */
export function unitModel(getObj, key, kind = 'len') {
  const to = kind === 'font' ? fontToDisplay : lenToDisplay
  const from = kind === 'font' ? fontFromDisplay : lenFromDisplay
  return computed({
    get: () => (getObj() ? to(getObj()[key] ?? 0) : 0),
    set: (v) => {
      const o = getObj()
      if (o) o[key] = round(from(v), 3)
    },
  })
}
