import { useState, type FormEvent } from 'react'
import { useTable } from '../lib/useTable'
import type { Client } from '../lib/types'
import {
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

const emptyForm = {
  company_name: '',
  contact_name: '',
  phone: '',
  email: '',
  billing_address: '',
  vat_number: '',
  notes: '',
}

export default function Clients() {
  const { rows: clients, loading, error, insert, update, remove } = useTable<Client>(
    'clients',
    'company_name',
    true,
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setEditing(client)
    setForm({
      company_name: client.company_name,
      contact_name: client.contact_name ?? '',
      phone: client.phone ?? '',
      email: client.email ?? '',
      billing_address: client.billing_address ?? '',
      vat_number: client.vat_number ?? '',
      notes: client.notes ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const payload: Partial<Client> = {
      company_name: form.company_name.trim(),
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      billing_address: form.billing_address || null,
      vat_number: form.vat_number || null,
      notes: form.notes || null,
    }

    const result = editing ? await update(editing.id, payload) : await insert(payload)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setModalOpen(false)
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Remove ${client.company_name}?`)) return
    await remove(client.id)
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Companies MJW Transport moves freight for"
        action={<Button onClick={openCreate}>Add client</Button>}
      />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {clients.length === 0 ? (
            <EmptyState message="No clients yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Company</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Phone / Email</th>
                    <th className="px-5 py-3">VAT number</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">{client.company_name}</td>
                      <td className="px-5 py-3 text-slate-600">{client.contact_name || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {[client.phone, client.email].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{client.vat_number || '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openEdit(client)}
                          className="mr-3 text-sm font-medium text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(client)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit client' : 'Add client'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Company name">
            <input
              required
              className={inputClass}
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </Field>
          <Field label="Contact name">
            <input
              className={inputClass}
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Billing address">
            <textarea
              className={inputClass}
              rows={2}
              value={form.billing_address}
              onChange={(e) => setForm({ ...form, billing_address: e.target.value })}
            />
          </Field>
          <Field label="VAT number">
            <input
              className={inputClass}
              value={form.vat_number}
              onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {formError && <ErrorState message={formError} />}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save client'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
