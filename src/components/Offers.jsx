import { useState } from 'react'
import { useData } from '../lib/DataContext'
import {
  spById, annualCost, avgAnnualCost, activeContract, estimatedConsumption, cancellationInfo,
  effectiveUnitPrice, refPrice, SEARCH_LINKS,
} from '../lib/energy'
import { fmt0, fmtNum, fmtDate, uid, todayIso, parseNum } from '../lib/fmt'
import { openDoc } from '../lib/storage'
import { Modal, PageHeader, Field, SparteTabs } from './ui'
import TariffFields, { normalizeNumbers, toInput, TARIFF_NUM_KEYS } from './TariffFields'
import DocAttach from './DocAttach'

export const emptyOffer = (sparte = 'strom') => ({
  id: null, sparte, provider: '', tariff: '', workPrice: '', basePrice: '', bonus: '',
  minTermMonths: '12', noticeWeeks: '4', priceGuaranteeUntil: '', captured: todayIso(), url: '', notes: '',
  docId: null, docName: null,
})

export function offerToForm(o) {
  const f = { ...emptyOffer(o.sparte), ...o }
  TARIFF_NUM_KEYS.forEach(k => { f[k] = toInput(o[k]) })
  return f
}

export function OfferForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const o = normalizeNumbers(form, TARIFF_NUM_KEYS)
      o.id ||= uid()
      onSave(o)
    }}>
      <div className="form-grid">
        <TariffFields form={form} set={set} />
        <Field label="Angebot vom"><input type="date" value={form.captured} onChange={e => set('captured', e.target.value)} /></Field>
        <Field label="Link (optional)"><input type="url" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://…" /></Field>
        <Field label="Notizen" span={2}><textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="z. B. Ökostrom, Bewertung, Zahlungsbedingungen" /></Field>
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

export default function Offers({ onNavigate }) {
  const data = useData()
  const { offers, setOffers, contracts, setContracts, settings } = data
  const [sparte, setSparte] = useState('strom')
  const [edit, setEdit] = useState(null)
  const sp = spById(sparte)
  const est = estimatedConsumption(sparte, data)
  const [consInput, setConsInput] = useState({})
  const cons = parseNum(consInput[sparte]) || est.value
  const current = activeContract(contracts, sparte)
  const year = new Date().getFullYear()
  const ref = refPrice(settings, sparte, year)

  const rows = [
    ...(current ? [{ kind: 'current', item: current }] : []),
    ...offers.filter(o => o.sparte === sparte).map(o => ({ kind: 'offer', item: o })),
  ].map(r => ({
    ...r,
    first: annualCost(r.item, cons, { firstYear: r.kind === 'offer' }),
    follow: annualCost(r.item, cons),
    avg: r.kind === 'offer' ? avgAnnualCost(r.item, cons) : annualCost(r.item, cons),
    eff: effectiveUnitPrice(r.item, cons),
  })).sort((a, b) => a.avg - b.avg)
  const curCost = current ? annualCost(current, cons) : null
  const bestAvg = rows.length ? rows[0].avg : null

  function switchTo(o) {
    if (!confirm(`Tarif „${o.tariff || o.provider}“ als neuen aktiven Vertrag übernehmen? Der bisherige Vertrag wird als beendet markiert.`)) return
    const start = prompt('Lieferbeginn des neuen Vertrags (TT.MM.JJJJ):', fmtDate(todayIso()))
    if (!start) return
    const [d, m, y] = start.split('.')
    const startIso = `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`
    const nc = {
      id: uid(), sparte: o.sparte, provider: o.provider, tariff: o.tariff, start: startIso,
      workPrice: o.workPrice, basePrice: o.basePrice, bonus: o.bonus, minTermMonths: o.minTermMonths,
      noticeWeeks: o.noticeWeeks, priceGuaranteeUntil: o.priceGuaranteeUntil, monthlyAdvance: null,
      active: true, notes: o.notes, docId: o.docId, docName: o.docName,
      priceHistory: [{ date: startIso, workPrice: o.workPrice, basePrice: o.basePrice }],
    }
    setContracts(list => [...list.map(c => c.sparte === o.sparte && c.active !== false ? { ...c, active: false } : c), nc])
    setOffers(list => list.filter(x => x.id !== o.id))
    onNavigate('contracts')
  }

  return (
    <div>
      <PageHeader title="Tarifvergleich" subtitle="Aktuellen Vertrag mit Angeboten des eigenen und anderer Anbieter vergleichen">
        <button className="btn-secondary" onClick={() => onNavigate('import')}>📥 Tarifblatt importieren</button>
        <button onClick={() => setEdit(emptyOffer(sparte))}>+ Tarif erfassen</button>
      </PageHeader>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <SparteTabs value={sparte} onChange={setSparte} />
        <label className="inline-field">
          Jahresverbrauch
          <input inputMode="decimal" style={{ width: 110 }} value={consInput[sparte] ?? String(est.value)}
            onChange={e => setConsInput(s => ({ ...s, [sparte]: e.target.value }))} />
          {sp.unit}
          <span className="muted small">({consInput[sparte] ? 'manuell' : est.source})</span>
        </label>
      </div>

      {!sp.switchable && (
        <div className="callout">
          💧 Wasser wird vom örtlichen Versorger geliefert – ein Anbieterwechsel ist in Deutschland nicht möglich.
          Hier kannst du trotzdem Preise dokumentieren; Sparpotenzial liegt vor allem im Verbrauch.
        </div>
      )}

      <div className="card" style={{ padding: 0, marginBottom: '1.25rem' }}>
        {!rows.length ? (
          <div className="empty-hint">Noch kein Vertrag und keine Vergleichstarife für {sp.label} erfasst.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Anbieter / Tarif</th><th className="num">Arbeitspreis</th><th className="num">Grundpreis</th>
                  <th className="num">1. Jahr</th><th className="num">Folgejahre</th><th className="num">Ø Laufzeit</th>
                  <th className="num">Ersparnis/Jahr</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const o = r.item
                  const saving = curCost != null && r.kind === 'offer' ? curCost - r.avg : null
                  const best = r.avg === bestAvg && rows.length > 1
                  return (
                    <tr key={o.id} className={r.kind === 'current' ? 'row-current' : undefined}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {o.provider} {r.kind === 'current' && <span className="pill">aktuell</span>} {best && <span className="pill pill-green">günstigster</span>}
                        </div>
                        <div className="muted small">
                          {o.tariff}
                          {o.minTermMonths ? ` · ${o.minTermMonths} Mon. Laufzeit` : ''}
                          {o.priceGuaranteeUntil ? ` · Preisgarantie bis ${fmtDate(o.priceGuaranteeUntil)}` : ''}
                          {r.kind === 'offer' && current && o.provider?.toLowerCase() === current.provider?.toLowerCase() ? ' · gleicher Anbieter' : ''}
                        </div>
                      </td>
                      <td className="num">{fmtNum(o.workPrice, sp.priceDecimals)} {sp.priceUnit}<div className="muted small">eff. {fmtNum(r.eff, 2)}</div></td>
                      <td className="num">{fmt0(o.basePrice)}</td>
                      <td className="num">{fmt0(r.first)}{Number(o.bonus) > 0 && r.kind === 'offer' && <div className="muted small">inkl. {fmt0(o.bonus)} Bonus</div>}</td>
                      <td className="num">{fmt0(r.follow)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{fmt0(r.avg)}</td>
                      <td className="num" style={{ fontWeight: 600, color: saving == null ? undefined : saving > 0 ? '#15803d' : '#dc2626' }}>
                        {saving == null ? '–' : `${saving > 0 ? '+' : '−'}${fmt0(Math.abs(saving))}`}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {r.kind === 'offer' && (
                          <>
                            {o.url && <a className="icon-btn" href={o.url} target="_blank" rel="noreferrer" title="Link öffnen">🔗</a>}
                            {o.docId && <button className="icon-btn" title="Dokument" onClick={() => openDoc(o.docId)}>📄</button>}
                            <button className="icon-btn" title="Bearbeiten" onClick={() => setEdit(offerToForm(o))}>✏️</button>
                            <button className="icon-btn" title="Löschen" onClick={() => { if (confirm('Tarif löschen?')) data.remove(setOffers)(o.id) }}>🗑</button>
                            {sp.switchable && <button className="btn-ghost" onClick={() => switchTo(o)}>Wechseln</button>}
                          </>
                        )}
                        {r.kind === 'current' && <button className="btn-ghost" onClick={() => onNavigate('contracts')}>Vertrag</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <h3 className="card-h">📊 Einordnung</h3>
          {current ? (
            <>
              <p style={{ margin: '0 0 0.5rem' }}>
                Dein aktueller Tarif kostet bei {fmtNum(cons, 0)} {sp.unit} ca. <b>{fmt0(curCost)}</b> pro Jahr,
                effektiv <b>{fmtNum(effectiveUnitPrice(current, cons), 2)} {sp.priceUnit}</b>.
              </p>
              {ref && <p className="muted" style={{ margin: '0 0 0.5rem' }}>Richtwert Durchschnittspreis {year}: ca. {fmtNum(ref, 2)} {sp.priceUnit} (inkl. Grundpreis).</p>}
              <p className="muted" style={{ margin: 0 }}>{cancellationInfo(current).text}</p>
            </>
          ) : <p className="muted">Kein aktiver Vertrag erfasst.</p>}
        </div>
        <div className="card">
          <h3 className="card-h">🔎 Nach Alternativen suchen</h3>
          {sp.switchable ? (
            <>
              <ol className="steps">
                <li><b>Beim eigenen Anbieter</b>{current ? ` (${current.provider})` : ''} nach aktuellen Tarifen fragen – Bestandskunden zahlen oft mehr als Neukunden.</li>
                <li><b>Vergleichsportale</b> nutzen{settings.plz ? ` mit PLZ ${settings.plz}` : ''} und {fmtNum(cons, 0)} {sp.unit}. Filter: Preisgarantie ≥ 12 Monate, keine Vorauskasse, keine Kaution.</li>
                <li>Gefundene Tarife hier <b>erfassen oder als PDF importieren</b> – die App rechnet Bonus, Grundpreis und Laufzeit gegen.</li>
              </ol>
              <div className="link-list">
                {SEARCH_LINKS[sparte].map(l => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}
              </div>
            </>
          ) : (
            <div className="link-list">
              {SEARCH_LINKS.wasser.map(l => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}
            </div>
          )}
        </div>
      </div>

      {edit && (
        <Modal title={edit.id ? 'Tarif bearbeiten' : 'Tarif erfassen'} onClose={() => setEdit(null)} maxWidth={720}>
          <OfferForm initial={edit} onCancel={() => setEdit(null)} onSave={o => { data.upsert(setOffers)(o); setSparte(o.sparte); setEdit(null) }} />
        </Modal>
      )}
    </div>
  )
}
