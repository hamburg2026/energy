import { createContext, useContext, useMemo } from 'react'
import { useLocalStorage } from './storage'
import { DEFAULT_SETTINGS } from './energy'
import { buildRecommendations } from './recommend'

export const DATA_KEYS = ['contracts', 'invoices', 'offers', 'settings']

const Ctx = createContext(null)

export function DataProvider({ children }) {
  const [contracts, setContracts] = useLocalStorage('contracts', [])
  const [invoices, setInvoices] = useLocalStorage('invoices', [])
  const [offers, setOffers] = useLocalStorage('offers', [])
  const [storedSettings, setSettings] = useLocalStorage('settings', DEFAULT_SETTINGS)
  const settings = useMemo(() => ({
    ...DEFAULT_SETTINGS, ...storedSettings,
    consumption: { ...DEFAULT_SETTINGS.consumption, ...(storedSettings?.consumption || {}) },
    refPrices: { ...DEFAULT_SETTINGS.refPrices, ...(storedSettings?.refPrices || {}) },
  }), [storedSettings])

  const recommendations = useMemo(
    () => buildRecommendations({ contracts, invoices, offers, settings }),
    [contracts, invoices, offers, settings],
  )

  const value = {
    contracts, setContracts, invoices, setInvoices, offers, setOffers, settings, setSettings, recommendations,
    upsert: (setter) => (item) => setter(list => list.some(x => x.id === item.id) ? list.map(x => x.id === item.id ? item : x) : [...list, item]),
    remove: (setter) => (id) => setter(list => list.filter(x => x.id !== id)),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)
