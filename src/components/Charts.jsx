import { useState, useRef, useCallback } from 'react'

/** Misst die Breite des Containers, damit Schrift und Linien nicht mitskaliert werden. */
function useWidth(fallback = 720) {
  const [w, setW] = useState(fallback)
  const roRef = useRef(null)
  // Callback-Ref: beobachtet jeweils das aktuell gerenderte Element
  const ref = useCallback((el) => {
    roRef.current?.disconnect()
    if (!el) return
    roRef.current = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    roRef.current.observe(el)
  }, [])
  return [ref, w]
}

const PAD = { l: 56, r: 16, t: 16, b: 34 }

function niceTicks(min, max, count = 5) {
  if (min === max) { min = min * 0.9; max = max * 1.1 || 1 }
  const span = max - min
  const step0 = span / count
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || mag * 10
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6))
  return ticks
}

/**
 * Liniendiagramm. series: [{ name, color, dashed, step, points: [{ x: Number(Zeit ms oder Jahr), y, label }] }]
 */
export function LineChart({ series, height = 260, yFormat = v => v, xFormat = v => v, yZero = false }) {
  const [hover, setHover] = useState(null)
  const [ref, W] = useWidth()
  const pts = series.flatMap(s => s.points)
  if (!pts.length) return <div ref={ref}><Empty /></div>
  const H = height
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  let xMin = Math.min(...xs), xMax = Math.max(...xs)
  if (xMin === xMax) { xMin -= 1; xMax += 1 }
  const yt = niceTicks(yZero ? 0 : Math.min(...ys) * 0.95, Math.max(...ys) * 1.05)
  const yMin = yt[0], yMax = yt[yt.length - 1]
  const sx = x => PAD.l + (x - xMin) / (xMax - xMin) * (W - PAD.l - PAD.r)
  const sy = y => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
  const xTicks = niceTicks(xMin, xMax, Math.max(2, Math.floor(W / 110))).filter(t => t >= xMin && t <= xMax)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setHover(null)}>
        {yt.map(t => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--color-border)" strokeWidth="1" />
            <text x={PAD.l - 8} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-muted)">{yFormat(t)}</text>
          </g>
        ))}
        {xTicks.map(t => (
          <text key={t} x={sx(t)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">{xFormat(t)}</text>
        ))}
        {series.map(s => {
          const p = [...s.points].sort((a, b) => a.x - b.x)
          if (!p.length) return null
          let d = ''
          p.forEach((q, i) => {
            if (i === 0) d += `M${sx(q.x)},${sy(q.y)}`
            else if (s.step) d += `H${sx(q.x)}V${sy(q.y)}`
            else d += `L${sx(q.x)},${sy(q.y)}`
          })
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.5}
                strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {!s.dashed && p.map((q, i) => !q.hidden && (
                <circle key={i} cx={sx(q.x)} cy={sy(q.y)} r={hover?.p === q ? 6 : 4} fill="var(--color-surface)" stroke={s.color} strokeWidth="2.5"
                  onMouseEnter={() => setHover({ s, p: q })} style={{ cursor: 'pointer' }} />
              ))}
            </g>
          )
        })}
        {hover && (
          <g pointerEvents="none">
            <line x1={sx(hover.p.x)} x2={sx(hover.p.x)} y1={PAD.t} y2={H - PAD.b} stroke={hover.s.color} strokeOpacity="0.3" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="chart-tip" style={{
          left: `${sx(hover.p.x) / W * 100}%`, top: `${sy(hover.p.y) / H * 100}%`,
        }}>
          <strong style={{ color: hover.s.color }}>{hover.s.name}</strong>
          <div>{hover.p.label || xFormat(hover.p.x)}: {yFormat(hover.p.y)}</div>
        </div>
      )}
      <Legend items={series.map(s => ({ name: s.name, color: s.color, dashed: s.dashed }))} />
    </div>
  )
}

/** Gestapeltes Säulendiagramm. categories: [label], series: [{ name, color, values: [] }] */
export function BarChart({ categories, series, height = 260, yFormat = v => v, stacked = true }) {
  const [hover, setHover] = useState(null)
  const [ref, W] = useWidth()
  if (!categories.length) return <div ref={ref}><Empty /></div>
  const H = height
  const totals = categories.map((_, i) => stacked
    ? series.reduce((s, ser) => s + (ser.values[i] || 0), 0)
    : Math.max(0, ...series.map(ser => ser.values[i] || 0)))
  const yt = niceTicks(0, Math.max(...totals, 1))
  const yMax = yt[yt.length - 1]
  const sy = y => PAD.t + (1 - y / yMax) * (H - PAD.t - PAD.b)
  const bw = (W - PAD.l - PAD.r) / categories.length
  const barW = Math.min(56, bw * 0.62)
  const subW = stacked ? barW : barW / series.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHover(null)}>
        {yt.map(t => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--color-border)" />
            <text x={PAD.l - 8} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-muted)">{yFormat(t)}</text>
          </g>
        ))}
        {categories.map((c, i) => {
          const cx = PAD.l + bw * i + bw / 2
          let acc = 0
          return (
            <g key={c} onMouseEnter={() => setHover(i)}>
              <rect x={cx - bw / 2} y={PAD.t} width={bw} height={H - PAD.t - PAD.b} fill={hover === i ? 'rgba(0,0,0,0.035)' : 'transparent'} />
              {series.map((s, j) => {
                const v = s.values[i] || 0
                if (!v) return null
                const y0 = stacked ? acc : 0
                acc += v
                const x = stacked ? cx - barW / 2 : cx - barW / 2 + j * subW
                const isTop = stacked ? series.slice(j + 1).every(o => !o.values[i]) : true
                return (
                  <rect key={s.name} x={x + (stacked ? 0 : 1)} width={subW - (stacked ? 0 : 2)}
                    y={sy(y0 + v)} height={Math.max(0, sy(y0) - sy(y0 + v) - (stacked ? 1 : 0))}
                    rx={isTop ? 4 : 0} fill={s.color} />
                )
              })}
              {(categories.length <= W / 42 || i % 2 === 0) && <text x={cx} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">{c}</text>}
            </g>
          )
        })}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(PAD.l + bw * hover + bw / 2) / W * 100}%`, top: `${sy(totals[hover]) / H * 100}%` }}>
          <strong>{categories[hover]}</strong>
          {series.filter(s => s.values[hover]).map(s => (
            <div key={s.name}><span style={{ color: s.color }}>●</span> {s.name}: {yFormat(s.values[hover])}</div>
          ))}
          {stacked && series.length > 1 && <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 3, paddingTop: 3 }}>Summe: {yFormat(totals[hover])}</div>}
        </div>
      )}
      <Legend items={series.map(s => ({ name: s.name, color: s.color }))} />
    </div>
  )
}

function Legend({ items }) {
  if (items.length < 2) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', justifyContent: 'center', marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
      {items.map(i => (
        <span key={i.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="8"><line x1="1" x2="17" y1="4" y2="4" stroke={i.color} strokeWidth="3" strokeDasharray={i.dashed ? '4 3' : undefined} strokeLinecap="round" /></svg>
          {i.name}
        </span>
      ))}
    </div>
  )
}

function Empty() {
  return <div className="empty-hint">Noch keine Daten für dieses Diagramm.</div>
}

/** Kleine Verlaufslinie für Kennzahlkarten */
export function Sparkline({ values, color, width = 110, height = 32 }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  const sx = i => 2 + i / (values.length - 1) * (width - 4)
  const sy = v => height - 3 - (max === min ? 0.5 : (v - min) / (max - min)) * (height - 6)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(v)}`).join('')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={`${d}L${sx(values.length - 1)},${height}L${sx(0)},${height}Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
