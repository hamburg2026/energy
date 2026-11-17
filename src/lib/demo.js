import { uid } from './fmt'

/** Beispieldaten (fiktive Anbieter) zum Ausprobieren der App. */
export function buildDemoData() {
  const Y = new Date().getFullYear()
  const years = [7, 6, 5, 4, 3, 2, 1].map(o => Y - o)
  const strom = [29.5, 30.2, 31.0, 36.5, 44.9, 41.2, 38.9]
  const stromBase = [118, 120, 126, 138, 168, 165, 165]
  const stromCons = [2950, 2880, 3020, 2790, 2610, 2650, 2720]
  const gas = [6.1, 6.0, 6.6, 12.8, 13.9, 11.9, 11.4]
  const gasBase = [150, 150, 156, 178, 196, 190, 190]
  const gasCons = [13400, 13100, 13800, 11900, 10800, 11200, 11050]
  const wasser = [4.2, 4.3, 4.4, 4.55, 4.75, 4.95, 5.1]
  const wasserCons = [96, 98, 104, 101, 94, 92, 95]

  const invoices = []
  years.forEach((y, i) => {
    invoices.push({
      id: uid(), sparte: 'strom', provider: 'Nordstrom Energie', tariff: 'Nordstrom Klassik',
      periodFrom: `${y}-01-01`, periodTo: `${y}-12-31`, invoiceDate: `${y + 1}-01-20`,
      consumption: stromCons[i], workPrice: strom[i], basePrice: stromBase[i],
      total: r2(stromCons[i] * strom[i] / 100 + stromBase[i]), advancesPaid: r2(Math.round((stromCons[i] * strom[i] / 100 + stromBase[i]) / 12 / 5) * 5 * 12 - 40 + i * 15),
      notes: '', docId: null,
    })
    invoices.push({
      id: uid(), sparte: 'gas', provider: i < 5 ? 'Stadtwerke Beispielstadt' : 'Hanse Gas', tariff: i < 5 ? 'Erdgas Basis' : 'Hanse Gas Fix 24',
      periodFrom: `${y}-03-01`, periodTo: `${y + 1}-02-${(y + 1) % 4 === 0 ? 29 : 28}`, invoiceDate: `${y + 1}-03-15`,
      consumption: gasCons[i], workPrice: gas[i], basePrice: gasBase[i],
      total: r2(gasCons[i] * gas[i] / 100 + gasBase[i]), advancesPaid: r2((gasCons[i] * gas[i] / 100 + gasBase[i]) * (i === 3 ? 0.72 : 0.97)),
      notes: i === 3 ? 'Große Nachzahlung wegen Preissprung' : '', docId: null,
    })
    invoices.push({
      id: uid(), sparte: 'wasser', provider: 'Stadtwasser', tariff: 'Trink- und Schmutzwasser',
      periodFrom: `${y}-01-01`, periodTo: `${y}-12-31`, invoiceDate: `${y + 1}-02-05`,
      consumption: wasserCons[i], workPrice: wasser[i], basePrice: 60,
      total: r2(wasserCons[i] * wasser[i] + 60), advancesPaid: r2(45 * 12), notes: '', docId: null,
    })
  })

  const contracts = [
    {
      id: uid(), sparte: 'strom', provider: 'Nordstrom Energie', tariff: 'Nordstrom Klassik', start: `${Y - 8}-04-01`,
      workPrice: 39.8, basePrice: 171, bonus: null, minTermMonths: 12, noticeWeeks: 4, priceGuaranteeUntil: '',
      monthlyAdvance: 80, customerNo: '4711-0815', meterNo: '1ESY1160012345', active: true, notes: 'Bestandskunde seit Jahren',
      priceHistory: years.map((y, i) => ({ date: `${y}-01-01`, workPrice: strom[i], basePrice: stromBase[i] }))
        .concat([{ date: `${Y}-01-01`, workPrice: 37.9, basePrice: 165 }, { date: isoInDays(-30), workPrice: 39.8, basePrice: 171 }]),
    },
    {
      id: uid(), sparte: 'gas', provider: 'Hanse Gas', tariff: 'Hanse Gas Fix 24', start: `${Y - 2}-03-01`,
      workPrice: 11.4, basePrice: 190, bonus: 80, minTermMonths: 24, noticeWeeks: 4, priceGuaranteeUntil: isoInDays(70),
      monthlyAdvance: 120, customerNo: 'HG-220931', meterNo: '7GAS0012345', active: true, notes: '',
      priceHistory: [{ date: `${Y - 2}-03-01`, workPrice: 11.9, basePrice: 190 }, { date: `${Y - 1}-03-01`, workPrice: 11.4, basePrice: 190 }],
    },
    {
      id: uid(), sparte: 'gas', provider: 'Stadtwerke Beispielstadt', tariff: 'Erdgas Basis', start: `${Y - 9}-01-01`,
      workPrice: 13.9, basePrice: 196, minTermMonths: 12, noticeWeeks: 4, active: false, notes: 'gekündigt nach Preiserhöhung',
      priceHistory: [],
    },
    {
      id: uid(), sparte: 'wasser', provider: 'Stadtwasser', tariff: 'Trink- und Schmutzwasser', start: `${Y - 10}-01-01`,
      workPrice: 5.25, basePrice: 60, minTermMonths: null, noticeWeeks: null, priceGuaranteeUntil: '',
      monthlyAdvance: 45, customerNo: 'W-778812', meterNo: 'WZ-55123', active: true, notes: 'Preis inkl. Schmutzwassergebühr',
      priceHistory: years.map((y, i) => ({ date: `${y}-01-01`, workPrice: wasser[i], basePrice: 60 })).concat([{ date: `${Y}-01-01`, workPrice: 5.25, basePrice: 60 }]),
    },
  ]

  const offers = [
    { id: uid(), sparte: 'strom', provider: 'Grünstrom Direkt', tariff: 'Öko Fix 12', workPrice: 29.9, basePrice: 156, bonus: 60, minTermMonths: 12, noticeWeeks: 4, priceGuaranteeUntil: isoInDays(400), captured: isoInDays(-5), url: '', notes: '100 % Ökostrom' },
    { id: uid(), sparte: 'strom', provider: 'Nordstrom Energie', tariff: 'Nordstrom Online 24', workPrice: 32.4, basePrice: 150, bonus: null, minTermMonths: 24, noticeWeeks: 4, priceGuaranteeUntil: isoInDays(730), captured: isoInDays(-5), url: '', notes: 'Bestandskundenangebot per Telefon' },
    { id: uid(), sparte: 'gas', provider: 'Hansa Wärme', tariff: 'Wärme Fix 12', workPrice: 9.6, basePrice: 168, bonus: 100, minTermMonths: 12, noticeWeeks: 4, priceGuaranteeUntil: isoInDays(450), captured: isoInDays(-3), url: '', notes: '' },
  ]

  return { contracts, invoices, offers, settings: { plz: '20095', persons: 2, consumption: { strom: '', gas: '', wasser: '' }, savingThreshold: 50 } }
}

const r2 = (v) => Math.round(v * 100) / 100
const isoInDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
