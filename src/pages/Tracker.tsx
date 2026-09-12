import { useMemo, useState, type FormEvent } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useTable } from '../lib/useTable'
import type { Staff, Trip, TripStatus, Vehicle, VehiclePosition } from '../lib/types'
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
import { Link } from 'react-router-dom'

// Vite bundles leaflet's default marker images under a hashed path; the
// library's own icon URLs assume a classic asset pipeline, so we point it at
// the bundled files explicitly. Without this the markers render as broken images.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Default map center: Paarl, Western Cape (used until real positions exist).
const DEFAULT_CENTER: [number, number] = [-33.7346, 18.9621]

const TRIP_STATUS_OPTIONS: TripStatus[] = ['planned', 'in_progress', 'completed', 'cancelled']

const emptyPositionForm = {
  vehicle_id: '',
  latitude: '',
  longitude: '',
  speed_kmh: '',
  source: 'manual',
}

const emptyTripForm = {
  vehicle_id: '',
  driver_id: '',
  status: 'planned' as TripStatus,
  start_time: '',
  end_time: '',
  start_odometer_km: '',
  end_odometer_km: '',
  start_location: '',
  end_location: '',
  notes: '',
}

export default function Tracker() {
  const { rows: vehicles } = useTable<Vehicle>('vehicles', 'registration_number', true)
  const { rows: staffList } = useTable<Staff>('staff', 'full_name', true)
  const {
    rows: positions,
    loading: positionsLoading,
    error: positionsError,
    insert: insertPosition,
  } = useTable<VehiclePosition>('vehicle_positions', 'recorded_at', false)
  const {
    rows: trips,
    loading: tripsLoading,
    error: tripsError,
    insert: insertTrip,
    update: updateTrip,
  } = useTable<Trip>('trips', 'created_at', false)

  const [tab, setTab] = useState<'map' | 'log'>('map')
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [tripModalOpen, setTripModalOpen] = useState(false)
  const [positionForm, setPositionForm] = useState(emptyPositionForm)
  const [tripForm, setTripForm] = useState(emptyTripForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Latest known position per vehicle (positions are already ordered newest first).
  const latestByVehicle = useMemo(() => {
    const map = new Map<string, VehiclePosition>()
    for (const p of positions) {
      if (!map.has(p.vehicle_id)) map.set(p.vehicle_id, p)
    }
    return map
  }, [positions])

  const vehicleReg = (id: string | null) => vehicles.find((v) => v.id === id)?.registration_number ?? '—'

  async function handlePositionSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    const result = await insertPosition({
      vehicle_id: positionForm.vehicle_id,
      latitude: Number(positionForm.latitude),
      longitude: Number(positionForm.longitude),
      speed_kmh: positionForm.speed_kmh ? Number(positionForm.speed_kmh) : null,
      source: positionForm.source,
      recorded_at: new Date().toISOString(),
    } as Partial<VehiclePosition>)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setPositionForm(emptyPositionForm)
    setPositionModalOpen(false)
  }

  async function handleTripSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    const payload: Partial<Trip> = {
      vehicle_id: tripForm.vehicle_id,
      driver_id: tripForm.driver_id || null,
      status: tripForm.status,
      start_time: tripForm.start_time ? new Date(tripForm.start_time).toISOString() : null,
      end_time: tripForm.end_time ? new Date(tripForm.end_time).toISOString() : null,
      start_odometer_km: tripForm.start_odometer_km ? Number(tripForm.start_odometer_km) : null,
      end_odometer_km: tripForm.end_odometer_km ? Number(tripForm.end_odometer_km) : null,
      start_location: tripForm.start_location || null,
      end_location: tripForm.end_location || null,
      notes: tripForm.notes || null,
    }
    const result = await insertTrip(payload)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setTripForm(emptyTripForm)
    setTripModalOpen(false)
  }

  const mapCenter: [number, number] =
    positions.length > 0 ? [Number(positions[0].latitude), Number(positions[0].longitude)] : DEFAULT_CENTER

  return (
    <div>
      <PageHeader
        title="Tracker"
        subtitle="Vehicle positions and trip log"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPositionModalOpen(true)}>
              Log position
            </Button>
            <Button onClick={() => setTripModalOpen(true)}>Log trip</Button>
          </div>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm font-medium sm:w-fit">
        <button
          onClick={() => setTab('map')}
          className={`rounded-md px-4 py-1.5 ${tab === 'map' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
        >
          Live map
        </button>
        <button
          onClick={() => setTab('log')}
          className={`rounded-md px-4 py-1.5 ${tab === 'log' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
        >
          Trip log
        </button>
      </div>

      <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No live GPS/telematics provider is connected yet — positions below are logged manually. Once Marius
        confirms which tracker MJW Transport uses (e.g. Cartrack, Netstar, MiX Telematics), connect it in{' '}
        <Link to="/settings" className="font-medium underline">
          Settings
        </Link>{' '}
        to have positions populate automatically instead.
      </Card>

      {tab === 'map' && (
        <Card className="overflow-hidden">
          {positionsError && <ErrorState message={positionsError} />}
          <div style={{ height: '480px' }}>
            <MapContainer center={mapCenter} zoom={9} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {Array.from(latestByVehicle.values()).map((pos) => (
                <Marker key={pos.vehicle_id} position={[Number(pos.latitude), Number(pos.longitude)]}>
                  <Popup>
                    <strong>{vehicleReg(pos.vehicle_id)}</strong>
                    <br />
                    {format(parseISO(pos.recorded_at), 'd MMM HH:mm')}
                    {pos.speed_kmh != null && (
                      <>
                        <br />
                        {pos.speed_kmh} km/h
                      </>
                    )}
                    <br />
                    <span className="text-slate-500">source: {pos.source}</span>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          {latestByVehicle.size === 0 && !positionsLoading && (
            <div className="p-4">
              <EmptyState message="No positions logged yet. Use “Log position” to add one." />
            </div>
          )}
        </Card>
      )}

      {tab === 'log' && (
        <Card>
          {tripsLoading && <LoadingState />}
          {tripsError && <ErrorState message={tripsError} />}
          {!tripsLoading && !tripsError && trips.length === 0 && (
            <EmptyState message="No trips logged yet." />
          )}
          {!tripsLoading && !tripsError && trips.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Start</th>
                    <th className="px-5 py-3">End</th>
                    <th className="px-5 py-3">Route</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trips.map((trip) => (
                    <tr key={trip.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">{vehicleReg(trip.vehicle_id)}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {trip.start_time ? format(parseISO(trip.start_time), 'd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {trip.end_time ? format(parseISO(trip.end_time), 'd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {[trip.start_location, trip.end_location].filter(Boolean).join(' → ') || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={trip.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {trip.status !== 'completed' && (
                          <button
                            onClick={() =>
                              updateTrip(trip.id, {
                                status: 'completed',
                                end_time: new Date().toISOString(),
                              } as Partial<Trip>)
                            }
                            className="text-sm font-medium text-brand-600 hover:underline"
                          >
                            Mark completed
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

      <Modal open={positionModalOpen} onClose={() => setPositionModalOpen(false)} title="Log a position">
        <form onSubmit={handlePositionSubmit} className="space-y-4">
          <Field label="Vehicle">
            <select
              required
              className={inputClass}
              value={positionForm.vehicle_id}
              onChange={(e) => setPositionForm({ ...positionForm, vehicle_id: e.target.value })}
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
            <Field label="Latitude">
              <input
                required
                className={inputClass}
                placeholder="-33.7346"
                value={positionForm.latitude}
                onChange={(e) => setPositionForm({ ...positionForm, latitude: e.target.value })}
              />
            </Field>
            <Field label="Longitude">
              <input
                required
                className={inputClass}
                placeholder="18.9621"
                value={positionForm.longitude}
                onChange={(e) => setPositionForm({ ...positionForm, longitude: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Speed (km/h, optional)">
            <input
              className={inputClass}
              value={positionForm.speed_kmh}
              onChange={(e) => setPositionForm({ ...positionForm, speed_kmh: e.target.value })}
            />
          </Field>
          {formError && <ErrorState message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPositionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Log position'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={tripModalOpen} onClose={() => setTripModalOpen(false)} title="Log a trip">
        <form onSubmit={handleTripSubmit} className="space-y-4">
          <Field label="Vehicle">
            <select
              required
              className={inputClass}
              value={tripForm.vehicle_id}
              onChange={(e) => setTripForm({ ...tripForm, vehicle_id: e.target.value })}
            >
              <option value="">Select a vehicle…</option>
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
              value={tripForm.driver_id}
              onChange={(e) => setTripForm({ ...tripForm, driver_id: e.target.value })}
            >
              <option value="">Unassigned</option>
              {staffList
                .filter((s) => s.role === 'driver')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start location">
              <input
                className={inputClass}
                value={tripForm.start_location}
                onChange={(e) => setTripForm({ ...tripForm, start_location: e.target.value })}
              />
            </Field>
            <Field label="End location">
              <input
                className={inputClass}
                value={tripForm.end_location}
                onChange={(e) => setTripForm({ ...tripForm, end_location: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <input
                type="datetime-local"
                className={inputClass}
                value={tripForm.start_time}
                onChange={(e) => setTripForm({ ...tripForm, start_time: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={tripForm.status}
                onChange={(e) => setTripForm({ ...tripForm, status: e.target.value as TripStatus })}
              >
                {TRIP_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start odometer (km)">
              <input
                className={inputClass}
                value={tripForm.start_odometer_km}
                onChange={(e) => setTripForm({ ...tripForm, start_odometer_km: e.target.value })}
              />
            </Field>
            <Field label="End odometer (km)">
              <input
                className={inputClass}
                value={tripForm.end_odometer_km}
                onChange={(e) => setTripForm({ ...tripForm, end_odometer_km: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              className={inputClass}
              rows={2}
              value={tripForm.notes}
              onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
            />
          </Field>
          {formError && <ErrorState message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTripModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Log trip'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
