import { useState, useEffect, Component } from 'react'
import { DataProvider, useData } from './lib/DataContext'
import { THEMES, applyTheme, loadTheme } from './theme'
import Dashboard from './components/Dashboard'
import Recommendations from './components/Recommendations'
import PriceHistory from './components/PriceHistory'
import Contracts from './components/Contracts'
import Invoices from './components/Invoices'
import Offers from './components/Offers'
import Import from './components/Import'
import Settings from './components/Settings'
import DataBackup from './components/DataBackup'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="module" style={{ maxWidth: 640, margin: '3rem auto' }}>
        <h2 style={{ color: '#dc2626' }}>⚠️ Anwendungsfehler</h2>
        <pre className="raw-text">{String(this.state.error?.message || this.state.error)}{'\n\n'}{this.state.error?.stack}</pre>
        <button onClick={() => this.setState({ error: null })}>Neu versuchen</button>
      </div>
    )
  }
}

const NAV_GROUPS = [
  {
    label: 'Überblick',
    items: [
      { id: 'dashboard',       label: 'Übersicht',         icon: '📊', component: Dashboard },
      { id: 'recommendations', label: 'Empfehlungen',      icon: '💡', component: Recommendations, badge: true },
      { id: 'history',         label: 'Preisentwicklung',  icon: '📈', component: PriceHistory },
    ],
  },
  {
    label: 'Daten',
    items: [
      { id: 'contracts', label: 'Verträge',       icon: '📑', component: Contracts },
      { id: 'invoices',  label: 'Rechnungen',     icon: '🧾', component: Invoices },
      { id: 'offers',    label: 'Tarifvergleich', icon: '🏷️', component: Offers },
      { id: 'import',    label: 'PDF-Import',     icon: '📥', component: Import },
    ],
  },
]
const FOOTER_ITEMS = [
  { id: 'settings',   label: 'Einstellungen',  icon: '⚙️', component: Settings },
  { id: 'dataBackup', label: 'Datensicherung', icon: '💾', component: DataBackup },
]
const ALL_ITEMS = [...NAV_GROUPS.flatMap(g => g.items), ...FOOTER_ITEMS]

// ── PIN-Sperre (wie in der Finanz-App) ─────────────────────────────────
const PIN_KEY = 'energy_pin_hash' // eigener Schlüssel: alle Apps unter hamburg2026.github.io teilen sich den Speicher
async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin + '::energy::2026'))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function PinScreen({ onUnlocked }) {
  const hasPin = !!localStorage.getItem(PIN_KEY)
  const [step, setStep] = useState(hasPin ? 'enter' : 'set1')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (step === 'enter') {
      if (await hashPin(pin1) === localStorage.getItem(PIN_KEY)) { sessionStorage.setItem('energy_pin_ok', '1'); onUnlocked() }
      else { setError('Falscher PIN.'); setPin1('') }
      return
    }
    if (pin1.length < 4) { setError('Mindestens 4 Stellen.'); return }
    if (step === 'set1') { setStep('set2'); setError(''); return }
    if (pin1 !== pin2) { setError('PINs stimmen nicht überein.'); setPin2(''); return }
    localStorage.setItem(PIN_KEY, await hashPin(pin1))
    sessionStorage.setItem('energy_pin_ok', '1')
    onUnlocked()
  }
  const val = step === 'set2' ? pin2 : pin1
  return (
    <div className="pin-screen">
      <form className="pin-card" onSubmit={submit}>
        <div className="pin-logo">⚡</div>
        <h2>Energiekosten</h2>
        <p className="muted">{step === 'enter' ? 'PIN eingeben' : step === 'set1' ? 'Wähle einen PIN (mind. 4 Stellen)' : 'PIN wiederholen'}</p>
        <input type="password" inputMode="numeric" pattern="[0-9]*" autoFocus value={val} placeholder="••••"
          onChange={e => { (step === 'set2' ? setPin2 : setPin1)(e.target.value); setError('') }} />
        {error && <p className="pin-error">{error}</p>}
        <button type="submit">{step === 'enter' ? 'Entsperren' : step === 'set1' ? 'Weiter' : 'PIN speichern'}</button>
        {step === 'set1' && (
          <button type="button" className="btn-link" onClick={() => { sessionStorage.setItem('energy_pin_ok', '1'); onUnlocked() }}>Ohne PIN fortfahren</button>
        )}
      </form>
    </div>
  )
}

function Shell() {
  const { recommendations } = useData()
  const getView = () => {
    const h = window.location.hash.replace('#', '')
    return ALL_ITEMS.some(i => i.id === h) ? h : 'dashboard'
  }
  const [view, setView] = useState(getView)
  const [theme, setTheme] = useState(() => loadTheme())
  useEffect(() => {
    const onHash = () => setView(getView())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = (id) => {
    if (id === view) return
    window.location.hash = id
    document.querySelector('.content-area')?.scrollTo(0, 0)
  }
  const Current = (ALL_ITEMS.find(i => i.id === view) || ALL_ITEMS[0]).component
  const actionable = recommendations.filter(r => r.severity === 'saving' || r.severity === 'warning').length

  const navBtn = (item) => (
    <button key={item.id} className={`nav-item${view === item.id ? ' active' : ''}`} onClick={() => navigate(item.id)}
      aria-current={view === item.id ? 'page' : undefined}>
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
      {item.badge && actionable > 0 && <span className="nav-badge">{actionable}</span>}
    </button>
  )

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-mark">⚡</div>
          <div>
            <h1 className="sidebar-title">Energiekosten</h1>
            <p className="sidebar-subtitle">Strom · Gas · Wasser</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map(g => (
            <div key={g.label} className="nav-group">
              <div className="nav-group-label">{g.label}</div>
              {g.items.map(navBtn)}
            </div>
          ))}
          <div className="nav-group nav-footer-group">
            <div className="nav-group-label">System</div>
            {FOOTER_ITEMS.map(navBtn)}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-theme-picker">
            <span className="sidebar-theme-label">Farbe</span>
            {THEMES.map(t => (
              <button key={t.id} title={t.label} className={`theme-dot${theme === t.id ? ' active' : ''}`} style={{ background: t.primary }}
                onClick={() => { applyTheme(t.id); setTheme(t.id) }} />
            ))}
          </div>
          {localStorage.getItem(PIN_KEY) && (
            <button className="print-btn" onClick={() => { sessionStorage.removeItem('energy_pin_ok'); window.location.reload() }}>
              <span className="nav-icon">🔒</span> Sperren
            </button>
          )}
        </div>
      </aside>
      <main className="main-content">
        <div className="content-area">
          <div className="content-inner">
            <ErrorBoundary key={view}>
              <Current onNavigate={navigate} />
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() =>
    sessionStorage.getItem('energy_pin_ok') === '1' || (!localStorage.getItem(PIN_KEY) && localStorage.getItem('energy_pin_skipped') === '1'))
  if (!unlocked) {
    return <PinScreen onUnlocked={() => { if (!localStorage.getItem(PIN_KEY)) localStorage.setItem('energy_pin_skipped', '1'); setUnlocked(true) }} />
  }
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}
