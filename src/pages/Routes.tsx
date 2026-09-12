import { useState, type FormEvent } from 'react'
import { useTable } from '../lib/useTable'
import type { Client, Route as RouteRecord, RouteStatus, Staff, Vehicle } from '../lib/types'
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

const STATUS_OPTIONS: RouteStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled', 'delayed']

const emptyForm = {
  client_id: '',
  vehicle_id: '',
  driver_id: '',
  origin: '',
  destination: '',
  scheduled_date: format(new Date(), 'yyyy-MM-dd'),
  scheduled_time: '',
  distance_km: '',
  cargo_description: '',
  status: 'scheduled' as RouteStatus,
  rate: '',
  notes: '',
}

export default function RoutesPage() {
  const { rows: routes, loading, error, insert, update, remove } = useTable<RouteRecord>(
    'routes',
    'scheduled_date',
    false,
  )
  const { rows: clients } = useTable<Client>('clients', 'company_name', true)
  const { rows: vehicles } = useTable<Vehicle>('vehicles', 'registration_number', true)
  const { rows: staff } = useTable<Staff>('staff', 'full_name', true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RouteRecord | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(route: RouteRecord) {
    setEditing(route)
    setForm({
      client_id: route.client_id ?? '',
      vehicle_id: route.vehicle_id ?? '',
      driver_id: route.driver_id ?? '',
      origin: route.origin,
      destination: route.destination,
      scheduled_date: route.scheduled_date,
      scheduled_time: route.scheduled_time ?? '',
      distance_km: route.distance_km?.toString() ?? '',
      cargo_description: route.cargo_description ?? '',
      status: route.status,
      rate: route.rate?.toString() ?? '',
      notes: route.notes ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const payload: Partial<RouteRecord> = {
      client_id: form.client_id || null,
      vehicle_id: form.vehicle_id || null,
      driver_id: form.driver_id || null,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time || null,
      distance_km: form.distance_km ? Number(form.distance_km) : null,
      cargo_description: form.cargo_description || null,
      status: form.status,
      rate: form.rate ? Number(form.rate) : null,
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

  async function handleDelete(route: RouteRecord) {
    if (!confirm(`Remove the ${route.origin} → ${route.destination} route?`)) return
    await remove(route.id)
  }

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? '—'
  const vehicleReg = (id: string | null) => vehicles.find((v) => v.id === id)?.registration_number ?? '—'
  const driverName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? '—'

  return (
    <div>
      <PageHeader
        title="Routes"
        subtitle="Scheduled and in-progress jobs"
        action={<Button onClick={openCreate}>Add route</Button>}
      />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {routes.length === 0 ? (
            <EmptyState message="No routes scheduled yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Route</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Driver</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Rate</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routes.map((route) => (
                    <tr key={route.id}>
                      <td className="px-5 py-3 text-slate-600">
                        {format(parseISO(route.scheduled_date), 'd MMM yyyy')}
                        {route.scheduled_time ? ` · ${route.scheduled_time}` : ''}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {route.origin} → {route.destination}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{clientName(route.client_id)}</td>
                      <td className="px-5 py-3 text-slate-600">{vehicleReg(route.vehicle_id)}</td>
                      <td className="px-5 py-3 text-slate-600">{driverName(route.driver_id)}</td>
                      <td className="px-5 py-3">
                        <Badge value={route.status} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {route.rate ? `R ${Number(route.rate).toLocaleString('en-ZA')}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openEdit(route)}
                          className="mr-3 text-sm font-medium text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(route)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit route' : 'Add route'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origin">
              <input
                required
                className={inputClass}
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
              />
            </Field>
            <Field label="Destination">
              <input
                required
                className={inputClass}
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scheduled date">
              <input
                type="date"
                required
                className={inputClass}
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              />
            </Field>
            <Field label="Scheduled time">
              <input
                type="time"
                className={inputClass}
                value={form.scheduled_time}
                onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Client">
            <select
              className={inputClass}
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">No client linked</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vehicle">
              <select
                className={inputClass}
                value={form.vehicle_id}
                onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
              >
                <option value="">Unassigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration_number}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Driver">
              <select
                className={inputClass}
                value={form.driver_id}
                onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
              >
                <option value="">Unassigned</option>
                {staff
                  .filter((s) => s.role === 'driver')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance (km)">
              <input
                className={inputClass}
                value={form.distance_km}
                onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
              />
            </Field>
            <Field label="Rate (ZAR)">
              <input
                className={inputClass}
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Status">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as RouteStatus })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cargo description">
            <input
              className={inputClass}
              value={form.cargo_description}
              onChange={(e) => setForm({ ...form, cargo_description: e.target.value })}
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
              {saving ? 'Saving…' : 'Save route'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
