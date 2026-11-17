import { useState } from 'react'
import { useData } from '../lib/DataContext'
import { SEVERITY } from '../lib/recommend'
import { fmt0 } from '../lib/fmt'
import { PageHeader, RecCard, SparteTabs, EmptyState } from './ui'

export default function Recommendations({ onNavigate }) {
  const { recommendations } = useData()
  const [sparte, setSparte] = useState('all')
  const list = recommendations.filter(r => sparte === 'all' || r.sparte === sparte)
  const saving = list.filter(r => r.severity === 'saving').reduce((s, r) => s + (r.saving || 0), 0)

  return (
    <div>
      <PageHeader title="Empfehlungen" subtitle="Automatisch aus Verträgen, Rechnungen und erfassten Tarifen abgeleitet" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <SparteTabs value={sparte} onChange={setSparte} includeAll />
        {saving > 0 && <span className="pill pill-green" style={{ fontSize: '0.85rem' }}>💶 bis zu {fmt0(saving)} pro Jahr sparen</span>}
      </div>
      {!list.length ? (
        <EmptyState icon="💡" title="Noch keine Empfehlungen" text="Erfasse Verträge, Rechnungen und Vergleichstarife – dann erscheinen hier konkrete Hinweise." />
      ) : (
        Object.keys(SEVERITY).map(sev => {
          const items = list.filter(r => r.severity === sev)
          if (!items.length) return null
          return (
            <section key={sev} style={{ marginBottom: '1.25rem' }}>
              <h2 className="section-title" style={{ color: SEVERITY[sev].color }}>{SEVERITY[sev].icon} {SEVERITY[sev].label} ({items.length})</h2>
              <div className="rec-list">{items.map((r, i) => <RecCard key={i} rec={r} onNavigate={onNavigate} />)}</div>
            </section>
          )
        })
      )}
      <p className="muted small">Hinweis: Die Empfehlungen basieren auf deinen Eingaben und allgemeinen Regeln (z. B. Kündigungsfristen nach dem Gesetz für faire Verbraucherverträge). Sie ersetzen keine Prüfung der konkreten Vertragsbedingungen.</p>
    </div>
  )
}
