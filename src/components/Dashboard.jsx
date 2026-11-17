import { useData } from '../lib/DataContext'
import {
  SPARTEN, annualCost, activeContract, estimatedConsumption, effectiveUnitPrice, refPrice,
  yearlyTotals, cancellationInfo, daysUntil,
} from '../lib/energy'
import { fmt0, fmtNum, fmtDate } from '../lib/fmt'
import { buildDemoData } from '../lib/demo'
import { BarChart, Sparkline } from './Charts'
import { PageHeader, RecCard, EmptyState } from './ui'

export function loadDemo(data) {
  const d = buildDemoData()
  data.setContracts(d.contracts)
  data.setInvoices(d.invoices)
  data.setOffers(d.offers)
  data.setSettings(s => ({ ...s, ...d.settings }))
}

export default function Dashboard({ onNavigate }) {
  const data = useData()
  const { contracts, invoices, offers, settings, recommendations } = data
  const year = new Date().getFullYear()
  const empty = !contracts.length && !invoices.length && !offers.length

  if (empty) {
    return (
      <div>
        <PageHeader title="Willkommen 👋" subtitle="Deine Energiekosten für Strom, Gas und Wasser im Überblick" />
        <div className="onboarding">
          {[
            { n: 1, icon: '🧾', t: 'Alte Rechnungen hochladen', d: 'Jahresabrechnungen der letzten Jahre als PDF – Verbrauch, Kosten und Preise werden erkannt.', v: 'import' },
            { n: 2, icon: '📑', t: 'Aktuelle Verträge erfassen', d: 'Arbeits- & Grundpreis, Abschlag, Laufzeit und Preisgarantie für jede Sparte.', v: 'contracts' },
            { n: 3, icon: '🏷️', t: 'Tarife vergleichen', d: 'Angebote des eigenen oder anderer Anbieter erfassen – die App rechnet und empfiehlt.', v: 'offers' },
          ].map(s => (
            <button key={s.n} className="onboard-card" onClick={() => onNavigate(s.v)}>
              <span className="onboard-n">{s.n}</span>
              <span style={{ fontSize: '1.8rem' }}>{s.icon}</span>
              <b>{s.t}</b>
              <span className="muted">{s.d}</span>
            </button>
          ))}
        </div>
        <EmptyState icon="🧪" title="Erst mal ausprobieren?" text="Lade Beispieldaten mit fiktiven Anbietern, um alle Funktionen zu sehen. Du kannst sie in den Einstellungen wieder löschen.">
          <button onClick={() => loadDemo(data)}>Beispieldaten laden</button>
        </EmptyState>
      </div>
    )
  }

  const perSparte = SPARTEN.map(sp => {
    const c = activeContract(contracts, sp.id)
    const cons = estimatedConsumption(sp.id, data)
    const yt = yearlyTotals(invoices, sp.id)
    const ys = Object.keys(yt).map(Number).sort()
    const fullYears = ys.filter(y => yt[y].days >= 330)
    const effSeries = fullYears.map(y => yt[y].consumption ? yt[y].cost / yt[y].consumption / sp.toEur : null).filter(Boolean)
    const cost = c ? annualCost(c, cons.value) : (fullYears.length ? yt[fullYears[fullYears.length - 1]].cost : null)
    const eff = c ? effectiveUnitPrice(c, cons.value) : effSeries[effSeries.length - 1]
    const ref = refPrice(settings, sp.id, year)
    return { sp, c, cons, yt, cost, eff, ref, effSeries, ci: c && cancellationInfo(c) }
  })
  const totalCost = perSparte.reduce((s, x) => s + (x.cost || 0), 0)
  const totalAdvance = perSparte.reduce((s, x) => s + (Number(x.c?.monthlyAdvance) || 0), 0)
  const savings = recommendations.filter(r => r.severity === 'saving').reduce((s, r) => s + (r.saving || 0), 0)
  const urgent = recommendations.filter(r => r.severity === 'warning').length

  const allYears = [...new Set(perSparte.flatMap(x => Object.keys(x.yt).map(Number)))].sort()
  const chartYears = allYears.filter(y => y < year || perSparte.some(x => x.yt[y]?.days >= 330)).slice(-8)

  const deadlines = perSparte.flatMap(x => {
    const out = []
    if (x.ci?.deadline && daysUntil(x.ci.deadline) >= 0) out.push({ sp: x.sp, date: x.ci.deadline, label: 'Kündigungsfrist' })
    if (x.c?.priceGuaranteeUntil && daysUntil(x.c.priceGuaranteeUntil) >= 0) out.push({ sp: x.sp, date: x.c.priceGuaranteeUntil, label: 'Ende Preisgarantie' })
    return out
  }).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      <PageHeader title="Übersicht" subtitle={`Stand ${new Date().toLocaleDateString('de-DE')} · hochgerechnet auf ein Jahr`} />

      <div className="hero">
        <div className="hero-main">
          <div className="hero-label">Energiekosten pro Jahr</div>
          <div className="hero-value">{fmt0(totalCost)}</div>
          <div className="hero-sub">≈ {fmt0(totalCost / 12)} pro Monat · Abschläge {fmt0(totalAdvance)}/Monat</div>
        </div>
        <div className="hero-stats">
          <button className="hero-stat" onClick={() => onNavigate('recommendations')}>
            <span className="hero-stat-v">{savings > 0 ? fmt0(savings) : '–'}</span>
            <span className="hero-stat-l">Sparpotenzial / Jahr</span>
          </button>
          <button className="hero-stat" onClick={() => onNavigate('recommendations')}>
            <span className="hero-stat-v">{urgent}</span>
            <span className="hero-stat-l">Handlungsbedarf</span>
          </button>
        </div>
      </div>

      <div className="sparte-grid">
        {perSparte.map(({ sp, c, cons, cost, eff, ref, effSeries }) => {
          const diff = eff && ref ? (eff - ref) / ref * 100 : null
          return (
            <div key={sp.id} className="sparte-card" style={{ '--sp': sp.color, '--sp-soft': sp.soft }}>
              <div className="sparte-head">
                <span className="sparte-icon">{sp.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sparte-name">{sp.label}</div>
                  <div className="muted small ellipsis">{c ? `${c.provider}${c.tariff ? ' · ' + c.tariff : ''}` : 'kein aktiver Vertrag'}</div>
                </div>
                <Sparkline values={effSeries} color={sp.color} />
              </div>
              <div className="sparte-value">{cost != null ? fmt0(cost) : '–'}<span> / Jahr</span></div>
              <div className="sparte-kv">
                <div><span>Verbrauch</span><b>{fmtNum(cons.value, 0)} {sp.unit}</b></div>
                <div><span>Effektivpreis</span><b>{eff ? `${fmtNum(eff, 2)} ${sp.priceUnit}` : '–'}</b></div>
                <div><span>vs. Ø {year}</span>
                  <b style={{ color: diff == null ? undefined : diff > 5 ? '#dc2626' : diff < -5 ? '#15803d' : undefined }}>
                    {diff == null ? '–' : `${diff > 0 ? '+' : ''}${fmtNum(diff, 0)} %`}
                  </b>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="two-col wide-left">
        <div className="card">
          <div className="card-h-row">
            <h3 className="card-h">Kosten pro Jahr laut Rechnungen</h3>
            <button className="btn-link" onClick={() => onNavigate('history')}>Preisentwicklung →</button>
          </div>
          <BarChart
            categories={chartYears.map(String)}
            series={perSparte.map(x => ({ name: x.sp.label, color: x.sp.color, values: chartYears.map(y => Math.round(x.yt[y]?.cost || 0)) }))}
            yFormat={v => fmt0(v)}
          />
        </div>
        <div className="card">
          <h3 className="card-h">📅 Nächste Fristen</h3>
          {deadlines.length ? (
            <ul className="deadline-list">
              {deadlines.map((d, i) => {
                const n = daysUntil(d.date)
                return (
                  <li key={i}>
                    <span className="dl-date" style={{ background: d.sp.soft, color: d.sp.color }}>
                      <b>{fmtDate(d.date).slice(0, 6)}</b><small>{d.date.slice(0, 4)}</small>
                    </span>
                    <span style={{ flex: 1 }}>{d.sp.icon} {d.label}<div className="muted small">in {n} Tagen</div></span>
                  </li>
                )
              })}
            </ul>
          ) : <p className="muted">Keine anstehenden Fristen. Erstlaufzeiten sind abgelaufen – Verträge sind monatlich kündbar.</p>}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-h-row">
          <h3 className="card-h">💡 Wichtigste Empfehlungen</h3>
          <button className="btn-link" onClick={() => onNavigate('recommendations')}>Alle {recommendations.length} anzeigen →</button>
        </div>
        <div className="rec-list">
          {recommendations.filter(r => r.severity !== 'ok').slice(0, 4).map((r, i) => <RecCard key={i} rec={r} onNavigate={onNavigate} />)}
          {!recommendations.some(r => r.severity !== 'ok') && <p className="muted">Alles im grünen Bereich – keine offenen Empfehlungen.</p>}
        </div>
      </div>
    </div>
  )
}
