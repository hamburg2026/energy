import { useState } from 'react'
import { useData } from '../lib/DataContext'
import { spById, invoiceStats, activeContract } from '../lib/energy'
import { fmt, fmtNum, fmtDate, uid } from '../lib/fmt'
import { openDoc } from '../lib/storage'
import { Modal, PageHeader, Field, SparteTabs, SparteBadge, EmptyState } from './ui'
import { normalizeNumbers, toInput } from './TariffFields'
import DocAttach from './DocAttach'

const NUM_KEYS = ['consumption', 'total', 'advancesPaid', 'workPrice', 'basePrice', 'monthlyAdvance']

export const emptyInvoice = (sparte = 'strom') => ({
  id: null, sparte, provider: '', tariff: '', invoiceDate: '', periodFrom: '', periodTo: '',
  consumption: '', total: '', advancesPaid: '', workPrice: '', basePrice: '', monthlyAdvance: '',
  notes: '', docId: null, docName: null,
})

export function invoiceToForm(inv) {
  const f = { ...emptyInvoice(inv.sparte), ...inv }
  NUM_KEYS.forEach(k => { f[k] = toInput(inv[k]) })
  return f
}

export function InvoiceForm({ initial, onSave, onCancel }) {
  const { contracts } = useData()
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const sp = spById(form.sparte)
  function submit(e) {
    e.preventDefault()
    const inv = normalizeNumbers(form, NUM_KEYS)
    inv.id ||= uid()
    onSave(inv)
  }
  const fillFromContract = () => {
    const c = activeContract(contracts, form.sparte)
    if (c) setForm(f => ({ ...f, provider: f.provider || c.provider, tariff: f.tariff || c.tariff, workPrice: f.workPrice || toInput(c.workPrice), basePrice: f.basePrice || toInput(c.basePrice) }))
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div style={{ gridColumn: '1 / -1' }}><SparteTabs value={form.sparte} onChange={v => set('sparte', v)} /></div>
        <Field label="Anbieter"><input value={form.provider} onChange={e => set('provider', e.target.value)} required /></Field>
        <Field label="Tarif"><input value={form.tariff} onChange={e => set('tariff', e.target.value)} /></Field>
        <Field label="Abrechnungszeitraum von"><input type="date" value={form.periodFrom} onChange={e => set('periodFrom', e.target.value)} required /></Field>
        <Field label="bis"><input type="date" value={form.periodTo} onChange={e => set('periodTo', e.target.value)} required /></Field>
        <Field label={`Verbrauch (${sp.unit})`}><input inputMode="decimal" value={form.consumption} onChange={e => set('consumption', e.target.value)} required /></Field>
        <Field label="Gesamtkosten brutto (€)" hint="Rechnungsbetrag des Zeitraums vor Abzug der Abschläge">
          <input inputMode="decimal" value={form.total} onChange={e => set('total', e.target.value)} required />
        </Field>
        <Field label="Geleistete Abschläge (€)"><input inputMode="decimal" value={form.advancesPaid} onChange={e => set('advancesPaid', e.target.value)} /></Field>
        <Field label="Neuer Abschlag (€/Monat)"><input inputMode="decimal" value={form.monthlyAdvance} onChange={e => set('monthlyAdvance', e.target.value)} /></Field>
        <Field label={`Arbeitspreis (${sp.priceUnit})`}><input inputMode="decimal" value={form.workPrice} onChange={e => set('workPrice', e.target.value)} /></Field>
        <Field label="Grundpreis (€/Jahr)"><input inputMode="decimal" value={form.basePrice} onChange={e => set('basePrice', e.target.value)} /></Field>
        <Field label="Rechnungsdatum"><input type="date" value={form.invoiceDate} onChange={e => set('invoiceDate', e.target.value)} /></Field>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={fillFromContract}>Preise aus Vertrag übernehmen</button>
        </div>
        <Field label="Notizen" span={2}><textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <DocAttach docId={form.docId} docName={form.docName} onChange={d => setForm(f => ({ ...f, ...d }))} />
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button type="submit">Speichern</button>
      </div>
    </form>
  )
}

export default function Invoices({ onNavigate }) {
  const data = useData()
  const { invoices, setInvoices } = data
  const [filter, setFilter] = useState('all')
  const [edit, setEdit] = useState(null)
  const list = invoices.filter(i => filter === 'all' || i.sparte === filter)
    .sort((a, b) => (b.periodTo || '').localeCompare(a.periodTo || ''))

  return (
    <div>
      <PageHeader title="Rechnungen" subtitle="Jahres- und Schlussrechnungen – Grundlage für Verbrauch und Preisentwicklung">
        <button className="btn-secondary" onClick={() => onNavigate('import')}>📥 PDF importieren</button>
        <button onClick={() => setEdit(emptyInvoice(filter === 'all' ? 'strom' : filter))}>+ Rechnung</button>
      </PageHeader>
      <div style={{ marginBottom: '1rem' }}><SparteTabs value={filter} onChange={setFilter} includeAll /></div>

      {!list.length ? (
        <EmptyState icon="🧾" title="Noch keine Rechnungen" text="Lade alte Jahresabrechnungen als PDF hoch oder erfasse die Eckdaten manuell. Schon 2–3 Jahre zeigen deutlich, wie sich deine Preise entwickelt haben.">
          <button onClick={() => onNavigate('import')}>PDF importieren</button>
        </EmptyState>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Sparte</th><th>Zeitraum</th><th>Anbieter</th>
                  <th className="num">Verbrauch</th><th className="num">Kosten</th>
                  <th className="num">eff. Preis</th><th className="num">Nachz./Guthaben</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(inv => {
                  const sp = spById(inv.sparte)
                  const st = invoiceStats(inv)
                  return (
                    <tr key={inv.id}>
                      <td><SparteBadge sparte={inv.sparte} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(inv.periodFrom)} – {fmtDate(inv.periodTo)}<div className="muted small">{st.days} Tage</div></td>
                      <td>{inv.provider}<div className="muted small">{inv.tariff}</div></td>
                      <td className="num">{fmtNum(inv.consumption, 0)} {sp.unit}</td>
                      <td className="num">{fmt(inv.total)}</td>
                      <td className="num">{st.effPrice ? `${fmtNum(st.effPrice, 2)} ${sp.priceUnit}` : '–'}</td>
                      <td className="num" style={{ color: st.balance == null ? undefined : st.balance > 0 ? '#dc2626' : '#15803d' }}>
                        {st.balance == null ? '–' : `${st.balance > 0 ? 'Nachz. ' : 'Guth. '}${fmt(Math.abs(st.balance))}`}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {inv.docId && <button className="icon-btn" title="Dokument öffnen" onClick={() => openDoc(inv.docId)}>📄</button>}
                        <button className="icon-btn" title="Bearbeiten" onClick={() => setEdit(invoiceToForm(inv))}>✏️</button>
                        <button className="icon-btn" title="Löschen" onClick={() => { if (confirm('Rechnung löschen?')) data.remove(setInvoices)(inv.id) }}>🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? 'Rechnung bearbeiten' : 'Neue Rechnung'} onClose={() => setEdit(null)} maxWidth={720}>
          <InvoiceForm initial={edit} onCancel={() => setEdit(null)} onSave={inv => { data.upsert(setInvoices)(inv); setEdit(null) }} />
        </Modal>
      )}
    </div>
  )
}
