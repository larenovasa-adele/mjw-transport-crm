// South Africa's standard VAT rate is 15% (confirmed via SARS and the
// 2026 Budget, which withdrew the previously proposed increase to 16%).
// If this ever changes, update it here — it's the only place it's defined.
export const VAT_RATE = 0.15

export interface DraftLineItem {
  description: string
  quantity: string
  unit_price: string
}

export const emptyLineItem = (): DraftLineItem => ({ description: '', quantity: '1', unit_price: '' })

export function computeTotals(items: DraftLineItem[]) {
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    return sum + qty * price
  }, 0)
  const vat_amount = Math.round(subtotal * VAT_RATE * 100) / 100
  const total = Math.round((subtotal + vat_amount) * 100) / 100
  return { subtotal: Math.round(subtotal * 100) / 100, vat_amount, total }
}

export function formatZAR(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
