import { useState } from 'react'
import { useData } from '../lib/DataContext'
import { spById, yearlyTotals, refPrice, sortInvoices, invoiceStats } from '../lib/energy'
import { fmt0, fmtNum, fmtPct } from '../lib/fmt'
import { LineChart, BarChart } from './Charts'
import { PageHeader, SparteTabs } from './ui'

const toYearFrac = (iso) => {
  const d = new Date(iso)
  const y = d.getFullYear()
  return y + (d - new Date(`${y}-01-01`)) / (365.25 * 86400000)
}

export default function PriceHistory() {
  const data = useData()
  const { contracts, invoices, settings } = data
  const [sparte, setSparte] = useState('strom')
  const sp = spById(sparte)
  const year = new Date().getFullYear()

  const yt = yearlyTotals(invoices, sparte)
  const years = Object.keys(yt).map(Number).sort()
  const rows = years.map((y, i) => {
    const t = yt[y]
    const eff = t.consumption ? t.cost / t.consumption / sp.toEur : null
    const prev = i > 0 ? yt[years[i - 1]] : null
    const prevEff = prev?.consumption ? prev.cost / prev.consumption / sp.toEur : null
    return { y, ...t, eff, partial: t.days < 330, dEff: eff && prevEff ? (eff - prevEff) / prevEff * 100 : null, dCost: prev ? (t.cost - prev.cost) / prev.cost * 100 : null, ref: refPrice(settings, sparte, y) }
  })

  // Preispunkte
  const work = contracts.filter(c => c.sparte === sparte).flatMap(c =>
    (c.priceHistory?.length ? c.priceHistory : [{ date: c.start, workPrice: c.workPrice }])
      .filter(h => h.date && h.workPrice != null)
      .map(h => ({ x: toYearFrac(h.date), y: Number(h.workPrice), label: `${h.date.split('-').reverse().join('.')} · ${c.provider}` })))
  // aktueller Punkt bis heute verlängern
  const workSorted = work.sort((a, b) => a.x - b.x)
  if (workSorted.length) workSorted.push({ ...workSorted[workSorted.length - 1], x: toYearFrac(new Date().toISOString()), label: 'heute', hidden: true })
  const invPts = sortInvoices(invoices.filter(i => i.sparte === sparte)).map(i => {
    const st = invoiceStats(i)
    return st.effPrice && i.periodFrom ? { x: (toYearFrac(i.periodFrom) + toYearFrac(i.periodTo)) / 2, y: st.effPrice, label: `${i.periodFrom.slice(0, 4)}/${i.periodTo.slice(2, 4)} · ${i.provider}` } : null
  }).filter(Boolean)
  const allX = [...workSorted, ...invPts].map(p => p.x)
  const minY = allX.length ? Math.floor(Math.min(...allX)) : year - 5
  const refPts = []
  for (let y = minY; y <= year; y++) {
    const v = refPrice(settings, sparte, y)
    if (v != null) refPts.push({ x: y + 0.5, y: v, label: `Ø ${y}` })
  }

  const series = [
    { name: `Arbeitspreis Vertrag (${sp.priceUnit})`, color: sp.color, step: true, points: workSorted },
    { name: 'Effektivpreis laut Rechnung (inkl. Grundpreis)', color: '#6366f1', points: invPts },
    { name: 'Ø Deutschland (Richtwert)', color: '#94a3b8', dashed: true, points: refPts },
  ].filter(s => s.points.length)

  const first = rows.find(r => !r.partial && r.eff), last = [...rows].reverse().find(r => !r.partial && r.eff)

  return (
    <div>
      <PageHeader title="Preisentwicklung" subtitle="Wie haben sich deine Preise, Kosten und Verbräuche über die Jahre entwickelt?" />
      <div style={{ marginBottom: '1rem' }}><SparteTabs value={sparte} onChange={setSparte} /></div>

      {first && last && first !== last && (
        <div className="stat-row">
          <div className="stat"><span>Effektivpreis {first.y}</span><b>{fmtNum(first.eff, 2)} {sp.priceUnit}</b></div>
          <div className="stat"><span>Effektivpreis {last.y}</span><b>{fmtNum(last.eff, 2)} {sp.priceUnit}</b></div>
          <div className="stat"><span>Veränderung</span><b style={{ color: last.eff > first.eff ? '#dc2626' : '#15803d' }}>{fmtPct((last.eff - first.eff) / first.eff * 100, 0)}</b></div>
          <div className="stat"><span>Kosten {first.y} → {last.y}</span><b>{fmt0(first.cost)} → {fmt0(last.cost)}</b></div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="card-h">Preisverlauf · {sp.icon} {sp.label}</h3>
        <LineChart series={series} yFormat={v => `${fmtNum(v, sp.id === 'wasser' ? 2 : 1)}`} xFormat={v => String(Math.round(v))} />
        <p className="muted small" style={{ margin: '0.5rem 0 0' }}>Werte in {sp.priceUnit}, brutto. Richtwerte sind ungefähre Bundesdurchschnitte und in den Einstellungen anpassbar.</p>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 className="card-h">Kosten pro Jahr</h3>
          <BarChart categories={rows.map(r => String(r.y))} series={[{ name: 'Kosten', color: sp.color, values: rows.map(r => Math.round(r.cost)) }]} yFormat={v => fmt0(v)} height={220} />
        </div>
        <div className="card">
          <h3 className="card-h">Verbrauch pro Jahr ({sp.unit})</h3>
          <BarChart categories={rows.map(r => String(r.y))} series={[{ name: 'Verbrauch', color: '#64748b', values: rows.map(r => Math.round(r.consumption)) }]} yFormat={v => fmtNum(v, 0)} height={220} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginTop: '1.25rem' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Jahr</th><th className="num">Verbrauch</th><th className="num">Kosten</th><th className="num">Δ Kosten</th><th className="num">Effektivpreis</th><th className="num">Δ Preis</th><th className="num">Ø Deutschland</th></tr>
            </thead>
            <tbody>
              {[...rows].reverse().map(r => (
                <tr key={r.y}>
                  <td>{r.y}{r.partial && <span className="muted small"> (Teiljahr, {r.days} T.)</span>}</td>
                  <td className="num">{fmtNum(r.consumption, 0)} {sp.unit}</td>
                  <td className="num">{fmt0(r.cost)}</td>
                  <td className="num">{r.dCost != null && !r.partial ? <Delta v={r.dCost} /> : '–'}</td>
                  <td className="num">{r.eff ? `${fmtNum(r.eff, 2)} ${sp.priceUnit}` : '–'}</td>
                  <td className="num">{r.dEff != null ? <Delta v={r.dEff} /> : '–'}</td>
                  <td className="num muted">{r.ref != null ? fmtNum(r.ref, 2) : '–'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="empty-hint">Noch keine Rechnungen für {sp.label}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const Delta = ({ v }) => <span style={{ color: v > 0 ? '#dc2626' : '#15803d' }}>{fmtPct(v, 1)}</span>
