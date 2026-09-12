import { useMemo, useState, type ChangeEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTable } from '../lib/useTable'
import { supabase } from '../lib/supabase'
import type { Trip, Vehicle } from '../lib/types'
import { Badge, Button, Card, EmptyState, ErrorState, Field, inputClass, LoadingState } from '../components/ui'
import { format, parseISO } from 'date-fns'

type CaptureState = { trip: Trip; stage: 'start' | 'end' } | null

/**
 * Mobile-first page for drivers: their assigned trips, and a "take a photo
 * of the dashboard" flow at trip start/end that logs the odometer reading
 * alongside it. No sidebar/full-CRM chrome — this is what a driver-role
 * login lands on instead of the Dashboard (see App.tsx).
 */
export default function Driver() {
  const { user, staff, staffLoading, signOut } = useAuth()
  const { rows: vehicles } = useTable<Vehicle>('vehicles', 'registration_number', true)
  const { rows: trips, loading, error, refetch } = useTable<Trip>('trips', 'created_at', false)

  const [capture, setCapture] = useState<CaptureState>(null)

  const myTrips = useMemo(() => (staff ? trips.filter((t) => t.driver_id === staff.id) : []), [trips, staff])
  const active = myTrips.filter((t) => t.status === 'planned' || t.status === 'in_progress')
  const past = myTrips.filter((t) => t.status === 'completed' || t.status === 'cancelled')

  const vehicleReg = (id: string) => vehicles.find((v) => v.id === id)?.registration_number ?? '—'

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="font-semibold text-slate-900">{staff?.full_name ?? user?.email}</p>
          </div>
          <button onClick={() => signOut()} className="text-sm font-medium text-brand-600">
            Sign out
          </button>
        </div>

        {!staffLoading && !staff && (
          <ErrorState message="No driver profile is linked to this login yet. Ask your admin to set your email on your staff record in the CRM so it matches this login exactly." />
        )}

        {(loading || staffLoading) && <LoadingState />}
        {error && <ErrorState message={error} />}

        {staff && !loading && (
          <>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Active trips</h2>
            {active.length === 0 ? (
              <Card className="mb-6 p-4">
                <EmptyState message="No active trips assigned to you." />
              </Card>
            ) : (
              <div className="mb-6 space-y-3">
                {active.map((trip) => (
                  <Card key={trip.id} className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium text-slate-900">{vehicleReg(trip.vehicle_id)}</p>
                      <Badge value={trip.status} />
                    </div>
                    <p className="mb-3 text-sm text-slate-600">
                      {[trip.start_location, trip.end_location].filter(Boolean).join(' → ') || 'No route set'}
                    </p>
                    {trip.status === 'planned' && (
                      <Button className="w-full" onClick={() => setCapture({ trip, stage: 'start' })}>
                        Start trip
                      </Button>
                    )}
                    {trip.status === 'in_progress' && (
                      <Button className="w-full" onClick={() => setCapture({ trip, stage: 'end' })}>
                        End trip
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}

            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent trips</h2>
            {past.length === 0 ? (
              <Card className="p-4">
                <EmptyState message="No completed trips yet." />
              </Card>
            ) : (
              <div className="space-y-3">
                {past.slice(0, 10).map((trip) => (
                  <Card key={trip.id} className="p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-medium text-slate-900">{vehicleReg(trip.vehicle_id)}</p>
                      <Badge value={trip.status} />
                    </div>
                    <p className="text-sm text-slate-600">
                      {trip.end_time ? format(parseISO(trip.end_time), 'd MMM yyyy HH:mm') : '—'}
                    </p>
                    {(trip.start_photo_url || trip.end_photo_url) && (
                      <div className="mt-2 flex gap-2">
                        {trip.start_photo_url && (
                          <a href={trip.start_photo_url} target="_blank" rel="noreferrer">
                            <img
                              src={trip.start_photo_url}
                              alt="Start odometer"
                              className="h-16 w-16 rounded-md object-cover"
                            />
                          </a>
                        )}
                        {trip.end_photo_url && (
                          <a href={trip.end_photo_url} target="_blank" rel="noreferrer">
                            <img
                              src={trip.end_photo_url}
                              alt="End odometer"
                              className="h-16 w-16 rounded-md object-cover"
                            />
                          </a>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {capture && (
        <CaptureSheet
          trip={capture.trip}
          stage={capture.stage}
          onClose={() => setCapture(null)}
          onDone={async () => {
            setCapture(null)
            await refetch()
          }}
        />
      )}
    </div>
  )
}

function CaptureSheet({
  trip,
  stage,
  onClose,
  onDone,
}: {
  trip: Trip
  stage: 'start' | 'end'
  onClose: () => void
  onDone: () => void
}) {
  const [odometer, setOdometer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!odometer.trim()) {
      setError('Enter the odometer reading.')
      return
    }
    if (!file) {
      setError('Take a photo of the dashboard.')
      return
    }
    setSaving(true)
    setError(null)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '')
    const path = `${trip.id}/${stage}-${Date.now()}-${safeName || 'photo.jpg'}`
    const { error: uploadErr } = await supabase.storage.from('trip-photos').upload(path, file)
    if (uploadErr) {
      setSaving(false)
      setError(`Upload failed: ${uploadErr.message}`)
      return
    }
    const { data: publicUrlData } = supabase.storage.from('trip-photos').getPublicUrl(path)

    const payload: Partial<Trip> =
      stage === 'start'
        ? {
            status: 'in_progress',
            start_time: new Date().toISOString(),
            start_odometer_km: Number(odometer),
            start_photo_url: publicUrlData.publicUrl,
          }
        : {
            status: 'completed',
            end_time: new Date().toISOString(),
            end_odometer_km: Number(odometer),
            end_photo_url: publicUrlData.publicUrl,
          }

    const { error: updateErr } = await supabase.from('trips').update(payload as never).eq('id', trip.id)
    setSaving(false)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {stage === 'start' ? 'Start trip' : 'End trip'} — dashboard photo
        </h2>

        <div className="space-y-4">
          <Field label={`${stage === 'start' ? 'Starting' : 'Ending'} odometer (km)`}>
            <input
              inputMode="numeric"
              className={inputClass}
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder="e.g. 268400"
            />
          </Field>

          <Field label="Dashboard photo">
            {preview ? (
              <img src={preview} alt="Preview" className="mb-2 h-40 w-full rounded-lg object-cover" />
            ) : (
              <div className="mb-2 flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
                No photo yet
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="block w-full text-sm text-slate-600"
            />
          </Field>

          {error && <ErrorState message={error} />}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Uploading…' : stage === 'start' ? 'Start trip' : 'End trip'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
