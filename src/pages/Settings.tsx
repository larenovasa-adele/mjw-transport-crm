import { useEffect, useState, type FormEvent } from 'react'
import { useTable } from '../lib/useTable'
import type { TelematicsIntegration, TelematicsProvider } from '../lib/types'
import {
  Button,
  Card,
  ErrorState,
  Field,
  inputClass,
  LoadingState,
  PageHeader,
} from '../components/ui'

const PROVIDER_OPTIONS: { value: TelematicsProvider; label: string }[] = [
  { value: 'none', label: 'Not connected' },
  { value: 'cartrack', label: 'Cartrack' },
  { value: 'netstar', label: 'Netstar' },
  { value: 'mix_telematics', label: 'MiX Telematics' },
  { value: 'other', label: 'Other' },
]

export default function Settings() {
  const { rows, loading, error, insert, update } = useTable<TelematicsIntegration>(
    'telematics_integrations',
    'created_at',
    false,
  )
  const existing = rows[0]

  const [provider, setProvider] = useState<TelematicsProvider>(existing?.provider ?? 'none')
  const [accountReference, setAccountReference] = useState(existing?.account_reference ?? '')
  const [isActive, setIsActive] = useState(existing?.is_active ?? false)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Sync local form state once the existing row has loaded.
  useEffect(() => {
    if (!existing) return
    setProvider(existing.provider)
    setAccountReference(existing.account_reference ?? '')
    setIsActive(existing.is_active)
    setNotes(existing.notes ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaved(false)

    const payload: Partial<TelematicsIntegration> = {
      provider,
      account_reference: accountReference || null,
      is_active: isActive,
      notes: notes || null,
    }

    const result = existing ? await update(existing.id, payload) : await insert(payload)
    setSaving(false)
    if (result.error) {
      setSaveError(result.error)
      return
    }
    setSaved(true)
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Telematics / GPS tracker integration" />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && (
        <Card className="max-w-xl p-6">
          <p className="mb-4 text-sm text-slate-600">
            Once Marius confirms which GPS/tracker provider MJW Transport uses, record it here. Actually
            pulling live positions requires that provider's API credentials wired up in a Supabase Edge
            Function (webhook or polling) that writes into the <code className="rounded bg-slate-100 px-1">vehicle_positions</code>{' '}
            table — this panel only stores which provider is in use, it does not connect to one on its own.
            See the README for the integration stub.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Provider">
              <select
                className={inputClass}
                value={provider}
                onChange={(e) => setProvider(e.target.value as TelematicsProvider)}
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account / fleet reference">
              <input
                className={inputClass}
                placeholder="Provider account or fleet ID"
                value={accountReference}
                onChange={(e) => setAccountReference(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Integration is live (positions are flowing in automatically)
            </label>
            <Field label="Notes">
              <textarea
                className={inputClass}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            {saveError && <ErrorState message={saveError} />}
            {saved && <p className="text-sm text-emerald-600">Saved.</p>}

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}
