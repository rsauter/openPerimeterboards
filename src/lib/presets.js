export const SIZE_PRESETS = [
  { group: 'IAB Display', label: 'Medium Rectangle', width: 300, height: 250 },
  { group: 'IAB Display', label: 'Large Rectangle', width: 336, height: 280 },
  { group: 'IAB Display', label: 'Leaderboard', width: 728, height: 90 },
  { group: 'IAB Display', label: 'Super Leaderboard', width: 970, height: 90 },
  { group: 'IAB Display', label: 'Billboard', width: 970, height: 250 },
  { group: 'IAB Display', label: 'Wide Skyscraper', width: 160, height: 600 },
  { group: 'IAB Display', label: 'Half Page', width: 300, height: 600 },
  { group: 'Mobile', label: 'Mobile Banner', width: 320, height: 50 },
  { group: 'Mobile', label: 'Large Mobile Banner', width: 320, height: 100 },
  { group: 'Mobile', label: 'Mobile Interstitial', width: 320, height: 480 },
  { group: 'Social', label: 'Link Post / OG Image', width: 1200, height: 628 },
  { group: 'Social', label: 'Square Post', width: 1080, height: 1080 },
  { group: 'Social', label: 'Portrait Post', width: 1080, height: 1350 },
  { group: 'Social', label: 'Story', width: 1080, height: 1920 },
  // Print presets: 1 px = 1 mm (mmPerPx is used as default for the PDF export)
  { group: 'Print (1 px = 1 mm)', label: 'A5', width: 148, height: 210, mmPerPx: 1 },
  { group: 'Print (1 px = 1 mm)', label: 'A4', width: 210, height: 297, mmPerPx: 1 },
  { group: 'Print (1 px = 1 mm)', label: 'A3', width: 297, height: 420, mmPerPx: 1 },
  { group: 'Print (1 px = 1 mm)', label: 'A2 Poster', width: 420, height: 594, mmPerPx: 1 },
  { group: 'Print (1 px = 1 mm)', label: 'DIN lang (DL) Flyer', width: 99, height: 210, mmPerPx: 1 },
  { group: 'Print (1 px = 1 mm)', label: 'Postcard A6', width: 148, height: 105, mmPerPx: 1 },
  { group: 'Print (1 px = 1 mm)', label: 'Roll-up 85 × 200 cm', width: 850, height: 2000, mmPerPx: 1 },
]

export const DPI_PRESETS = [
  { label: '1 px = 1 mm', mmPerPx: 1 },
  { label: '72 dpi (1 px = 1 pt)', mmPerPx: 25.4 / 72 },
  { label: '96 dpi (screen)', mmPerPx: 25.4 / 96 },
  { label: '150 dpi', mmPerPx: 25.4 / 150 },
  { label: '300 dpi', mmPerPx: 25.4 / 300 },
]

export const BLEED_PRESETS = [0, 2, 3, 5]

// System fonts only: they render identically in the editor and in PNG/JPG export
// (an SVG drawn into a canvas cannot load web fonts).
export const FONT_FAMILIES = [
  { label: 'System UI', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Tahoma, sans-serif' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
]

export const FONT_WEIGHTS = [
  { label: 'Light', value: 300 },
  { label: 'Regular', value: 400 },
  { label: 'Semibold', value: 600 },
  { label: 'Bold', value: 700 },
  { label: 'Black', value: 900 },
]

export const COLOR_SWATCHES = [
  '#ffffff', '#000000', '#1f2937', '#6b7280', '#e5e7eb',
  '#ef4444', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#2563eb', '#7c3aed', '#db2777',
]
