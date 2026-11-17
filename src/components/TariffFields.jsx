import { useState } from 'react'
import { spById } from '../lib/energy'
import { parseNum, fmtNum } from '../lib/fmt'
import { Field, SparteTabs } from './ui'

/** Wandelt Formularwerte (Strings) in Zahlen um. */
export function normalizeNumbers(obj, keys) {
  const out = { ...obj }
  for (const k of keys) {
    if (out[k] === '' || out[k] == null) { out[k] = null; continue }
    out[k] = parseNum(out[k])
  }
  return out
}

export const toInput = (v) => (v == null ? '' : String(v).replace('.', ','))

/** Gemeinsame Felder für Verträge und Tarifangebote. */
export default function TariffFields({ form, set, showSparte = true }) {
  const sp = spById(form.sparte)
  const [basePer, setBasePer] = useState('Jahr')
  const baseShown = basePer === 'Monat' && form.basePrice !== ''
    ? toInput(Math.round((parseNum(form.basePrice) || 0) / 12 * 100) / 100)
    : form.basePrice

  return (
    <>
      {showSparte && (
        <div style={{ gridColumn: '1 / -1' }}>
          <SparteTabs value={form.sparte} onChange={v => set('sparte', v)} />
        </div>
      )}
      <Field label="Anbieter"><input value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="z. B. Hamburg Energie" required /></Field>
      <Field label="Tarif"><input value={form.tariff} onChange={e => set('tariff', e.target.value)} placeholder="z. B. Strom Fix 24" /></Field>
      <Field label={`Arbeitspreis (${sp.priceUnit}, brutto)`}>
        <input inputMode="decimal" value={form.workPrice} onChange={e => set('workPrice', e.target.value)} placeholder={sp.id === 'wasser' ? '4,35' : sp.id === 'gas' ? '10,90' : '32,50'} />
      </Field>
      <Field label={`Grundpreis (€/${basePer}, brutto)`}
        hint={basePer === 'Monat' && form.basePrice !== '' ? `= ${fmtNum(parseNum(form.basePrice), 2)} € pro Jahr` : null}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input inputMode="decimal" style={{ flex: 1, minWidth: 0 }} value={baseShown}
            onChange={e => {
              const v = e.target.value
              if (basePer === 'Monat') {
                const n = parseNum(v)
                set('basePrice', n == null ? '' : toInput(Math.round(n * 12 * 100) / 100))
              } else set('basePrice', v)
            }} />
          <select value={basePer} onChange={e => setBasePer(e.target.value)} style={{ width: 92 }}>
            <option>Jahr</option><option>Monat</option>
          </select>
        </div>
      </Field>
      <Field label="Bonus (einmalig, €)"><input inputMode="decimal" value={form.bonus} onChange={e => set('bonus', e.target.value)} placeholder="0" /></Field>
      <Field label="Mindestlaufzeit (Monate)"><input inputMode="numeric" value={form.minTermMonths} onChange={e => set('minTermMonths', e.target.value)} placeholder="12" /></Field>
      <Field label="Kündigungsfrist (Wochen)"><input inputMode="numeric" value={form.noticeWeeks} onChange={e => set('noticeWeeks', e.target.value)} placeholder="4" /></Field>
      <Field label="Preisgarantie bis"><input type="date" value={form.priceGuaranteeUntil || ''} onChange={e => set('priceGuaranteeUntil', e.target.value)} /></Field>
    </>
  )
}

export const TARIFF_NUM_KEYS = ['workPrice', 'basePrice', 'bonus', 'minTermMonths', 'noticeWeeks']
