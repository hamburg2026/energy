import { useRef } from 'react'
import { docPut, docDelete, openDoc } from '../lib/storage'
import { uid } from '../lib/fmt'

/** Anhängen eines Dokuments (PDF/Bild) – gespeichert lokal in IndexedDB. */
export default function DocAttach({ docId, docName, onChange }) {
  const ref = useRef(null)
  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const id = uid()
    await docPut({ id, name: f.name, type: f.type, size: f.size, added: new Date().toISOString(), blob: f })
    if (docId) await docDelete(docId).catch(() => {})
    onChange({ docId: id, docName: f.name })
    e.target.value = ''
  }
  return (
    <div className="doc-attach">
      {docId ? (
        <>
          <button type="button" className="btn-link" onClick={() => openDoc(docId)}>📄 {docName || 'Dokument'}</button>
          <button type="button" className="btn-link" style={{ color: '#dc2626' }}
            onClick={async () => { await docDelete(docId).catch(() => {}); onChange({ docId: null, docName: null }) }}>entfernen</button>
        </>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => ref.current?.click()}>📎 Dokument anhängen</button>
      )}
      <input ref={ref} type="file" accept="application/pdf,image/*" hidden onChange={onFile} />
    </div>
  )
}
