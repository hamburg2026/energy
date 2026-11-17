import { useState } from 'react'
import { useData } from '../lib/DataContext'
import { SPARTEN, DEFAULT_REF_PRICES, estimatedConsumption, refPrice } from '../lib/energy'
import { fmtNum, parseNum } from '../lib/fmt'
import { docAll, docDelete } from '../lib/storage'
import { PageHeader, Field } from './ui'
import { loadDemo } from './Dashboard'

export default function Settings() {
  const data = useData()
  const { settings, setSettings } = data
  const set = (patch) => setSettings(s => ({ ...s, ...patch }))
  const [newYear, setNewYear] = useState('')
  const years = [...new Set(SPARTEN.flatMap(sp => Object.keys(settings.refPrices[sp.id] || {})))].map(Number).sort((a, b) => b - a)

  function setRef(sp, y, v) {
    setSettings(s => {
      const rp = { ...DEFAULT_REF_PRICES, ...(s.refPrices || {}) }
      const n = parseNum(v)
      const t = { ...rp[sp] }
      if (n == null) delete t[y]; else t[y] = n
      return { ...s, refPrices: { ...rp, [sp]: t } }
    })
  }

  async function wipe() {
    if (!confirm('Wirklich ALLE Daten (Verträge, Rechnungen, Tarife, Dokumente) löschen?')) return
    data.setContracts([]); data.setInvoices([]); data.setOffers([])
    const docs = await docAll().catch(() => [])
    await Promise.all(docs.map(d => docDelete(d.id)))
  }

  return (
    <div>
      <PageHeader title="Einstellungen" subtitle="Haushaltsdaten, Verbräuche und Vergleichswerte" />

      <div className="two-col">
        <div className="card">
          <h3 className="card-h">🏠 Haushalt</h3>
          <div className="form-grid">
            <Field label="Postleitzahl" hint="für die Suche auf Vergleichsportalen">
              <input value={settings.plz} onChange={e => set({ plz: e.target.value })} inputMode="numeric" maxLength={5} />
            </Field>
            <Field label="Personen im Haushalt"><input type="number" min="1" value={settings.persons} onChange={e => set({ persons: e.target.value })} /></Field>
            <Field label="Wechsel empfehlen ab (€/Jahr)" hint="Mindestersparnis für eine Wechselempfehlung">
              <input type="number" min="0" value={settings.savingThreshold} onChange={e => set({ savingThreshold: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="card">
          <h3 className="card-h">📈 Jahresverbrauch für Berechnungen</h3>
          <p className="muted small" style={{ marginTop: 0 }}>Leer lassen = automatisch aus der letzten Rechnung hochrechnen.</p>
          <div className="form-grid">
            {SPARTEN.map(sp => {
              const est = estimatedConsumption(sp.id, { ...data, settings: { ...settings, consumption: {} } })
              return (
                <Field key={sp.id} label={`${sp.icon} ${sp.label} (${sp.unit})`} hint={`automatisch: ${fmtNum(est.value, 0)} (${est.source})`}>
                  <input inputMode="decimal" value={settings.consumption[sp.id] ?? ''} placeholder={String(est.value)}
                    onChange={e => set({ consumption: { ...settings.consumption, [sp.id]: e.target.value } })} />
                </Field>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-h-row">
          <h3 className="card-h">📊 Richtwerte Durchschnittspreise Deutschland</h3>
          <button className="btn-ghost" onClick={() => set({ refPrices: DEFAULT_REF_PRICES })}>Standardwerte</button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Ungefähre Durchschnittspreise privater Haushalte inkl. Grundpreisanteil, Steuern und Abgaben (Strom/Gas in ct/kWh, Wasser inkl. Abwasser in €/m³).
          Dienen als Vergleichslinie in der Preisentwicklung und für Empfehlungen – bei Bedarf mit aktuellen Werten (z. B. BDEW, Destatis, Verivox) überschreiben.
        </p>
        <div className="table-wrapper">
          <table className="ref-table">
            <thead><tr><th>Jahr</th>{SPARTEN.map(sp => <th key={sp.id} className="num">{sp.icon} {sp.label} ({sp.priceUnit})</th>)}</tr></thead>
            <tbody>
              {years.map(y => (
                <tr key={y}>
                  <td>{y}</td>
                  {SPARTEN.map(sp => (
                    <td key={sp.id} className="num">
                      <input inputMode="decimal" style={{ width: 90, textAlign: 'right', padding: '0.3rem 0.5rem' }}
                        defaultValue={settings.refPrices[sp.id]?.[y] != null ? String(settings.refPrices[sp.id][y]).replace('.', ',') : ''}
                        onBlur={e => setRef(sp.id, y, e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem', alignItems: 'center' }}>
          <input type="number" placeholder="Jahr" value={newYear} onChange={e => setNewYear(e.target.value)} style={{ width: 110 }} />
          <button className="btn-secondary" onClick={() => {
            const y = Number(newYear)
            if (y > 1990 && y < 2100) {
              SPARTEN.forEach(sp => setRef(sp.id, y, String(refPrice(settings, sp.id, y) ?? '').replace('.', ',')))
              setNewYear('')
            }
          }}>Jahr hinzufügen</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <h3 className="card-h">🧪 Daten</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => { if (confirm('Beispieldaten laden? Vorhandene Verträge, Rechnungen und Tarife werden ersetzt.')) loadDemo(data) }}>Beispieldaten laden</button>
          <button className="btn-secondary" onClick={() => {
            if (!confirm(localStorage.getItem('app_pin_hash') ? 'PIN ändern? Du wirst zur PIN-Eingabe weitergeleitet.' : 'PIN-Sperre einrichten?')) return
            localStorage.removeItem('app_pin_hash'); localStorage.removeItem('pin_skipped'); sessionStorage.removeItem('pin_ok')
            window.location.reload()
          }}>🔒 {localStorage.getItem('app_pin_hash') ? 'PIN ändern' : 'PIN einrichten'}</button>
          <button className="btn-danger" onClick={wipe}>Alle Daten löschen</button>
        </div>
        <p className="muted small">Alle Daten werden ausschließlich lokal in diesem Browser gespeichert (localStorage/IndexedDB). Nutze die Datensicherung, um sie auf ein anderes Gerät zu übertragen.</p>
      </div>
    </div>
  )
}
