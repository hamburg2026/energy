import { useRef, useState } from 'react'
import { useData } from '../lib/DataContext'
import { docPut } from '../lib/storage'
import { uid, fmtNum, fmtDate } from '../lib/fmt'
import { spById, activeContract, addMonths, addDays } from '../lib/energy'
import { PageHeader } from './ui'
import { toInput } from './TariffFields'
import { InvoiceForm, emptyInvoice } from './Invoices'
import { OfferForm, emptyOffer } from './Offers'
import { ContractForm, emptyContract } from './Contracts'

const TYPES = [
  { id: 'invoice', label: '🧾 Rechnung', hint: 'Jahres-/Schlussrechnung mit Verbrauch und Kosten' },
  { id: 'offer', label: '🏷️ Tarifangebot', hint: 'Angebot des eigenen oder eines anderen Anbieters' },
  { id: 'contract', label: '📑 Vertrag', hint: 'Vertragsbestätigung oder Preisblatt des aktuellen Vertrags' },
]

function buildForms(found, doc, contracts) {
  const sparte = found.sparte || 'strom'
  const n = (k) => toInput(found[k] ?? '')
  const docRef = { docId: doc.id, docName: doc.name }
  const c = activeContract(contracts, sparte)
  const guarantee = found.priceGuaranteeUntil
    || (found.priceGuaranteeMonths ? addDays(addMonths(new Date().toISOString().slice(0, 10), found.priceGuaranteeMonths), -1) : '')
  return {
    invoice: {
      ...emptyInvoice(sparte), ...docRef,
      provider: found.provider || c?.provider || '', tariff: found.tariff || '',
      invoiceDate: found.invoiceDate || '', periodFrom: found.periodFrom || '', periodTo: found.periodTo || '',
      consumption: n('consumption'), total: n('total'), advancesPaid: n('advancesPaid'),
      workPrice: n('workPrice'), basePrice: n('basePrice'), monthlyAdvance: n('monthlyAdvance'),
    },
    offer: {
      ...emptyOffer(sparte), ...docRef,
      provider: found.provider || '', tariff: found.tariff || '', workPrice: n('workPrice'), basePrice: n('basePrice'),
      bonus: n('bonus'), minTermMonths: toInput(found.minTermMonths ?? 12), noticeWeeks: toInput(found.noticeWeeks ?? 4),
      priceGuaranteeUntil: guarantee,
    },
    contract: {
      ...emptyContract(sparte), ...docRef,
      provider: found.provider || '', tariff: found.tariff || '', workPrice: n('workPrice'), basePrice: n('basePrice'),
      bonus: n('bonus'), minTermMonths: toInput(found.minTermMonths ?? 12), noticeWeeks: toInput(found.noticeWeeks ?? 4),
      priceGuaranteeUntil: guarantee, customerNo: found.customerNo || '', meterNo: found.meterNo || '',
      monthlyAdvance: n('monthlyAdvance'),
    },
  }
}

export default function Import({ onNavigate }) {
  const data = useData()
  const fileRef = useRef(null)
  const [queue, setQueue] = useState([])
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [done, setDone] = useState([])
  const cur = queue[0]

  async function handleFiles(files) {
    setBusy(true)
    const items = []
    for (const f of files) {
      const doc = { id: uid(), name: f.name, type: f.type, size: f.size, added: new Date().toISOString(), blob: f }
      let lines = [], found = {}, error = null
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        try {
          const { extractPdfLines, parseEnergyDoc } = await import('../lib/pdfParse')
          lines = await extractPdfLines(f)
          found = parseEnergyDoc(lines)
          if (!lines.length) error = 'Das PDF enthält keinen auslesbaren Text (vermutlich ein Scan). Bitte Werte manuell eintragen.'
        } catch (e) {
          error = 'PDF konnte nicht gelesen werden: ' + (e?.message || e)
        }
      } else {
        error = 'Kein PDF – bitte Werte manuell eintragen. Das Dokument wird trotzdem gespeichert.'
      }
      await docPut(doc)
      const type = found.periodFrom && (found.total || found.consumption) ? 'invoice'
        : /angebot|ihr tarif|tarifblatt|preisblatt/i.test(lines.join(' ')) ? 'offer' : found.periodFrom ? 'invoice' : 'offer'
      items.push({ key: doc.id, doc, lines, found, error, type, forms: buildForms(found, doc, data.contracts) })
    }
    setQueue(q => [...q, ...items])
    setBusy(false)
  }

  function finish(label) {
    setDone(d => [...d, { name: cur.doc.name, label }])
    setQueue(q => q.slice(1))
  }
  const setType = (type) => setQueue(q => [{ ...q[0], type }, ...q.slice(1)])

  const foundList = cur ? Object.entries(cur.found).filter(([k]) => !['sparte'].includes(k)) : []

  return (
    <div>
      <PageHeader title="Dokumente importieren" subtitle="Rechnungen, Preisblätter und Angebote als PDF hochladen – die Werte werden automatisch erkannt" />

      {!cur && (
        <div
          className={`dropzone${drag ? ' drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFiles([...e.dataTransfer.files]) }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ fontSize: '2.6rem' }}>{busy ? '⏳' : '📥'}</div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{busy ? 'Dokumente werden ausgelesen…' : 'PDFs hierher ziehen oder klicken'}</div>
          <div className="muted">Mehrere Dateien möglich · Alles bleibt lokal in deinem Browser</div>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }} />
        </div>
      )}

      {done.length > 0 && !cur && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 className="card-h">✅ Importiert</h3>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {done.map((d, i) => <li key={i}>{d.name} → {d.label}</li>)}
          </ul>
          <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => onNavigate('invoices')}>Zu den Rechnungen</button>
            <button className="btn-secondary" onClick={() => onNavigate('offers')}>Zum Tarifvergleich</button>
            <button onClick={() => onNavigate('dashboard')}>Zur Übersicht</button>
          </div>
        </div>
      )}

      {cur && (
        <div className="import-layout">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <div className="muted small">Dokument {done.length + 1} von {done.length + queue.length}</div>
                <div style={{ fontWeight: 700 }}>📄 {cur.doc.name}</div>
              </div>
              <button className="btn-ghost" onClick={() => finish('übersprungen (Dokument gespeichert)')}>Überspringen</button>
            </div>
            {cur.error && <div className="callout warn">{cur.error}</div>}
            <div className="seg" style={{ marginBottom: '1rem' }}>
              {TYPES.map(t => (
                <button key={t.id} type="button" title={t.hint} className={`seg-btn${cur.type === t.id ? ' active' : ''}`} onClick={() => setType(t.id)}>{t.label}</button>
              ))}
            </div>
            <div key={cur.key + cur.type}>
              {cur.type === 'invoice' && (
                <InvoiceForm initial={cur.forms.invoice} onCancel={() => finish('verworfen')}
                  onSave={inv => { data.upsert(data.setInvoices)(inv); finish(`Rechnung ${spById(inv.sparte).label} ${fmtDate(inv.periodFrom)}–${fmtDate(inv.periodTo)}`) }} />
              )}
              {cur.type === 'offer' && (
                <OfferForm initial={cur.forms.offer} onCancel={() => finish('verworfen')}
                  onSave={o => { data.upsert(data.setOffers)(o); finish(`Tarif ${o.provider} ${o.tariff || ''}`) }} />
              )}
              {cur.type === 'contract' && (
                <ContractForm initial={cur.forms.contract} onCancel={() => finish('verworfen')}
                  onSave={c => {
                    data.setContracts(list => [...list.map(x => x.sparte === c.sparte && x.active !== false && c.active !== false ? { ...x, active: false } : x), c])
                    finish(`Vertrag ${c.provider}`)
                  }} />
              )}
            </div>
          </div>
          <div className="card import-side">
            <h3 className="card-h">🔍 Erkannte Werte</h3>
            {foundList.length ? (
              <table className="mini">
                <tbody>
                  <tr><td>Sparte</td><td>{spById(cur.found.sparte).icon} {spById(cur.found.sparte).label}</td></tr>
                  {foundList.map(([k, v]) => (
                    <tr key={k}><td>{LABELS[k] || k}</td><td>{typeof v === 'number' ? fmtNum(v, v % 1 ? 2 : 0) : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : v}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">Keine Werte erkannt.</p>}
            <p className="muted small">Die Erkennung ist eine Heuristik – bitte die Werte im Formular prüfen.</p>
            {cur.lines.length > 0 && (
              <details>
                <summary>Ausgelesener Text ({cur.lines.length} Zeilen)</summary>
                <pre className="raw-text">{cur.lines.join('\n')}</pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const LABELS = {
  provider: 'Anbieter', tariff: 'Tarif', customerNo: 'Kundennummer', meterNo: 'Zählernummer',
  periodFrom: 'Zeitraum von', periodTo: 'Zeitraum bis', consumption: 'Verbrauch', workPrice: 'Arbeitspreis',
  basePrice: 'Grundpreis/Jahr', total: 'Gesamtbetrag', advancesPaid: 'Abschläge gezahlt', monthlyAdvance: 'Abschlag/Monat',
  bonus: 'Bonus', priceGuaranteeUntil: 'Preisgarantie bis', priceGuaranteeMonths: 'Preisgarantie (Monate)',
  minTermMonths: 'Mindestlaufzeit (Monate)', noticeWeeks: 'Kündigungsfrist (Wochen)', invoiceDate: 'Rechnungsdatum',
}
