import { useState, useCallback } from 'react'

export function lsGet(key, fallback) {
  try {
    const s = localStorage.getItem(key)
    if (s == null || s === 'undefined') return fallback
    return JSON.parse(s) ?? fallback
  } catch {
    return fallback
  }
}

export function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('ls-change', { detail: key }))
}

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => lsGet(key, initial))
  const set = useCallback((next) => {
    setValue(prev => {
      const v = typeof next === 'function' ? next(prev) : next
      lsSet(key, v)
      return v
    })
  }, [key])
  return [value, set]
}

// ── IndexedDB für hochgeladene Dokumente (PDFs) ─────────────────────────
const DB_NAME = 'energy-docs'
const STORE = 'docs'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const result = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(result?.result ?? result)
    t.onerror = () => reject(t.error)
  })
}

export const docPut = (doc) => tx('readwrite', s => s.put(doc))
export const docGet = (id) => tx('readonly', s => s.get(id))
export const docDelete = (id) => tx('readwrite', s => s.delete(id))
export const docAll = () => tx('readonly', s => s.getAll())

export async function openDoc(id) {
  const doc = await docGet(id)
  if (!doc) { alert('Dokument nicht gefunden (evtl. nicht im Backup enthalten).'); return }
  const url = URL.createObjectURL(doc.blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
