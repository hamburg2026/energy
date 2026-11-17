import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseNum } from './fmt'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/** Extrahiert Textzeilen (von oben nach unten) aus einem PDF. */
export async function extractPdfLines(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const lines = []
  for (let pg = 1; pg <= pdf.numPages; pg++) {
    const page = await pdf.getPage(pg)
    const byY = new Map()
    const stream = page.streamTextContent({ includeMarkedContent: false })
    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const item of (value?.items ?? [])) {
          if (!item.str?.trim() || !item.transform) continue
          // Zeilen mit ±2pt Abweichung zusammenfassen
          const y0 = Math.round(item.transform[5])
          const y = [...byY.keys()].find(k => Math.abs(k - y0) <= 2) ?? y0
          if (!byY.has(y)) byY.set(y, [])
          byY.get(y).push({ x: item.transform[4], text: item.str })
        }
      }
    } catch { /* Seite ohne Text */ } finally {
      try { reader.releaseLock() } catch { /* ignore */ }
    }
    for (const y of [...byY.keys()].sort((a, b) => b - a)) {
      const line = byY.get(y).sort((a, b) => a.x - b.x).map(i => i.text).join(' ').replace(/\s+/g, ' ').trim()
      if (line) lines.push(line)
    }
  }
  return lines
}

const KNOWN_PROVIDERS = [
  'HAMBURG WASSER', 'Hamburg Energie', 'Vattenfall', 'E.ON', 'EnBW', 'RWE', 'Lichtblick', 'LichtBlick', 'Yello',
  'Naturstrom', 'Polarstern', 'Greenpeace Energy', 'Green Planet Energy', 'Tibber', 'Octopus Energy', 'ostrom',
  'Rabot', 'eprimo', 'enercity', 'Mainova', 'EWE', 'Stadtwerke [A-ZÄÖÜ][\\wäöüß-]+', 'SWM', 'GASAG', 'DREWAG',
  'SachsenEnergie', 'EnviaM', 'envia', 'N-ERGIE', 'MVV', 'Rheinenergie', 'RheinEnergie', 'Süwag', 'Badenova',
  'Grünwelt', 'ExtraEnergie', 'Vattenfall Europe', 'E wie Einfach', 'Maxenergy', 'Shell Energy', 'EnergieDienst',
  'Berliner Wasserbetriebe', 'Wasserwerk', 'Wasserversorgung', 'Zweckverband',
]

const RE_DATE = '(\\d{1,2}\\.\\d{1,2}\\.(?:\\d{4}|\\d{2}))'
const RE_NUM = '(\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|\\d+(?:,\\d+)?)'

function isoDate(s) {
  const m = s?.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (!m) return ''
  let [, d, mo, y] = m
  if (y.length === 2) y = '20' + y
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function firstMatch(lines, re, group = 1) {
  for (const l of lines) {
    const m = l.match(re)
    if (m) return m[group]
  }
  return null
}

/**
 * Heuristische Auswertung einer Energie-/Wasserrechnung oder eines Tarifblatts.
 * Liefert Vorschläge; der Nutzer prüft und korrigiert sie im Formular.
 */
export function parseEnergyDoc(lines) {
  const text = lines.join('\n')
  const lower = text.toLowerCase()
  const found = {}

  // Sparte
  const score = {
    strom: (lower.match(/strom|elektrizit|kwh\b/g) || []).length,
    gas: (lower.match(/erdgas|\bgas|brennwert|zustandszahl/g) || []).length * 1.5,
    wasser: (lower.match(/wasser|abwasser|m³|m3|kubikmeter|schmutzwasser/g) || []).length,
  }
  if (/brennwert|zustandszahl/.test(lower)) score.gas += 10
  if (/trinkwasser|schmutzwasser|abwasser/.test(lower)) score.wasser += 10
  found.sparte = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0]
  const isWater = found.sparte === 'wasser'

  // Anbieter
  for (const p of KNOWN_PROVIDERS) {
    const m = text.match(new RegExp(p.replace(/\./g, '\\.'), 'i'))
    if (m) { found.provider = m[0]; break }
  }
  if (!found.provider) {
    const l = lines.slice(0, 25).find(l => /\b(GmbH|AG|KG|SE|Stadtwerke|Energie|Versorgung)\b/.test(l) && l.length < 70)
    if (l) found.provider = l.replace(/[,·|].*$/, '').trim()
  }

  // Tarif
  const tariff = firstMatch(lines, /(?:Tarif(?:name)?|Produkt)\s*[:\-]?\s*([A-ZÄÖÜ][^\n]{2,40}?)(?:\s{2,}|$|\s+\d)/)
  if (tariff && !/^(preis|preise|änderung)/i.test(tariff)) found.tariff = tariff.trim()
  if (/grundversorgung/i.test(text) && !found.tariff) found.tariff = 'Grundversorgung'

  // Kundennummer / Zähler
  found.customerNo = firstMatch(lines, /(?:Kundennummer|Kunden-Nr\.?|Vertragskonto|Vertragsnummer)\s*[:.]?\s*([\w\-/]{4,})/i) || ''
  found.meterNo = firstMatch(lines, /(?:Zählernummer|Zähler-Nr\.?|Zählernr\.?)\s*[:.]?\s*([\w\-/]{4,})/i) || ''

  // Abrechnungszeitraum
  const periodRe = new RegExp(`${RE_DATE}\\s*(?:-|–|bis)\\s*${RE_DATE}`)
  let period = null
  for (const l of lines) {
    if (/zeitraum|abrechnung|verbrauch|lieferung/i.test(l)) {
      const m = l.match(periodRe)
      if (m) { period = m; break }
    }
  }
  if (!period) period = text.match(periodRe)
  if (period) {
    found.periodFrom = isoDate(period[1])
    found.periodTo = isoDate(period[2])
  }

  // Verbrauch
  const unitRe = isWater ? '(?:m³|m3|cbm|Kubikmeter)' : 'kWh'
  const consRe = new RegExp(`${RE_NUM}\\s*${unitRe}(?!\\s*\\/)`, 'i')
  const consCandidates = []
  for (const l of lines) {
    const all = [...l.matchAll(new RegExp(consRe.source, 'gi'))]
    for (const m of all) {
      const v = parseNum(m[1])
      if (v == null) continue
      if (/ct|cent|€|eur/i.test(l.slice(m.index + m[0].length, m.index + m[0].length + 4))) continue
      const weight = /gesamtverbrauch|verbrauch gesamt|ihr verbrauch|summe verbrauch/i.test(l) ? 3 : /verbrauch/i.test(l) ? 2 : 1
      consCandidates.push({ v, weight })
    }
  }
  if (consCandidates.length) {
    consCandidates.sort((a, b) => b.weight - a.weight || b.v - a.v)
    found.consumption = consCandidates[0].v
  }

  // Arbeitspreis
  for (const l of lines) {
    if (!/arbeitspreis|verbrauchspreis|mengenpreis|preis je|ct\/kwh|cent\/kwh|€\/m|eur\/m/i.test(l)) continue
    const m = l.match(new RegExp(`${RE_NUM}\\s*(ct|cent|€|eur)\\s*(?:\\/|je|pro)\\s*(kwh|m³|m3|cbm)`, 'i'))
    if (m) {
      let v = parseNum(m[1])
      const unit = m[2].toLowerCase()
      if (!isWater && (unit === '€' || unit === 'eur')) v = v * 100
      if (isWater && (unit === 'ct' || unit === 'cent')) v = v / 100
      // Brutto bevorzugen: falls mehrere Werte, nimm den größeren (inkl. MwSt.)
      if (found.workPrice == null || (/brutto|inkl/i.test(l))) found.workPrice = round(v, 4)
    }
  }

  // Grundpreis
  for (const l of lines) {
    if (!/grundpreis|grundgebühr|bereitstellungspreis|messpreis|zählergebühr/i.test(l)) continue
    const m = l.match(new RegExp(`${RE_NUM}\\s*(?:€|EUR)\\s*(?:\\/|je|pro)?\\s*(Monat|Mon\\.?|Jahr|a\\b|Tag)?`, 'i'))
    if (m) {
      let v = parseNum(m[1])
      const per = (m[2] || '').toLowerCase()
      if (per.startsWith('mon')) v *= 12
      else if (per === 'tag') v *= 365
      else if (!per && v < 30) v *= 12 // vermutlich Monatsbetrag
      if (found.basePrice == null || /brutto|inkl/i.test(l)) found.basePrice = round(v, 2)
    }
  }

  // Beträge
  const amount = (re) => {
    for (const l of lines) {
      if (!re.test(l)) continue
      const all = [...l.matchAll(/(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:€|EUR)?/g)]
      if (all.length) return Math.abs(parseNum(all[all.length - 1][1]))
    }
    return null
  }
  found.total = amount(/(rechnungsbetrag|gesamtbetrag|bruttobetrag|summe brutto|gesamtkosten|entgelt gesamt|bruttorechnungsbetrag)/i)
  found.advancesPaid = amount(/(geleistete|gezahlte|abzüglich|abschläge|abschlagszahlungen|bereits bezahlt)/i)
  found.monthlyAdvance = amount(/(neuer|künftiger|monatlicher|ihr)\s+abschlag|abschlag\s+(ab|zum|künftig|monatlich)/i)
  found.bonus = amount(/(neukundenbonus|sofortbonus|wechselbonus|treuebonus|bonus)/i)

  // Konditionen (Tarifblätter)
  const guarantee = text.match(new RegExp(`preisgarantie[^\\n]*?(?:bis(?:\\s+zum)?\\s*)${RE_DATE}`, 'i'))
  if (guarantee) found.priceGuaranteeUntil = isoDate(guarantee[1])
  const gMonths = text.match(/preisgarantie[^\n]*?(\d{1,2})\s*monat/i)
  if (gMonths) found.priceGuaranteeMonths = Number(gMonths[1])
  const minTerm = text.match(/(?:mindest|erst)?laufzeit[^\n]*?(\d{1,2})\s*monat/i)
  if (minTerm) found.minTermMonths = Number(minTerm[1])
  const notice = text.match(/kündigungsfrist[^\n]*?(\d{1,2})\s*(woche|monat)/i)
  if (notice) found.noticeWeeks = /monat/i.test(notice[2]) ? Number(notice[1]) * 4 : Number(notice[1])

  // Rechnungsdatum
  const invDate = firstMatch(lines, new RegExp(`(?:Rechnungsdatum|Datum)\\s*[:.]?\\s*${RE_DATE}`, 'i'))
  if (invDate) found.invoiceDate = isoDate(invDate)

  Object.keys(found).forEach(k => { if (found[k] == null || found[k] === '') delete found[k] })
  return found
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d
