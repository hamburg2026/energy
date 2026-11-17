export const fmt = (n) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)

export const fmt0 = (n) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export const fmtNum = (n, decimals = 2) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n || 0)

export const fmtDate = (iso) => {
  if (!iso) return '–'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

export const fmtPct = (n, decimals = 1) =>
  `${n > 0 ? '+' : ''}${fmtNum(n, decimals)} %`

/** Parst deutsche Zahlen: "1.234,56" → 1234.56, "0,3245" → 0.3245, auch "12.5" */
export function parseNum(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  let s = String(v).trim().replace(/\s/g, '').replace(/[€%]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '') // deutsche Tausenderpunkte: 2.720
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const todayIso = () => new Date().toISOString().slice(0, 10)
