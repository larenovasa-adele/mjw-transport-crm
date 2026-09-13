import { useMemo, useState, type FormEvent } from 'react'
import { useTable } from '../lib/useTable'
import type { Tyre, TyreInspection, Vehicle } from '../lib/types'
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

const emptyTyreForm = {
  vehicle_id: '',
  position: '',
  brand: '',
  size: '',
  serial_number: '',
  install_date: format(new Date(), 'yyyy-MM-dd'),
  install_odometer_km: '',
  cost: '',
}

const emptyInspectionForm = {
  inspected_at: format(new Date(), 'yyyy-MM-dd'),
  tread_depth_mm: '',
  pressure_kpa: '',
  notes: '',
}

const emptyRemoveForm = {
  removed_date: format(new Date(), 'yyyy-MM-dd'),
  removed_odometer_km: '',
  removal_reason: '',
  status: 'removed' as 'removed' | 'scrapped',
}

export default function Tyres() {
  const { rows: tyres, loading, error, insert, update, refetch } = useTable<Tyre>('tyres', 'created_at', false)
  const { rows: vehicles } = useTable<Vehicle>('vehicles', 'registration_number', true)
  const { rows: inspections, insert: insertInspection } = useTable<TyreInspection>(
    'tyre_inspections',
    'inspected_at',
    false,
  )

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyTyreForm)
  const [inspectingTyre, setInspectingTyre] = useState<Tyre | null>(null)
  const [inspectionForm, setInspectionForm] = useState(emptyInspectionForm)
  const [removingTyre, setRemovingTyre] = useState<Tyre | null>(null)
  const [removeForm, setRemoveForm] = useState(emptyRemoveForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [vehicleFilter, setVehicleFilter] = useState('')

  const vehicleReg = (id: string) => vehicles.find((v) => v.id === id)?.registration_number ?? '—'

  const latestReadingByTyre = useMemo(() => {
    const map = new Map<string, TyreInspection>()
    for (const insp of inspections) {
      if (!map.has(insp.tyre_id)) map.set(insp.tyre_id, insp) // inspections already ordered newest first
    }
    return map
  }, [inspections])

  function costPerKm(tyre: Tyre): number | null {
    if (!tyre.cost || tyre.install_odometer_km == null) return null
    const vehicle = vehicles.find((v) => v.id === tyre.vehicle_id)
    const endOdometer =
      tyre.status === 'fitted' ? vehicle?.current_odometer_km ?? null : tyre.removed_odometer_km
    if (endOdometer == null) return null
    const distance = Number(endOdometer) - Number(tyre.install_odometer_km)
    if (distance <= 0) return null
    return Number(tyre.cost) / distance
  }

  const visibleTyres = vehicleFilter ? tyres.filter((t) => t.vehicle_id === vehicleFilter) : tyres

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault()
    if (!addForm.vehicle_id || !addForm.position.trim()) {
      setFormError('Select a vehicle and enter a tyre position.')
      return
    }
    setSaving(true)
    setFormError(null)
    const result = await insert({
      vehicle_id: addForm.vehicle_id,
      position: addForm.position.trim(),
      brand: addForm.brand || null,
      size: addForm.size || null,
      serial_number: addForm.serial_number || null,
      status: 'fitted',
      install_date: addForm.install_date || null,
      install_odometer_km: addForm.install_odometer_km ? Number(addForm.install_odometer_km) : null,
      cost: addForm.cost ? Number(addForm.cost) : null,
      retread_count: 0,
    } as Partial<Tyre>)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setAddForm(emptyTyreForm)
    setAddOpen(false)
  }

  async function handleInspectionSubmit(e: FormEvent) {
    e.preventDefault()
    if (!inspectingTyre) return
    setSaving(true)
    setFormError(null)
    const result = await insertInspection({
      tyre_id: inspectingTyre.id,
      inspected_at: inspectionForm.inspected_at,
      tread_depth_mm: inspectionForm.tread_depth_mm ? Number(inspectionForm.tread_depth_mm) : null,
      pressure_kpa: inspectionForm.pressure_kpa ? Number(inspectionForm.pressure_kpa) : null,
      notes: inspectionForm.notes || null,
    } as Partial<TyreInspection>)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setInspectionForm(emptyInspectionForm)
    setInspectingTyre(null)
  }

  async function handleRemoveSubmit(e: FormEvent) {
    e.preventDefault()
    if (!removingTyre) return
    setSaving(true)
    setFormError(null)
    const result = await update(removingTyre.id, {
      status: removeForm.status,
      removed_date: removeForm.removed_date || null,
      removed_odometer_km: removeForm.removed_odometer_km ? Number(removeForm.removed_odometer_km) : null,
      removal_reason: removeForm.removal_reason || null,
    } as Partial<Tyre>)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setRemoveForm(emptyRemoveForm)
    setRemovingTyre(null)
    await refetch()
  }

  return (
    <div>
      <PageHeader
        title="Tyres"
        subtitle="Per-tyre tracking: fitment, tread depth, and cost per km"
        action={<Button onClick={() => setAddOpen(true)}>Add tyre</Button>}
      />

      <div className="mb-4">
        <select
          className={`${inputClass} sm:w-64`}
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
        >
          <option value="">All vehicles</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registration_number}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <Card>
          {visibleTyres.length === 0 ? (
            <EmptyState message="No tyres logged yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Position</th>
                    <th className="px-5 py-3">Brand / size</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Latest tread</th>
                    <th className="px-5 py-3">Cost / km</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleTyres.map((tyre) => {
                    const latest = latestReadingByTyre.get(tyre.id)
                    const cpk = costPerKm(tyre)
                    return (
                      <tr key={tyre.id}>
                        <td className="px-5 py-3 font-medium text-slate-900">{vehicleReg(tyre.vehicle_id)}</td>
                        <td className="px-5 py-3 text-slate-600">{tyre.position}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {[tyre.brand, tyre.size].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-5 py-3">
                          <Badge value={tyre.status} />
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {latest?.tread_depth_mm != null ? (
                            <>
                              {Number(latest.tread_depth_mm)} mm
                              <span className="ml-1 text-xs text-slate-400">
                                ({format(parseISO(latest.inspected_at), 'd MMM')})
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {cpk != null ? `R ${cpk.toFixed(2)}/km` : '—'}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setFormError(null)
                              setInspectingTyre(tyre)
                            }}
                            className="mr-3 text-sm font-medium text-brand-600 hover:underline"
                          >
                            Log inspection
                          </button>
                          {tyre.status === 'fitted' && (
                            <button
                              onClick={() => {
                                setFormError(null)
                                setRemovingTyre(tyre)
                              }}
                              className="text-sm font-medium text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add tyre">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Field label="Vehicle">
            <select
              required
              className={inputClass}
              value={addForm.vehicle_id}
              onChange={(e) => setAddForm({ ...addForm, vehicle_id: e.target.value })}
            >
              <option value="">Select a vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Position">
            <input
              required
              placeholder="e.g. Front left, Rear right outer"
              className={inputClass}
              value={addForm.position}
              onChange={(e) => setAddForm({ ...addForm, position: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand">
              <input
                className={inputClass}
                value={addForm.brand}
                onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
              />
            </Field>
            <Field label="Size">
              <input
                placeholder="e.g. 295/80R22.5"
                className={inputClass}
                value={addForm.size}
                onChange={(e) => setAddForm({ ...addForm, size: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Serial number (optional)">
            <input
              className={inputClass}
              value={addForm.serial_number}
              onChange={(e) => setAddForm({ ...addForm, serial_number: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Install date">
              <input
                type="date"
                className={inputClass}
                value={addForm.install_date}
                onChange={(e) => setAddForm({ ...addForm, install_date: e.target.value })}
              />
            </Field>
            <Field label="Install odometer (km)">
              <input
                className={inputClass}
                value={addForm.install_odometer_km}
                onChange={(e) => setAddForm({ ...addForm, install_odometer_km: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Cost (ZAR)">
            <input
              className={inputClass}
              value={addForm.cost}
              onChange={(e) => setAddForm({ ...addForm, cost: e.target.value })}
            />
          </Field>
          {formError && <ErrorState message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add tyre'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={inspectingTyre != null}
        onClose={() => setInspectingTyre(null)}
        title={`Log inspection — ${inspectingTyre?.position ?? ''}`}
      >
        <form onSubmit={handleInspectionSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={inspectionForm.inspected_at}
                onChange={(e) => setInspectionForm({ ...inspectionForm, inspected_at: e.target.value })}
              />
            </Field>
            <Field label="Tread depth (mm)">
              <input
                className={inputClass}
                value={inspectionForm.tread_depth_mm}
                onChange={(e) => setInspectionForm({ ...inspectionForm, tread_depth_mm: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Pressure (kPa, optional)">
            <input
              className={inputClass}
              value={inspectionForm.pressure_kpa}
              onChange={(e) => setInspectionForm({ ...inspectionForm, pressure_kpa: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className={inputClass}
              rows={2}
              value={inspectionForm.notes}
              onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
            />
          </Field>
          {formError && <ErrorState message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setInspectingTyre(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Log inspection'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={removingTyre != null}
        onClose={() => setRemovingTyre(null)}
        title={`Remove tyre — ${removingTyre?.position ?? ''}`}
      >
        <form onSubmit={handleRemoveSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Removed date">
              <input
                type="date"
                className={inputClass}
                value={removeForm.removed_date}
                onChange={(e) => setRemoveForm({ ...removeForm, removed_date: e.target.value })}
              />
            </Field>
            <Field label="Odometer at removal (km)">
              <input
                className={inputClass}
                value={removeForm.removed_odometer_km}
                onChange={(e) => setRemoveForm({ ...removeForm, removed_odometer_km: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Outcome">
            <select
              className={inputClass}
              value={removeForm.status}
              onChange={(e) => setRemoveForm({ ...removeForm, status: e.target.value as 'removed' | 'scrapped' })}
            >
              <option value="removed">Removed (still usable — e.g. sent for retreading)</option>
              <option value="scrapped">Scrapped (end of life)</option>
            </select>
          </Field>
          <Field label="Reason">
            <input
              className={inputClass}
              value={removeForm.removal_reason}
              onChange={(e) => setRemoveForm({ ...removeForm, removal_reason: e.target.value })}
              placeholder="e.g. worn out, puncture, sidewall damage"
            />
          </Field>
          {formError && <ErrorState message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setRemovingTyre(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Confirm removal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
