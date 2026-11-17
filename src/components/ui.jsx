import { SPARTEN, spById } from '../lib/energy'
import { SEVERITY } from '../lib/recommend'

export function Modal({ title, onClose, maxWidth = 620, children }) {
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth }}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function SparteTabs({ value, onChange, includeAll = false, only }) {
  const items = [
    ...(includeAll ? [{ id: 'all', label: 'Alle', icon: '📋', color: 'var(--color-primary)' }] : []),
    ...SPARTEN.filter(s => !only || only.includes(s.id)),
  ]
  return (
    <div className="seg">
      {items.map(s => (
        <button key={s.id} type="button" className={`seg-btn${value === s.id ? ' active' : ''}`}
          style={value === s.id ? { background: s.color, borderColor: s.color } : undefined}
          onClick={() => onChange(s.id)}>
          <span>{s.icon}</span> {s.label}
        </button>
      ))}
    </div>
  )
}

export function SparteBadge({ sparte }) {
  const sp = spById(sparte)
  return <span className="badge" style={{ background: sp.soft, color: sp.color }}>{sp.icon} {sp.label}</span>
}

export function Field({ label, hint, children, span }) {
  return (
    <label className="field" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function RecCard({ rec, onNavigate, compact }) {
  const sev = SEVERITY[rec.severity]
  const sp = spById(rec.sparte)
  return (
    <div className="rec-card" style={{ borderLeftColor: sev.color }}>
      <div className="rec-icon" style={{ background: sev.bg }}>{sev.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="rec-meta">
          <span style={{ color: sp.color }}>{sp.icon} {sp.label}</span>
          <span style={{ color: sev.color }}>· {sev.label}</span>
        </div>
        <div className="rec-title">{rec.title}</div>
        {!compact && <div className="rec-text">{rec.text}</div>}
      </div>
      {rec.action && onNavigate && (
        <button className="btn-ghost" onClick={() => onNavigate(rec.action.view)} style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>
          {rec.action.label} →
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon, title, text, children }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: '2.4rem' }}>{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export const numVal = (v) => (v === '' || v == null ? '' : v)
