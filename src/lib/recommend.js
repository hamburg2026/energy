import {
  SPARTEN, spById, annualCost, avgAnnualCost, activeContract, estimatedConsumption,
  cancellationInfo, invoiceStats, sortInvoices, refPrice, daysUntil, effectiveUnitPrice,
} from './energy'
import { fmt0, fmtNum, fmtDate } from './fmt'

/**
 * Erzeugt Empfehlungen aus Verträgen, Rechnungen und erfassten Tarifen.
 * severity: 'saving' (Geld sparen), 'warning' (handeln), 'info', 'ok'
 */
export function buildRecommendations({ contracts, invoices, offers, settings }) {
  const recs = []
  const year = new Date().getFullYear()
  const threshold = Number(settings?.savingThreshold) || 50

  for (const sp of SPARTEN) {
    const c = activeContract(contracts, sp.id)
    const cons = estimatedConsumption(sp.id, { settings, invoices, contracts })
    const spOffers = offers.filter(o => o.sparte === sp.id)
    const invs = sortInvoices(invoices.filter(i => i.sparte === sp.id))
    const push = (r) => recs.push({ sparte: sp.id, ...r })

    if (!c && !invs.length && !spOffers.length) continue

    if (!c) {
      push({
        severity: 'info', priority: 2,
        title: `${sp.label}: Kein aktiver Vertrag erfasst`,
        text: 'Lege den aktuellen Vertrag mit Arbeits- und Grundpreis an, damit Kosten verglichen und Fristen überwacht werden können.',
        action: { view: 'contracts', label: 'Vertrag anlegen' },
      })
    }

    // 1) Vergleich mit erfassten Tarifen / Angeboten
    if (c && sp.switchable) {
      const current = annualCost(c, cons.value)
      const ranked = spOffers
        .map(o => ({ o, first: annualCost(o, cons.value, { firstYear: true }), follow: annualCost(o, cons.value), avg: avgAnnualCost(o, cons.value) }))
        .sort((a, b) => a.avg - b.avg)
      const best = ranked[0]
      if (best) {
        const savingAvg = current - best.avg
        const savingFollow = current - best.follow
        const sameProvider = norm(best.o.provider) === norm(c.provider)
        if (savingAvg >= threshold) {
          push({
            severity: 'saving', priority: 0, saving: savingAvg,
            title: `${sp.label}: ${sameProvider ? 'Tarifwechsel beim bestehenden Anbieter' : `Wechsel zu ${best.o.provider}`} spart ca. ${fmt0(savingAvg)} pro Jahr`,
            text: `„${best.o.tariff || 'Tarif'}“ kostet bei ${fmtNum(cons.value, 0)} ${sp.unit}/Jahr im Schnitt ${fmt0(best.avg)} statt ${fmt0(current)}`
              + (Number(best.o.bonus) ? ` (1. Jahr inkl. Bonus ${fmt0(best.first)}, danach ${fmt0(best.follow)}).` : '.')
              + (savingFollow < 0 ? ' Achtung: Ohne Bonus ist der Tarif ab dem 2. Jahr teurer – rechtzeitig erneut vergleichen.' : '')
              + ` ${cancellationInfo(c).text}`,
            action: { view: 'offers', label: 'Zum Tarifvergleich' },
          })
        } else if (savingAvg > 0) {
          push({
            severity: 'info', priority: 3,
            title: `${sp.label}: Günstigster erfasster Tarif spart nur ${fmt0(savingAvg)} pro Jahr`,
            text: `Der Aufwand eines Wechsels lohnt sich kaum (Schwelle: ${fmt0(threshold)}). Dein Vertrag bei ${c.provider} ist konkurrenzfähig.`,
          })
        } else {
          push({
            severity: 'ok', priority: 4,
            title: `${sp.label}: Dein Tarif ist günstiger als alle ${ranked.length} erfassten Alternativen`,
            text: `Aktuell ca. ${fmt0(current)} pro Jahr. Bester Vergleichstarif: ${best.o.provider} „${best.o.tariff || ''}“ mit ${fmt0(best.avg)}.`,
          })
        }
      } else {
        push({
          severity: 'info', priority: 2,
          title: `${sp.label}: Noch keine Vergleichstarife erfasst`,
          text: `Frage bei ${c.provider || 'deinem Anbieter'} nach aktuellen Bestandskunden- oder Neukundentarifen und vergleiche auf Vergleichsportalen`
            + `${settings?.plz ? ` (PLZ ${settings.plz}` : ' ('}Verbrauch ${fmtNum(cons.value, 0)} ${sp.unit}). Angebote kannst du als PDF importieren.`,
          action: { view: 'offers', label: 'Tarife erfassen & suchen' },
        })
      }
    }

    // 2) Vergleich mit Marktdurchschnitt
    if (c) {
      const eff = effectiveUnitPrice(c, cons.value)
      const ref = refPrice(settings, sp.id, year)
      if (eff && ref) {
        const diff = (eff - ref) / ref * 100
        if (diff > 10) {
          push({
            severity: sp.switchable ? 'warning' : 'info', priority: 1,
            title: `${sp.label}: ${fmtNum(diff, 0)} % über dem Durchschnittspreis`,
            text: `Effektiv zahlst du ${fmtNum(eff, sp.priceDecimals)} ${sp.priceUnit} (inkl. Grundpreis), der Richtwert ${year} liegt bei ca. ${fmtNum(ref, sp.priceDecimals)} ${sp.priceUnit}.`
              + (sp.switchable ? ` Ein Wechsel könnte rund ${fmt0((eff - ref) * sp.toEur * cons.value)} pro Jahr sparen.` : ' Wasser kann nicht frei gewechselt werden – Sparpotenzial liegt im Verbrauch.'),
            action: sp.switchable ? { view: 'offers', label: 'Alternativen suchen' } : undefined,
          })
        } else if (diff < -5) {
          push({
            severity: 'ok', priority: 4,
            title: `${sp.label}: Preis unter dem Durchschnitt`,
            text: `Effektiv ${fmtNum(eff, sp.priceDecimals)} ${sp.priceUnit} gegenüber ca. ${fmtNum(ref, sp.priceDecimals)} ${sp.priceUnit} im Mittel (${year}).`,
          })
        }
      }

      if (/grundversorg|ersatzversorg/i.test(c.tariff || '') && sp.switchable) {
        push({
          severity: 'warning', priority: 1,
          title: `${sp.label}: Du bist in der Grundversorgung`,
          text: 'Grundversorgungstarife sind meist deutlich teurer als Sondertarife – auch beim selben Anbieter. Sie sind mit 2 Wochen Frist kündbar.',
          action: { view: 'offers', label: 'Tarife vergleichen' },
        })
      }

      // 3) Fristen
      const ci = cancellationInfo(c)
      if (ci?.deadline) {
        const d = daysUntil(ci.deadline)
        if (d >= 0 && d <= 60) {
          push({
            severity: 'warning', priority: 0,
            title: `${sp.label}: Kündigungsfrist endet in ${d} Tagen (${fmtDate(ci.deadline)})`,
            text: `Wenn du wechseln möchtest, musst du bis ${fmtDate(ci.deadline)} kündigen oder den neuen Anbieter beauftragen. ${ci.text}`,
            action: { view: 'offers', label: 'Jetzt vergleichen' },
          })
        }
      }
      if (c.priceGuaranteeUntil) {
        const d = daysUntil(c.priceGuaranteeUntil)
        if (d >= 0 && d <= 90) {
          push({
            severity: 'warning', priority: 1,
            title: `${sp.label}: Preisgarantie endet am ${fmtDate(c.priceGuaranteeUntil)}`,
            text: 'Nach Ablauf darf der Anbieter die Preise anpassen. Prüfe frühzeitig Alternativen – bei Preiserhöhung hast du ein Sonderkündigungsrecht.',
          })
        }
      }

      // 4) Preiserhöhung → Sonderkündigungsrecht
      const hist = [...(c.priceHistory || [])].sort((a, b) => a.date.localeCompare(b.date))
      if (hist.length >= 2) {
        const last = hist[hist.length - 1], prev = hist[hist.length - 2]
        const before = annualCost({ ...c, ...prev }, cons.value)
        const after = annualCost({ ...c, ...last }, cons.value)
        const daysSince = -daysUntil(last.date)
        if (after > before && daysSince < 120) {
          push({
            severity: 'warning', priority: 0,
            title: `${sp.label}: Preiserhöhung zum ${fmtDate(last.date)} (+${fmt0(after - before)}/Jahr)`,
            text: 'Bei einer Preiserhöhung besteht ein Sonderkündigungsrecht (i. d. R. bis zum Inkrafttreten). Jetzt vergleichen lohnt sich.',
            action: { view: 'offers', label: 'Alternativen prüfen' },
          })
        }
      }

      // 5) Abschlag prüfen
      const adv = Number(c.monthlyAdvance)
      if (adv > 0) {
        const needed = annualCost(c, cons.value) / 12
        const diff = (adv - needed) / needed * 100
        if (Math.abs(diff) > 12) {
          push({
            severity: diff < 0 ? 'warning' : 'info', priority: 2,
            title: `${sp.label}: Abschlag ${diff < 0 ? 'zu niedrig' : 'zu hoch'} (${fmtNum(adv, 0)} € statt ca. ${fmtNum(needed, 0)} €)`,
            text: diff < 0
              ? `Bei ${fmtNum(cons.value, 0)} ${sp.unit}/Jahr droht eine Nachzahlung von etwa ${fmt0((needed - adv) * 12)}. Abschlag beim Anbieter anpassen.`
              : `Du gibst dem Anbieter einen zinslosen Kredit von ca. ${fmt0((adv - needed) * 12)} pro Jahr. Abschlag kann reduziert werden.`,
          })
        }
      }
    }

    // 6) Verbrauchsentwicklung
    if (invs.length >= 2) {
      const a = invoiceStats(invs[invs.length - 2]).annualConsumption
      const b = invoiceStats(invs[invs.length - 1]).annualConsumption
      if (a > 0) {
        const diff = (b - a) / a * 100
        if (diff > 10) {
          push({
            severity: 'info', priority: 2,
            title: `${sp.label}: Verbrauch um ${fmtNum(diff, 0)} % gestiegen`,
            text: `Hochgerechnet ${fmtNum(b, 0)} statt ${fmtNum(a, 0)} ${sp.unit}/Jahr. ${TIPS[sp.id]}`,
          })
        } else if (diff < -10) {
          push({
            severity: 'ok', priority: 4,
            title: `${sp.label}: Verbrauch um ${fmtNum(-diff, 0)} % gesunken`,
            text: `Hochgerechnet ${fmtNum(b, 0)} statt ${fmtNum(a, 0)} ${sp.unit}/Jahr. Prüfe, ob der Abschlag angepasst werden kann.`,
          })
        }
      }

      // Effektiver Preis gegenüber Vorjahr
      const pa = invoiceStats(invs[invs.length - 2]).effPrice
      const pb = invoiceStats(invs[invs.length - 1]).effPrice
      if (pa && pb && (pb - pa) / pa > 0.1) {
        push({
          severity: 'info', priority: 3,
          title: `${sp.label}: Effektiver Preis um ${fmtNum((pb - pa) / pa * 100, 0)} % gestiegen`,
          text: `Von ${fmtNum(pa, sp.priceDecimals)} auf ${fmtNum(pb, sp.priceDecimals)} ${sp.priceUnit} laut den letzten beiden Rechnungen.`,
        })
      }
    }

    if (sp.id === 'wasser' && (c || invs.length)) {
      const perPerson = cons.value / (Number(settings?.persons) || 1)
      if (perPerson > 50) {
        push({
          severity: 'info', priority: 3,
          title: `Wasser: ${fmtNum(perPerson, 0)} m³ pro Person und Jahr`,
          text: `Der Durchschnitt liegt bei etwa 45–47 m³ (ca. 125 l/Tag). ${TIPS.wasser}`,
        })
      }
    }
  }

  const order = { saving: 0, warning: 1, info: 2, ok: 3 }
  return recs.sort((a, b) => (a.priority - b.priority) || (order[a.severity] - order[b.severity]) || ((b.saving || 0) - (a.saving || 0)))
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9äöü]/g, '')

const TIPS = {
  strom: 'Typische Ursachen: neue Großgeräte, Standby-Verbraucher, Wärmepumpe/E-Auto. Ein Strommessgerät hilft beim Aufspüren.',
  gas: 'Heizkurve, hydraulischer Abgleich und 1 °C weniger Raumtemperatur (≈ 6 % Ersparnis) sind die größten Hebel.',
  wasser: 'Sparduschköpfe, Perlatoren und das Prüfen auf tropfende Hähne/laufende Spülungen senken den Verbrauch deutlich.',
}

export const SEVERITY = {
  saving:  { label: 'Sparpotenzial', color: '#15803d', bg: '#dcfce7', icon: '💶' },
  warning: { label: 'Handeln',       color: '#b45309', bg: '#fef3c7', icon: '⚠️' },
  info:    { label: 'Hinweis',       color: '#1d4ed8', bg: '#dbeafe', icon: 'ℹ️' },
  ok:      { label: 'Alles gut',     color: '#475569', bg: '#f1f5f9', icon: '✅' },
}

export { spById }
