// Tiny promise wrapper around IndexedDB. Everything lives in the browser —
// the server never stores projects or graphics.
const DB_NAME = 'adbanner-generator'
const DB_VERSION = 1

let dbPromise
export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB not available in this browser'))
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function dbGet(store, key) {
  const db = await openDb()
  return wrap(db.transaction(store).objectStore(store).get(key))
}
export async function dbPut(store, value) {
  const db = await openDb()
  return wrap(db.transaction(store, 'readwrite').objectStore(store).put(value))
}
export async function dbDelete(store, key) {
  const db = await openDb()
  return wrap(db.transaction(store, 'readwrite').objectStore(store).delete(key))
}
export async function dbGetAll(store) {
  const db = await openDb()
  return wrap(db.transaction(store).objectStore(store).getAll())
}
export async function dbKeys(store) {
  const db = await openDb()
  return wrap(db.transaction(store).objectStore(store).getAllKeys())
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export async function storageEstimate() {
  try {
    const est = await navigator.storage?.estimate?.()
    const persisted = (await navigator.storage?.persisted?.()) ?? false
    return est ? { usage: est.usage, quota: est.quota, persisted } : null
  } catch {
    return null
  }
}
