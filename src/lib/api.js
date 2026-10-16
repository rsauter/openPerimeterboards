import { locale } from '../i18n/index.js'

const langHeaders = () => ({ 'Accept-Language': locale.value })

export async function convertVector(file, { page = 0 } = {}) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`/api/convert?page=${page}`, { method: 'POST', body, headers: langHeaders() })
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error(`HTTP ${res.status}`)
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export async function fetchHealth() {
  try {
    const res = await fetch('/api/health')
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

/** Sends banner JSON + the original graphic files; the server keeps nothing. */
export async function exportPdf(banner, options, assetRecords = []) {
  const body = new FormData()
  const assets = Object.fromEntries(assetRecords.map((a) => [a.id, { name: a.name }]))
  body.append('project', JSON.stringify({ banner, options, assets }))
  for (const a of assetRecords) body.append('asset', a.original, a.id)
  const res = await fetch('/api/export/pdf', { method: 'POST', body, headers: langHeaders() })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { msg = (await res.json()).error || msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'banner_print.pdf'
  let report = null
  try { report = JSON.parse(decodeURIComponent(res.headers.get('X-Pdf-Report') || '')) } catch { /* ignore */ }
  return { blob, filename, report }
}
