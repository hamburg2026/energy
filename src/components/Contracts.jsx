import { useState } from 'react'
import { useData } from '../lib/DataContext'
import { SPARTEN, spById, annualCost, estimatedConsumption, cancellationInfo, daysUntil } from '../lib/energy'
import { fmt, fmt0, fmtNum, fmtDate, uid, todayIso, parseNum } from '../lib/fmt'
import { Modal, PageHeader, Field, SparteBadge, EmptyState } from './ui'
import TariffFields, { normalizeNumbers, toInput, TARIFF_NUM_KEYS } from './TariffFields'
import DocAttach from './DocAttach'
import { openDoc } from '../lib/storage'

const NUM_KEYS = [...TARIFF_NUM_KEYS, 'monthlyAdvance', 'expectedConsumption']

export const emptyContract = (sparte = 'strom') => ({
  id: null, sparte, provider: '', tariff: '', customerNo: '', meterNo: '', start: todayIso(),
  workPrice: '', basePrice: '', bonus: '', minTermMonths: '12', noticeWeeks: '4', priceGuaranteeUntil: '',
  monthlyAdvance: '', expectedConsumption: '', active: true, notes: '', priceHistory: [], docId: null, docName: null,
})

export function contractToForm(c) {
  const f = { ...emptyContract(c.sparte), ...c }
  NUM_KEYS.forEach(k => { f[k] = toInput(c[k]) })
  return f
}

export function ContractForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const sp = spById(form.sparte)
  function submit(e) {
    e.preventDefault()
    const c = normalizeNumbers(form, NUM_KEYS)
    c.id ||= uid()
    if (!c.priceHistory?.length && c.workPrice != null) {
      c.priceHistory = [{ date: c.start || todayIso(), workPrice: c.workPrice, basePrice: c.basePrice }]
    }
    onSave(c)
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <TariffFields form={form} set={set} />
        <Field label="Vertragsbeginn"><input type="date" value={form.start || ''} onChange={e => set('start', e.target.value)} /></Field>
        <Field label="Monatlicher Abschlag (€)"><input inputMode="decimal" value={form.monthlyAdvance} onChange={e => set('monthlyAdvance', e.target.value)} /></Field>
        <Field label="Kundennummer"><input value={form.customerNo} onChange={e => set('customerNo', e.target.value)} /></Field>
        <Field label="Zählernummer"><input value={form.meterNo} onChange={e => set('meterNo', e.target.value)} /></Field>
        <Field label={`Prognose Jahresverbrauch (${sp.unit})`} hint="optional, laut Vertrag/Abschlagsplan">
          <input inputMode="decimal" value={form.expectedConsumption} onChange={e => set('expectedConsumption', e.target.value)} />
        </Field>
        <Field label="Status">
          <select value={form.active === false ? 'ended' : 'active'} onChange={e => set('active', e.target.value === 'active')}>
            <option value="active">aktiv</option><option value="ended">beendet</option>
          </select>
        </Field>
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

function PriceChangeForm({ contract, onSave, onCancel }) {
  const sp = spById(contract.sparte)
  const [date, setDate] = useState(todayIso())
  const [work, setWork] = useState(toInput(contract.workPrice))
  const [base, setBase] = useState(toInput(contract.basePrice))
  return (
    <form onSubmit={e => {
      e.preventDefault()
      let hist = [...(contract.priceHistory || [])]
      if (!hist.length) hist.push({ date: contract.start || date, workPrice: contract.workPrice, basePrice: contract.basePrice })
      hist = hist.filter(h => h.date !== date)
      hist.push({ date, workPrice: parseNum(work), basePrice: parseNum(base) })
      hist.sort((a, b) => a.date.localeCompare(b.date))
      const latest = hist[hist.length - 1]
      onSave({ ...contract, priceHistory: hist, workPrice: latest.workPrice, basePrice: latest.basePrice })
    }}>
      <p className="muted" style={{ marginTop: 0 }}>Preisanpassung (z. B. aus einem Preisänderungsschreiben) erfassen. Sie wird in der Preisentwicklung angezeigt und löst ggf. einen Hinweis auf das Sonderkündigungsrecht aus.</p>
      <div className="form-grid">
        <Field label="Gültig ab"><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></Field>
        <div />
        <Field label={`Neuer Arbeitspreis (${sp.priceUnit})`}><input inputMode="decimal" value={work} onChange={e => setWork(e.target.value)} required /></Field>
        <Field label="Neuer Grundpreis (€/Jahr)"><input inputMode="decimal" value={base} onChange={e => setBase(e.target.value)} /></Field>
      </div>
      {(contract.priceHistory || []).length > 0 && (
        <div className="table-wrapper" style={{ marginTop: '1rem' }}>
          <table>
            <thead><tr><th>ab</th><th className="num">Arbeitspreis</th><th className="num">Grundpreis/Jahr</th></tr></thead>
            <tbody>
              {[...contract.priceHistory].sort((a, b) => b.date.localeCompare(a.date)).map(h => (
                <tr key={h.date}><td>{fmtDate(h.date)}</td><td className="num">{fmtNum(h.workPrice, sp.priceDecimals)} {sp.priceUnit}</td><td className="num">{fmt(h.basePrice)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button type="submit">Preisänderung speichern</button>
      </div>
    </form>
  )
}

export default function Contracts() {
  const data = useData()
  const { contracts, setContracts, invoices, settings } = data
  const [edit, setEdit] = useState(null)
  const [priceEdit, setPriceEdit] = useState(null)
  const [showEnded, setShowEnded] = useState(false)
  const save = data.upsert(setContracts)

  const list = contracts.filter(c => showEnded || c.active !== false)

  return (
    <div>
      <PageHeader title="Verträge" subtitle="Deine aktuellen Liefer­verträge mit Preisen, Fristen und Abschlägen">
        <label className="check"><input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} /> beendete anzeigen</label>
        <button onClick={() => setEdit(emptyContract())}>+ Vertrag</button>
      </PageHeader>

      {!list.length && (
        <EmptyState icon="📑" title="Noch keine Verträge" text="Lege für Strom, Gas und Wasser jeweils den aktuellen Vertrag an – oder importiere eine Rechnung/Vertragsbestätigung als PDF.">
          <button onClick={() => setEdit(emptyContract())}>Ersten Vertrag anlegen</button>
        </EmptyState>
      )}

      {SPARTEN.map(sp => {
        const items = list.filter(c => c.sparte === sp.id).sort((a, b) => (b.active !== false) - (a.active !== false) || (b.start || '').localeCompare(a.start || ''))
        if (!items.length) return null
        const cons = estimatedConsumption(sp.id, data)
        return (
          <section key={sp.id} style={{ marginBottom: '1.5rem' }}>
            <h2 className="section-title" style={{ color: sp.color }}>{sp.icon} {sp.label}</h2>
            <div className="card-grid">
              {items.map(c => {
                const ci = cancellationInfo(c)
                const cost = annualCost(c, cons.value)
                const g = c.priceGuaranteeUntil ? daysUntil(c.priceGuaranteeUntil) : null
                return (
                  <div key={c.id} className="card contract-card" style={{ opacity: c.active === false ? 0.6 : 1, borderTopColor: sp.color }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div className="card-title">{c.provider || '–'}</div>
                        <div className="muted">{c.tariff || 'ohne Tarifname'}{c.active === false && ' · beendet'}</div>
                      </div>
                      <SparteBadge sparte={c.sparte} />
                    </div>
                    <div className="kv-grid">
                      <div><span>Arbeitspreis</span><b>{fmtNum(c.workPrice, sp.priceDecimals)} {sp.priceUnit}</b></div>
                      <div><span>Grundpreis</span><b>{fmt(c.basePrice)}/Jahr</b></div>
                      <div><span>Abschlag</span><b>{c.monthlyAdvance ? `${fmt(c.monthlyAdvance)}/Monat` : '–'}</b></div>
                      <div><span>Kosten/Jahr*</span><b>{fmt0(cost)}</b></div>
                      <div><span>Vertragsbeginn</span><b>{fmtDate(c.start)}</b></div>
                      <div><span>Preisgarantie</span><b style={g != null && g < 90 && g >= 0 ? { color: '#b45309' } : undefined}>{c.priceGuaranteeUntil ? `bis ${fmtDate(c.priceGuaranteeUntil)}` : '–'}</b></div>
                    </div>
                    {c.active !== false && <div className="note">{ci.text}</div>}
                    {(c.customerNo || c.meterNo) && <div className="muted small">Kd.-Nr. {c.customerNo || '–'} · Zähler {c.meterNo || '–'}</div>}
                    {c.notes && <div className="muted small">{c.notes}</div>}
                    <div className="card-actions">
                      <button className="btn-ghost" onClick={() => setEdit(contractToForm(c))}>Bearbeiten</button>
                      {c.active !== false && <button className="btn-ghost" onClick={() => setPriceEdit(c)}>Preisänderung</button>}
                      {c.docId && <button className="btn-ghost" onClick={() => openDoc(c.docId)}>📄</button>}
                      <button className="btn-ghost danger" onClick={() => { if (confirm('Vertrag löschen?')) data.remove(setContracts)(c.id) }}>Löschen</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>* bei {fmtNum(cons.value, 0)} {sp.unit}/Jahr ({cons.source})</p>
          </section>
        )
      })}

      {edit && (
        <Modal title={edit.id ? 'Vertrag bearbeiten' : 'Neuer Vertrag'} onClose={() => setEdit(null)} maxWidth={720}>
          <ContractForm initial={edit} onCancel={() => setEdit(null)} onSave={c => { save(c); setEdit(null) }} />
        </Modal>
      )}
      {priceEdit && (
        <Modal title={`Preisänderung · ${priceEdit.provider}`} onClose={() => setPriceEdit(null)}>
          <PriceChangeForm contract={priceEdit} onCancel={() => setPriceEdit(null)} onSave={c => { save(c); setPriceEdit(null) }} />
        </Modal>
      )}
    </div>
  )
}
