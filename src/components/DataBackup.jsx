import { useRef, useState } from 'react'
import { DATA_KEYS } from '../lib/DataContext'
import { docAll, docPut } from '../lib/storage'
import { PageHeader } from './ui'

async function deriveKey(password, salt) {
  const enc = new TextEncoder()
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
function toBase64(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(s)
}
const fromBase64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0))

export default function DataBackup() {
  const fileRef = useRef(null)
  const [password, setPassword] = useState('')
  const [withDocs, setWithDocs] = useState(true)
  const [busy, setBusy] = useState(false)
  const [restore, setRestore] = useState(null) // { parsed, pw, error }

  async function exportBackup() {
    setBusy(true)
    try {
      const data = {}
      DATA_KEYS.forEach(k => { const raw = localStorage.getItem(k); if (raw) try { data[k] = JSON.parse(raw) } catch { /* skip */ } })
      let docs = []
      if (withDocs) {
        const all = await docAll().catch(() => [])
        docs = await Promise.all(all.map(async d => ({ ...d, blob: undefined, data: toBase64(await d.blob.arrayBuffer()) })))
      }
      const plain = new TextEncoder().encode(JSON.stringify({ app: 'energy', version: 1, exportedAt: new Date().toISOString(), data, docs }))
      const date = new Date().toISOString().slice(0, 10)
      let blob, name
      if (password) {
        const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12))
        const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(password, salt), plain)
        blob = new Blob([JSON.stringify({ app: 'energy', encrypted: true, salt: toBase64(salt), iv: toBase64(iv), payload: toBase64(enc) })], { type: 'application/json' })
        name = `energie-sicherung-${date}.enc.json`
      } else {
        blob = new Blob([plain], { type: 'application/json' })
        name = `energie-sicherung-${date}.json`
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally { setBusy(false) }
  }

  async function onFile(f) {
    try {
      const parsed = JSON.parse(await f.text())
      if (parsed.encrypted) setRestore({ parsed, pw: '', error: null })
      else await apply(parsed)
    } catch { alert('Sicherungsdatei konnte nicht gelesen werden.') }
  }

  async function decrypt() {
    try {
      const { parsed, pw } = restore
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(parsed.iv) }, await deriveKey(pw, fromBase64(parsed.salt)), fromBase64(parsed.payload))
      await apply(JSON.parse(new TextDecoder().decode(dec)))
    } catch { setRestore(r => ({ ...r, error: 'Falsches Passwort oder beschädigte Datei.' })) }
  }

  async function apply(inner) {
    if (!inner?.data) { alert('Keine gültige Sicherung.'); return }
    if (!confirm(`Sicherung vom ${new Date(inner.exportedAt).toLocaleString('de-DE')} wiederherstellen? Aktuelle Daten werden ersetzt.`)) return
    DATA_KEYS.forEach(k => { if (k in inner.data) localStorage.setItem(k, JSON.stringify(inner.data[k])) })
    for (const d of inner.docs || []) {
      await docPut({ ...d, data: undefined, blob: new Blob([fromBase64(d.data)], { type: d.type }) })
    }
    window.location.reload()
  }

  return (
    <div>
      <PageHeader title="Datensicherung" subtitle="Daten exportieren und auf einem anderen Gerät wiederherstellen" />
      <div className="two-col">
        <div className="card">
          <h3 className="card-h">💾 Sicherung erstellen</h3>
          <label className="check" style={{ marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={withDocs} onChange={e => setWithDocs(e.target.checked)} /> hochgeladene Dokumente (PDFs) einschließen
          </label>
          <input type="password" placeholder="Passwort zur Verschlüsselung (optional)" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: '0.75rem' }} />
          <button onClick={exportBackup} disabled={busy}>{busy ? 'Erstelle…' : 'Sicherung herunterladen'}</button>
          <p className="muted small">Mit Passwort wird die Datei per AES-256 verschlüsselt – empfehlenswert, da Rechnungen persönliche Daten enthalten.</p>
        </div>
        <div className="card">
          <h3 className="card-h">📂 Sicherung wiederherstellen</h3>
          {restore ? (
            <>
              <p className="muted">Die Datei ist verschlüsselt.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="password" autoFocus placeholder="Passwort" value={restore.pw} style={{ flex: 1 }}
                  onChange={e => setRestore(r => ({ ...r, pw: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') decrypt() }} />
                <button onClick={decrypt}>Entschlüsseln</button>
              </div>
              {restore.error && <p style={{ color: '#dc2626' }} className="small">{restore.error}</p>}
            </>
          ) : (
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Datei auswählen…</button>
          )}
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = '' }} />
          <p className="muted small">Ersetzt Verträge, Rechnungen, Tarife und Einstellungen durch den Stand der Sicherung.</p>
        </div>
      </div>
    </div>
  )
}
