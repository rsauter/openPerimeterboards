// Resolves CSS font-family lists to TrueType files installed on the machine so
// they can be embedded into print PDFs (printers require embedded fonts).
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// style keys: r = regular, b = bold, i = italic, bi = bold italic
const ARIAL = [
  { r: 'arial.ttf', b: 'arialbd.ttf', i: 'ariali.ttf', bi: 'arialbi.ttf' },
  { r: 'Arial.ttf', b: 'Arial Bold.ttf', i: 'Arial Italic.ttf', bi: 'Arial Bold Italic.ttf' },
  { r: 'LiberationSans-Regular.ttf', b: 'LiberationSans-Bold.ttf', i: 'LiberationSans-Italic.ttf', bi: 'LiberationSans-BoldItalic.ttf' },
]
const TIMES = [
  { r: 'times.ttf', b: 'timesbd.ttf', i: 'timesi.ttf', bi: 'timesbi.ttf' },
  { r: 'Times New Roman.ttf', b: 'Times New Roman Bold.ttf', i: 'Times New Roman Italic.ttf', bi: 'Times New Roman Bold Italic.ttf' },
  { r: 'LiberationSerif-Regular.ttf', b: 'LiberationSerif-Bold.ttf', i: 'LiberationSerif-Italic.ttf', bi: 'LiberationSerif-BoldItalic.ttf' },
]
const COURIER = [
  { r: 'cour.ttf', b: 'courbd.ttf', i: 'couri.ttf', bi: 'courbi.ttf' },
  { r: 'Courier New.ttf', b: 'Courier New Bold.ttf', i: 'Courier New Italic.ttf', bi: 'Courier New Bold Italic.ttf' },
  { r: 'LiberationMono-Regular.ttf', b: 'LiberationMono-Bold.ttf', i: 'LiberationMono-Italic.ttf', bi: 'LiberationMono-BoldItalic.ttf' },
]
const SEGOE = [{ r: 'segoeui.ttf', b: 'segoeuib.ttf', i: 'segoeuii.ttf', bi: 'segoeuiz.ttf' }]
const DEJAVU = [{ r: 'DejaVuSans.ttf', b: 'DejaVuSans-Bold.ttf', i: 'DejaVuSans-Oblique.ttf', bi: 'DejaVuSans-BoldOblique.ttf' }]

const FAMILIES = {
  arial: ARIAL,
  helvetica: ARIAL,
  'liberation sans': ARIAL.slice(2),
  verdana: [
    { r: 'verdana.ttf', b: 'verdanab.ttf', i: 'verdanai.ttf', bi: 'verdanaz.ttf' },
    { r: 'Verdana.ttf', b: 'Verdana Bold.ttf', i: 'Verdana Italic.ttf', bi: 'Verdana Bold Italic.ttf' },
  ],
  geneva: [{ r: 'Geneva.ttf' }],
  tahoma: [{ r: 'tahoma.ttf', b: 'tahomabd.ttf' }, { r: 'Tahoma.ttf', b: 'Tahoma Bold.ttf' }],
  'trebuchet ms': [
    { r: 'trebuc.ttf', b: 'trebucbd.ttf', i: 'trebucit.ttf', bi: 'trebucbi.ttf' },
    { r: 'Trebuchet MS.ttf', b: 'Trebuchet MS Bold.ttf', i: 'Trebuchet MS Italic.ttf', bi: 'Trebuchet MS Bold Italic.ttf' },
  ],
  'segoe ui': SEGOE,
  impact: [{ r: 'impact.ttf' }, { r: 'Impact.ttf' }],
  georgia: [
    { r: 'georgia.ttf', b: 'georgiab.ttf', i: 'georgiai.ttf', bi: 'georgiaz.ttf' },
    { r: 'Georgia.ttf', b: 'Georgia Bold.ttf', i: 'Georgia Italic.ttf', bi: 'Georgia Bold Italic.ttf' },
  ],
  'times new roman': TIMES,
  times: TIMES,
  'courier new': COURIER,
  courier: COURIER,
  'system-ui': [...SEGOE, ...ARIAL, ...DEJAVU],
  '-apple-system': [...ARIAL],
  roboto: [{ r: 'Roboto-Regular.ttf', b: 'Roboto-Bold.ttf', i: 'Roboto-Italic.ttf', bi: 'Roboto-BoldItalic.ttf' }],
  'sans-serif': [...ARIAL, ...DEJAVU],
  serif: TIMES,
  monospace: COURIER,
}

function fontDirs() {
  const dirs = []
  if (process.env.FONTS_DIR) dirs.push(...process.env.FONTS_DIR.split(path.delimiter))
  dirs.push(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts'))
  if (process.platform === 'win32') {
    dirs.push(path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'))
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'))
  } else if (process.platform === 'darwin') {
    dirs.push('/Library/Fonts', '/System/Library/Fonts', '/System/Library/Fonts/Supplemental', path.join(os.homedir(), 'Library/Fonts'))
  } else {
    dirs.push('/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts'), path.join(os.homedir(), '.local/share/fonts'))
  }
  return dirs.filter((d) => existsSync(d))
}

let index // lower-case file name -> absolute path
function buildIndex() {
  index = new Map()
  const walk = (dir, depth) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory() && depth < 4) walk(full, depth + 1)
      else if (/\.(ttf|otf)$/i.test(e.name) && !index.has(e.name.toLowerCase())) index.set(e.name.toLowerCase(), full)
    }
  }
  for (const d of fontDirs()) walk(d, 0)
  return index
}

function lookup(file) {
  if (!index) buildIndex()
  return file ? index.get(file.toLowerCase()) : undefined
}

/**
 * Resolve a CSS font-family list ("Arial, Helvetica, sans-serif") to a font file.
 * Returns { file, family, style, exact } or null if nothing usable is installed.
 */
export function resolveFont(familyList, bold, italic) {
  const want = bold && italic ? 'bi' : bold ? 'b' : italic ? 'i' : 'r'
  const fallbacks = { bi: ['bi', 'b', 'i', 'r'], b: ['b', 'r'], i: ['i', 'r'], r: ['r'] }[want]
  const names = String(familyList || '')
    .split(',')
    .map((f) => f.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean)
  if (!names.includes('sans-serif')) names.push('sans-serif')
  for (const [i, name] of names.entries()) {
    for (const set of FAMILIES[name] || []) {
      for (const style of fallbacks) {
        const file = lookup(set[style])
        if (file) return { file, family: name, style, exact: i === 0 && style === want }
      }
    }
  }
  return null
}

export function fontIndexSize() {
  if (!index) buildIndex()
  return index.size
}
