// ── Sparten (Strom, Gas, Wasser) und Rechenlogik ────────────────────────

export const SPARTEN = [
  {
    id: 'strom', label: 'Strom', icon: '⚡', color: '#f59e0b', soft: '#fef3c7',
    unit: 'kWh', priceUnit: 'ct/kWh', toEur: 0.01, priceDecimals: 2,
    switchable: true, defaultConsumption: 2500,
  },
  {
    id: 'gas', label: 'Gas', icon: '🔥', color: '#ea580c', soft: '#ffedd5',
    unit: 'kWh', priceUnit: 'ct/kWh', toEur: 0.01, priceDecimals: 2,
    switchable: true, defaultConsumption: 12000,
  },
  {
    id: 'wasser', label: 'Wasser', icon: '💧', color: '#0284c7', soft: '#e0f2fe',
    unit: 'm³', priceUnit: '€/m³', toEur: 1, priceDecimals: 2,
    switchable: false, defaultConsumption: 90,
  },
]

export const spById = (id) => SPARTEN.find(s => s.id === id) || SPARTEN[0]

/**
 * Ungefähre Durchschnittspreise privater Haushalte in Deutschland (Arbeitspreis inkl.
 * anteiligem Grundpreis, Steuern, Abgaben). Orientierungswerte nach öffentlich
 * berichteten Jahresmittelwerten (u. a. BDEW, Destatis) – in den Einstellungen anpassbar.
 */
export const DEFAULT_REF_PRICES = {
  strom:  { 2016: 28.8, 2017: 29.3, 2018: 29.5, 2019: 30.5, 2020: 31.8, 2021: 32.2, 2022: 40.1, 2023: 45.7, 2024: 41.4, 2025: 39.9, 2026: 38.5 },
  gas:    { 2016: 6.6,  2017: 6.4,  2018: 6.3,  2019: 6.4,  2020: 6.3,  2021: 6.9,  2022: 13.4, 2023: 12.9, 2024: 11.2, 2025: 11.6, 2026: 11.3 },
  wasser: { 2016: 4.2,  2017: 4.3,  2018: 4.3,  2019: 4.4,  2020: 4.5,  2021: 4.6,  2022: 4.7,  2023: 4.9,  2024: 5.1,  2025: 5.3,  2026: 5.4 },
}

export const DEFAULT_SETTINGS = {
  plz: '',
  persons: 2,
  consumption: { strom: '', gas: '', wasser: '' }, // leer = aus Rechnungen ermitteln
  refPrices: DEFAULT_REF_PRICES,
  savingThreshold: 50, // € pro Jahr, ab der ein Wechsel empfohlen wird
}

export const DAY = 86400000
export const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / DAY) + 1)
export const addDays = (iso, n) => new Date(new Date(iso).getTime() + n * DAY).toISOString().slice(0, 10)
export const addMonths = (iso, n) => {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}
export const daysUntil = (iso) => Math.round((new Date(iso) - new Date(new Date().toISOString().slice(0, 10))) / DAY)

/** Jahreskosten eines Tarifs bei gegebenem Verbrauch. */
export function annualCost(tariff, consumption, { firstYear = false } = {}) {
  if (!tariff) return null
  const sp = spById(tariff.sparte)
  const work = (Number(tariff.workPrice) || 0) * sp.toEur * (Number(consumption) || 0)
  const base = Number(tariff.basePrice) || 0
  const bonus = firstYear ? (Number(tariff.bonus) || 0) : 0
  return work + base - bonus
}

/** Durchschnittliche Kosten über die Mindestlaufzeit (Bonus auf die Laufzeit verteilt). */
export function avgAnnualCost(tariff, consumption) {
  const years = Math.max(1, (Number(tariff.minTermMonths) || 12) / 12)
  return annualCost(tariff, consumption) - (Number(tariff.bonus) || 0) / years
}

/** Effektiver Preis pro Einheit inkl. Grundpreis (in Anzeige-Einheit, z. B. ct/kWh). */
export function effectiveUnitPrice(tariff, consumption) {
  const sp = spById(tariff.sparte)
  if (!consumption) return null
  return annualCost(tariff, consumption) / consumption / sp.toEur
}

// ── Rechnungen ──────────────────────────────────────────────────────────

export function invoiceDays(inv) {
  if (!inv.periodFrom || !inv.periodTo) return 365
  return daysBetween(inv.periodFrom, inv.periodTo)
}

export function invoiceStats(inv) {
  const sp = spById(inv.sparte)
  const days = invoiceDays(inv)
  const consumption = Number(inv.consumption) || 0
  const total = Number(inv.total) || 0
  return {
    days,
    annualConsumption: consumption * 365 / days,
    annualCost: total * 365 / days,
    // Effektiver Preis je Einheit inkl. Grundpreis, in Anzeige-Einheit
    effPrice: consumption ? total / consumption / sp.toEur : null,
    balance: inv.advancesPaid != null && inv.advancesPaid !== '' ? total - Number(inv.advancesPaid) : null,
  }
}

export const sortInvoices = (list) => [...list].sort((a, b) => (a.periodTo || '').localeCompare(b.periodTo || ''))

/** Verteilt Rechnungen tagesgenau auf Kalenderjahre → { year: { cost, consumption, days } } */
export function yearlyTotals(invoices, sparte) {
  const out = {}
  for (const inv of invoices.filter(i => i.sparte === sparte && i.periodFrom && i.periodTo)) {
    const total = invoiceDays(inv)
    let cur = new Date(inv.periodFrom)
    const end = new Date(inv.periodTo)
    while (cur <= end) {
      const y = cur.getFullYear()
      const yEnd = new Date(Math.min(end, new Date(`${y}-12-31`)))
      const d = Math.round((yEnd - cur) / DAY) + 1
      const share = d / total
      out[y] ||= { cost: 0, consumption: 0, days: 0 }
      out[y].cost += (Number(inv.total) || 0) * share
      out[y].consumption += (Number(inv.consumption) || 0) * share
      out[y].days += d
      cur = new Date(`${y + 1}-01-01`)
    }
  }
  return out
}

// ── Verträge ────────────────────────────────────────────────────────────

export const activeContract = (contracts, sparte) =>
  contracts.filter(c => c.sparte === sparte && c.active !== false)
    .sort((a, b) => (b.start || '').localeCompare(a.start || ''))[0] || null

/** Geschätzter Jahresverbrauch: Einstellung → letzte Rechnung → Vertragsangabe → Standard. */
export function estimatedConsumption(sparte, { settings, invoices, contracts }) {
  const manual = Number(String(settings?.consumption?.[sparte] ?? '').replace(',', '.'))
  if (manual > 0) return { value: manual, source: 'Einstellung' }
  const invs = sortInvoices(invoices.filter(i => i.sparte === sparte && Number(i.consumption) > 0))
  if (invs.length) {
    return { value: Math.round(invoiceStats(invs[invs.length - 1]).annualConsumption), source: 'letzte Rechnung' }
  }
  const c = activeContract(contracts, sparte)
  if (Number(c?.expectedConsumption) > 0) return { value: Number(c.expectedConsumption), source: 'Vertrag' }
  return { value: spById(sparte).defaultConsumption, source: 'Standardwert' }
}

/**
 * Nächstmöglicher Kündigungstermin.
 * Seit 1.3.2022 (Gesetz für faire Verbraucherverträge) verlängern sich Verträge nach der
 * Erstlaufzeit auf unbestimmte Zeit und sind mit einem Monat Frist kündbar.
 */
export function cancellationInfo(c) {
  if (!c) return null
  if (/grundversorg|ersatzversorg/i.test(c.tariff || '')) {
    return { canCancel: true, deadline: null, text: 'Grundversorgung: jederzeit mit 2 Wochen Frist kündbar.' }
  }
  const today = new Date().toISOString().slice(0, 10)
  const termEnd = c.minTermEnd || (c.start && c.minTermMonths ? addDays(addMonths(c.start, Number(c.minTermMonths)), -1) : null)
  const noticeDays = Math.round((Number(c.noticeWeeks) || 4) * 7)
  if (termEnd && termEnd > today) {
    const deadline = addDays(termEnd, -noticeDays)
    return {
      canCancel: false, termEnd, deadline,
      text: deadline >= today
        ? `Erstlaufzeit bis ${termEnd.split('-').reverse().join('.')}, Kündigung spätestens bis ${deadline.split('-').reverse().join('.')}.`
        : `Erstlaufzeit bis ${termEnd.split('-').reverse().join('.')} – Kündigungsfrist verpasst, danach monatlich kündbar.`,
    }
  }
  return { canCancel: true, termEnd, deadline: null, text: 'Erstlaufzeit abgelaufen – mit 1 Monat Frist kündbar.' }
}

export function refPrice(settings, sparte, year) {
  const t = settings?.refPrices?.[sparte] || DEFAULT_REF_PRICES[sparte]
  if (t[year] != null) return Number(t[year])
  const years = Object.keys(t).map(Number).sort((a, b) => a - b)
  if (!years.length) return null
  return Number(t[year < years[0] ? years[0] : years[years.length - 1]])
}

export const SEARCH_LINKS = {
  strom: [
    { label: 'Verivox Stromvergleich', url: 'https://www.verivox.de/strom/' },
    { label: 'Check24 Stromvergleich', url: 'https://www.check24.de/strom/' },
    { label: 'Finanztip Stromratgeber', url: 'https://www.finanztip.de/stromvergleich/' },
  ],
  gas: [
    { label: 'Verivox Gasvergleich', url: 'https://www.verivox.de/gas/' },
    { label: 'Check24 Gasvergleich', url: 'https://www.check24.de/gas/' },
    { label: 'Finanztip Gasratgeber', url: 'https://www.finanztip.de/gasvergleich/' },
  ],
  wasser: [
    { label: 'Wasserspartipps (Umweltbundesamt)', url: 'https://www.umweltbundesamt.de/umwelttipps-fuer-den-alltag/heizen-bauen/wasser-sparen-in-haushalt-garten' },
  ],
}
