import { useState, type FormEvent } from 'react'
import { useTable } from '../lib/useTable'
import type { Staff as StaffMember, StaffRole, StaffStatus } from '../lib/types'
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

const ROLE_OPTIONS: StaffRole[] = ['driver', 'dispatcher', 'mechanic', 'admin', 'owner']
const STATUS_OPTIONS: StaffStatus[] = ['active', 'on_leave', 'suspended', 'terminated']

const emptyForm = {
  full_name: '',
  role: 'driver' as StaffRole,
  status: 'active' as StaffStatus,
  phone: '',
  email: '',
  drivers_license_code: '',
  drivers_license_expiry: '',
  pdp_expiry: '',
  hire_date: '',
  monthly_salary: '',
  notes: '',
}

export default function Staff() {
  const { rows: staff, loading, error, insert, update, remove } = useTable<StaffMember>(
    'staff',
    'full_name',
    true,
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(member: StaffMember) {
    setEditing(member)
    setForm({
      full_name: member.full_name,
      role: member.role,
      status: member.status,
      phone: member.phone ?? '',
      email: member.email ?? '',
      drivers_license_code: member.drivers_license_code ?? '',
      drivers_license_expiry: member.drivers_license_expiry ?? '',
      pdp_expiry: member.pdp_expiry ?? '',
      hire_date: member.hire_date ?? '',
      monthly_salary: member.monthly_salary?.toString() ?? '',
      notes: member.notes ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const payload: Partial<StaffMember> = {
      full_name: form.full_name.trim(),
      role: form.role,
      status: form.status,
      phone: form.phone || null,
      email: form.email || null,
      drivers_license_code: form.drivers_license_code || null,
      drivers_license_expiry: form.drivers_license_expiry || null,
      pdp_expiry: form.pdp_expiry || null,
      hire_date: form.hire_date || null,
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null,
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

  async function handleDelete(member: StaffMember) {
    if (!confirm(`Remove ${member.full_name} from staff?`)) return
    await remove(member.id)
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Drivers, dispatchers, mechanics, and admin"
        action={<Button onClick={openCreate}>Add staff member</Button>}
      />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {staff.length === 0 ? (
            <EmptyState message="No staff on file yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">License</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">{member.full_name}</td>
                      <td className="px-5 py-3 capitalize text-slate-600">{member.role}</td>
                      <td className="px-5 py-3">
                        <Badge value={member.status} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{member.phone || member.email || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {member.drivers_license_code
                          ? `${member.drivers_license_code}${
                              member.drivers_license_expiry ? ` (exp. ${member.drivers_license_expiry})` : ''
                            }`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openEdit(member)}
                          className="mr-3 text-sm font-medium text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit staff member' : 'Add staff member'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name">
            <input
              required
              className={inputClass}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <select
                className={inputClass}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StaffStatus })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Driver's license code">
              <input
                placeholder="e.g. C1, EC"
                className={inputClass}
                value={form.drivers_license_code}
                onChange={(e) => setForm({ ...form, drivers_license_code: e.target.value })}
              />
            </Field>
            <Field label="License expiry">
              <input
                type="date"
                className={inputClass}
                value={form.drivers_license_expiry}
                onChange={(e) => setForm({ ...form, drivers_license_expiry: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PDP expiry">
              <input
                type="date"
                className={inputClass}
                value={form.pdp_expiry}
                onChange={(e) => setForm({ ...form, pdp_expiry: e.target.value })}
              />
            </Field>
            <Field label="Hire date">
              <input
                type="date"
                className={inputClass}
                value={form.hire_date}
                onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Monthly salary (ZAR, optional)">
            <input
              className={inputClass}
              value={form.monthly_salary}
              onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })}
              placeholder="e.g. 12000"
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
              {saving ? 'Saving…' : 'Save staff member'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
