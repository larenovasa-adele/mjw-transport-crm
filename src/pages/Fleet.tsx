import { useState, type FormEvent } from 'react'
import { useTable } from '../lib/useTable'
import type { ServiceCategory, ServiceRecord, Staff, Vehicle, VehicleStatus } from '../lib/types'
import { formatZAR } from '../lib/lineItems'
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

type Tab = 'vehicles' | 'service'

export default function Fleet() {
  const [tab, setTab] = useState<Tab>('vehicles')

  return (
    <div>
      <PageHeader title="Fleet" subtitle="Vehicles, licensing, and service history" />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm font-medium sm:w-fit">
        <button
          onClick={() => setTab('vehicles')}
          className={`rounded-md px-4 py-1.5 ${tab === 'vehicles' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
        >
          Vehicles
        </button>
        <button
          onClick={() => setTab('service')}
          className={`rounded-md px-4 py-1.5 ${tab === 'service' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
        >
          Service history
        </button>
      </div>

      {tab === 'vehicles' && <VehiclesTab />}
      {tab === 'service' && <ServiceHistoryTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
const STATUS_OPTIONS: VehicleStatus[] = ['active', 'in_maintenance', 'out_of_service', 'sold']

const emptyForm = {
  registration_number: '',
  make: '',
  model: '',
  year: '',
  vehicle_type: '',
  capacity_kg: '',
  status: 'active' as VehicleStatus,
  assigned_driver_id: '',
  license_disc_expiry: '',
  next_service_due: '',
  current_odometer_km: '',
  notes: '',
}

function VehiclesTab() {
  const { rows: vehicles, loading, error, insert, update, remove } = useTable<Vehicle>(
    'vehicles',
    'registration_number',
    true,
  )
  const { rows: staff } = useTable<Staff>('staff', 'full_name', true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(vehicle: Vehicle) {
    setEditing(vehicle)
    setForm({
      registration_number: vehicle.registration_number,
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      year: vehicle.year?.toString() ?? '',
      vehicle_type: vehicle.vehicle_type ?? '',
      capacity_kg: vehicle.capacity_kg?.toString() ?? '',
      status: vehicle.status,
      assigned_driver_id: vehicle.assigned_driver_id ?? '',
      license_disc_expiry: vehicle.license_disc_expiry ?? '',
      next_service_due: vehicle.next_service_due ?? '',
      current_odometer_km: vehicle.current_odometer_km?.toString() ?? '',
      notes: vehicle.notes ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const payload: Partial<Vehicle> = {
      registration_number: form.registration_number.trim(),
      make: form.make || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      vehicle_type: form.vehicle_type || null,
      capacity_kg: form.capacity_kg ? Number(form.capacity_kg) : null,
      status: form.status,
      assigned_driver_id: form.assigned_driver_id || null,
      license_disc_expiry: form.license_disc_expiry || null,
      next_service_due: form.next_service_due || null,
      current_odometer_km: form.current_odometer_km ? Number(form.current_odometer_km) : null,
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

  async function handleDelete(vehicle: Vehicle) {
    if (!confirm(`Remove ${vehicle.registration_number} from the fleet?`)) return
    await remove(vehicle.id)
  }

  const driverName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? '—'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>Add vehicle</Button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {vehicles.length === 0 ? (
            <EmptyState message="No vehicles yet. Add your first one to get started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Registration</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Driver</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">License expiry</th>
                    <th className="px-5 py-3">Next service</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {vehicle.registration_number}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{driverName(vehicle.assigned_driver_id)}</td>
                      <td className="px-5 py-3">
                        <Badge value={vehicle.status} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{vehicle.license_disc_expiry ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{vehicle.next_service_due ?? '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openEdit(vehicle)}
                          className="mr-3 text-sm font-medium text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit vehicle' : 'Add vehicle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration number">
              <input
                required
                className={inputClass}
                value={form.registration_number}
                onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Year">
              <input
                className={inputClass}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              />
            </Field>
            <Field label="Make">
              <input
                className={inputClass}
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
              />
            </Field>
            <Field label="Model">
              <input
                className={inputClass}
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vehicle type">
              <input
                placeholder="horse, trailer, rigid, bakkie…"
                className={inputClass}
                value={form.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
              />
            </Field>
            <Field label="Capacity (kg)">
              <input
                className={inputClass}
                value={form.capacity_kg}
                onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Assigned driver">
            <select
              className={inputClass}
              value={form.assigned_driver_id}
              onChange={(e) => setForm({ ...form, assigned_driver_id: e.target.value })}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="License disc expiry">
              <input
                type="date"
                className={inputClass}
                value={form.license_disc_expiry}
                onChange={(e) => setForm({ ...form, license_disc_expiry: e.target.value })}
              />
            </Field>
            <Field label="Next service due">
              <input
                type="date"
                className={inputClass}
                value={form.next_service_due}
                onChange={(e) => setForm({ ...form, next_service_due: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Current odometer (km)">
            <input
              className={inputClass}
              value={form.current_odometer_km}
              onChange={(e) => setForm({ ...form, current_odometer_km: e.target.value })}
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
              {saving ? 'Saving…' : 'Save vehicle'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Service history
// ---------------------------------------------------------------------------
const SERVICE_CATEGORIES: ServiceCategory[] = ['service', 'repair', 'inspection', 'other']

const emptyServiceForm = {
  vehicle_id: '',
  service_date: format(new Date(), 'yyyy-MM-dd'),
  odometer_km: '',
  category: 'service' as ServiceCategory,
  workshop: '',
  cost: '',
  description: '',
}

function ServiceHistoryTab() {
  const { rows: records, loading, error, insert, remove } = useTable<ServiceRecord>(
    'service_records',
    'service_date',
    false,
  )
  const { rows: vehicles } = useTable<Vehicle>('vehicles', 'registration_number', true)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyServiceForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const vehicleReg = (id: string) => vehicles.find((v) => v.id === id)?.registration_number ?? '—'
  const totalThisYear = records
    .filter((r) => r.service_date.startsWith(format(new Date(), 'yyyy')))
    .reduce((sum, r) => sum + Number(r.cost), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.vehicle_id) {
      setFormError('Select a vehicle.')
      return
    }
    setSaving(true)
    setFormError(null)
    const result = await insert({
      vehicle_id: form.vehicle_id,
      service_date: form.service_date,
      odometer_km: form.odometer_km ? Number(form.odometer_km) : null,
      category: form.category,
      workshop: form.workshop || null,
      cost: form.cost ? Number(form.cost) : 0,
      description: form.description || null,
    } as Partial<ServiceRecord>)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setForm(emptyServiceForm)
    setModalOpen(false)
  }

  async function handleDelete(record: ServiceRecord) {
    if (!confirm('Delete this service record?')) return
    await remove(record.id)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          This year: <span className="font-semibold text-slate-900">{formatZAR(totalThisYear)}</span>
        </p>
        <Button onClick={() => setModalOpen(true)}>Log service/repair</Button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {records.length === 0 ? (
            <EmptyState message="No service or repair history logged yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Workshop</th>
                    <th className="px-5 py-3">Odometer</th>
                    <th className="px-5 py-3">Cost</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 text-slate-600">{format(parseISO(r.service_date), 'd MMM yyyy')}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{vehicleReg(r.vehicle_id)}</td>
                      <td className="px-5 py-3 capitalize text-slate-600">{r.category}</td>
                      <td className="px-5 py-3 text-slate-600">{r.workshop || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {r.odometer_km != null ? `${Number(r.odometer_km).toLocaleString()} km` : '—'}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">{formatZAR(Number(r.cost))}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(r)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log service/repair">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Vehicle">
            <select
              required
              className={inputClass}
              value={form.vehicle_id}
              onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            >
              <option value="">Select a vehicle…</option>
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
                value={form.service_date}
                onChange={(e) => setForm({ ...form, service_date: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ServiceCategory })}
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Odometer (km)">
              <input
                className={inputClass}
                value={form.odometer_km}
                onChange={(e) => setForm({ ...form, odometer_km: e.target.value })}
              />
            </Field>
            <Field label="Cost (ZAR)">
              <input
                className={inputClass}
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Workshop">
            <input
              className={inputClass}
              value={form.workshop}
              onChange={(e) => setForm({ ...form, workshop: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass}
              rows={2}
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
              {saving ? 'Saving…' : 'Log record'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
