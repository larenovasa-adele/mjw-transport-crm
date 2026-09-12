import { useState, type FormEvent } from 'react'
import { useTable } from '../lib/useTable'
import { supabase } from '../lib/supabase'
import { computeTotals, emptyLineItem, formatZAR, VAT_RATE, type DraftLineItem } from '../lib/lineItems'
import type { Client, Expense, ExpenseCategory, Invoice, Quote, Route, Vehicle } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  LoadingState,
  Modal,
  PageHeader,
} from '../components/ui'
import { format, parseISO } from 'date-fns'

type Tab = 'quotes' | 'invoices' | 'expenses'

export default function Finances() {
  const [tab, setTab] = useState<Tab>('invoices')

  return (
    <div>
      <PageHeader title="Finances" subtitle="Quotes, invoices, and expenses" />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm font-medium sm:w-fit">
        {(['invoices', 'quotes', 'expenses'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 capitalize ${tab === t ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'quotes' && <QuotesTab />}
      {tab === 'expenses' && <ExpensesTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared: line item editor used by both quotes and invoices
// ---------------------------------------------------------------------------
function LineItemsEditor({
  items,
  onChange,
}: {
  items: DraftLineItem[]
  onChange: (items: DraftLineItem[]) => void
}) {
  const totals = computeTotals(items)

  function updateItem(index: number, patch: Partial<DraftLineItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-3">
      <span className="mb-1 block text-sm font-medium text-slate-700">Line items</span>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_70px_90px_28px] gap-2">
          <input
            placeholder="Description"
            className={inputClass}
            value={item.description}
            onChange={(e) => updateItem(i, { description: e.target.value })}
          />
          <input
            placeholder="Qty"
            className={inputClass}
            value={item.quantity}
            onChange={(e) => updateItem(i, { quantity: e.target.value })}
          />
          <input
            placeholder="Unit price"
            className={inputClass}
            value={item.unit_price}
            onChange={(e) => updateItem(i, { unit_price: e.target.value })}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="text-slate-400 hover:text-red-600"
            aria-label="Remove line"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, emptyLineItem()])}
        className="text-sm font-medium text-brand-600 hover:underline"
      >
        + Add line
      </button>
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span>{formatZAR(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
          <span>{formatZAR(totals.vat_amount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900">
          <span>Total</span>
          <span>{formatZAR(totals.total)}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------
function QuotesTab() {
  const { rows: quotes, loading, error, refetch } = useTable<Quote>('quotes', 'issue_date', false)
  const { rows: clients } = useTable<Client>('clients', 'company_name', true)

  const [modalOpen, setModalOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [items, setItems] = useState<DraftLineItem[]>([emptyLineItem()])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? '—'

  function resetForm() {
    setClientId('')
    setExpiryDate('')
    setItems([emptyLineItem()])
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const validItems = items.filter((i) => i.description.trim())
    if (validItems.length === 0) {
      setFormError('Add at least one line item.')
      setSaving(false)
      return
    }
    const totals = computeTotals(validItems)
    const quoteNumber = `Q-${String(quotes.length + 1).padStart(4, '0')}`

    const { data: quote, error: quoteErr } = await supabase
      .from('quotes')
      .insert({
        client_id: clientId || null,
        quote_number: quoteNumber,
        expiry_date: expiryDate || null,
        subtotal: totals.subtotal,
        vat_amount: totals.vat_amount,
        total: totals.total,
      })
      .select()
      .single()

    if (quoteErr || !quote) {
      setFormError(quoteErr?.message ?? 'Could not create quote.')
      setSaving(false)
      return
    }

    const { error: lineErr } = await supabase.from('quote_line_items').insert(
      validItems.map((item) => ({
        quote_id: quote.id,
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
      })),
    )

    setSaving(false)
    if (lineErr) {
      setFormError(lineErr.message)
      return
    }

    await refetch()
    resetForm()
    setModalOpen(false)
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setModalOpen(true)}>New quote</Button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {quotes.length === 0 ? (
            <EmptyState message="No quotes yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Quote #</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Issued</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">{q.quote_number}</td>
                      <td className="px-5 py-3 text-slate-600">{clientName(q.client_id)}</td>
                      <td className="px-5 py-3 text-slate-600">{format(parseISO(q.issue_date), 'd MMM yyyy')}</td>
                      <td className="px-5 py-3">
                        <Badge value={q.status} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatZAR(Number(q.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New quote">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Client">
            <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">No client linked</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expiry date">
            <input
              type="date"
              className={inputClass}
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </Field>
          <LineItemsEditor items={items} onChange={setItems} />
          {formError && <ErrorState message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create quote'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
function InvoicesTab() {
  const { rows: invoices, loading, error, refetch, update } = useTable<Invoice>('invoices', 'issue_date', false)
  const { rows: clients } = useTable<Client>('clients', 'company_name', true)
  const { rows: routes } = useTable<Route>('routes', 'scheduled_date', false)

  const [modalOpen, setModalOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [routeId, setRouteId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState<DraftLineItem[]>([emptyLineItem()])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? '—'

  function resetForm() {
    setClientId('')
    setRouteId('')
    setDueDate('')
    setItems([emptyLineItem()])
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const validItems = items.filter((i) => i.description.trim())
    if (validItems.length === 0) {
      setFormError('Add at least one line item.')
      setSaving(false)
      return
    }
    const totals = computeTotals(validItems)
    const invoiceNumber = `INV-${String(invoices.length + 1).padStart(4, '0')}`

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        client_id: clientId || null,
        route_id: routeId || null,
        invoice_number: invoiceNumber,
        due_date: dueDate || null,
        subtotal: totals.subtotal,
        vat_amount: totals.vat_amount,
        total: totals.total,
      })
      .select()
      .single()

    if (invErr || !invoice) {
      setFormError(invErr?.message ?? 'Could not create invoice.')
      setSaving(false)
      return
    }

    const { error: lineErr } = await supabase.from('invoice_line_items').insert(
      validItems.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
      })),
    )

    setSaving(false)
    if (lineErr) {
      setFormError(lineErr.message)
      return
    }

    await refetch()
    resetForm()
    setModalOpen(false)
  }

  async function markPaid(invoice: Invoice) {
    await update(invoice.id, { status: 'paid', paid_at: format(new Date(), 'yyyy-MM-dd') } as Partial<Invoice>)
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setModalOpen(true)}>New invoice</Button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {invoices.length === 0 ? (
            <EmptyState message="No invoices yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Invoice #</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Issued</th>
                    <th className="px-5 py-3">Due</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">{inv.invoice_number}</td>
                      <td className="px-5 py-3 text-slate-600">{clientName(inv.client_id)}</td>
                      <td className="px-5 py-3 text-slate-600">{format(parseISO(inv.issue_date), 'd MMM yyyy')}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {inv.due_date ? format(parseISO(inv.due_date), 'd MMM yyyy') : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={inv.status} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatZAR(Number(inv.total))}</td>
                      <td className="px-5 py-3 text-right">
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => markPaid(inv)}
                            className="text-sm font-medium text-brand-600 hover:underline"
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New invoice">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Client">
            <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">No client linked</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Linked route (optional)">
            <select className={inputClass} value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              <option value="">None</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.origin} → {r.destination} ({format(parseISO(r.scheduled_date), 'd MMM')})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <LineItemsEditor items={items} onChange={setItems} />
          {formError && <ErrorState message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create invoice'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
const EXPENSE_CATEGORIES: ExpenseCategory[] = ['fuel', 'maintenance', 'tolls', 'fines', 'insurance', 'other']

const emptyExpenseForm = {
  vehicle_id: '',
  category: 'fuel' as ExpenseCategory,
  description: '',
  amount: '',
  expense_date: format(new Date(), 'yyyy-MM-dd'),
  odometer_km: '',
}

function ExpensesTab() {
  const { rows: expenses, loading, error, insert, remove } = useTable<Expense>('expenses', 'expense_date', false)
  const { rows: vehicles } = useTable<Vehicle>('vehicles', 'registration_number', true)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyExpenseForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const vehicleReg = (id: string | null) => vehicles.find((v) => v.id === id)?.registration_number ?? '—'
  const totalThisMonth = expenses
    .filter((e) => e.expense_date.startsWith(format(new Date(), 'yyyy-MM')))
    .reduce((sum, e) => sum + Number(e.amount), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    const result = await insert({
      vehicle_id: form.vehicle_id || null,
      category: form.category,
      description: form.description || null,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      odometer_km: form.odometer_km ? Number(form.odometer_km) : null,
    } as Partial<Expense>)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setForm(emptyExpenseForm)
    setModalOpen(false)
  }

  async function handleDelete(expense: Expense) {
    if (!confirm('Delete this expense?')) return
    await remove(expense.id)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          This month: <span className="font-semibold text-slate-900">{formatZAR(totalThisMonth)}</span>
        </p>
        <Button onClick={() => setModalOpen(true)}>Log expense</Button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {expenses.length === 0 ? (
            <EmptyState message="No expenses logged yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="px-5 py-3 text-slate-600">{format(parseISO(exp.expense_date), 'd MMM yyyy')}</td>
                      <td className="px-5 py-3 capitalize text-slate-600">{exp.category}</td>
                      <td className="px-5 py-3 text-slate-600">{vehicleReg(exp.vehicle_id)}</td>
                      <td className="px-5 py-3 text-slate-600">{exp.description || '—'}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{formatZAR(Number(exp.amount))}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(exp)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (ZAR)">
              <input
                required
                className={inputClass}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Vehicle (optional)">
            <select
              className={inputClass}
              value={form.vehicle_id}
              onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            >
              <option value="">Not linked to a vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration_number}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </Field>
            <Field label="Odometer (km, optional)">
              <input
                className={inputClass}
                value={form.odometer_km}
                onChange={(e) => setForm({ ...form, odometer_km: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Description">
            <input
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          {formError && <ErrorState message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Log expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
