import { useState, type ChangeEvent } from 'react'
import { parseCsv } from '../lib/csv'
import { Button, ErrorState, Field, inputClass, Modal } from './ui'

export interface CsvField {
  key: string
  label: string
  required?: boolean
}

/**
 * Generic "upload a CSV, map its columns to our fields, import" modal. Used
 * for pulling data in from a Sage export (or any other CSV) without needing
 * to know its exact column layout in advance.
 */
export function CsvImportModal({
  open,
  onClose,
  title,
  fields,
  onImport,
}: {
  open: boolean
  onClose: () => void
  title: string
  fields: CsvField[]
  onImport: (rows: Record<string, string>[]) => Promise<{ error: string | null; count?: number }>
}) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  function reset() {
    setHeaders([])
    setRows([])
    setMapping({})
    setError(null)
    setDone(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setDone(null)
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.length === 0) {
      setError('That file appears to be empty.')
      return
    }
    const [headerRow, ...dataRows] = parsed
    setHeaders(headerRow)
    setRows(dataRows)

    // Best-effort auto-mapping by matching header text to field labels/keys.
    const auto: Record<string, string> = {}
    for (const f of fields) {
      const match =
        headerRow.find((h) => h.trim().toLowerCase() === f.label.toLowerCase()) ??
        headerRow.find((h) => h.trim().toLowerCase().replace(/\s+/g, '_') === f.key.toLowerCase())
      if (match) auto[f.key] = match
    }
    setMapping(auto)
  }

  async function handleImport() {
    const missing = fields.filter((f) => f.required && !mapping[f.key])
    if (missing.length > 0) {
      setError(`Map a column for: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setImporting(true)
    setError(null)

    const mappedRows = rows
      .filter((r) => r.some((cell) => cell.trim() !== ''))
      .map((r) => {
        const obj: Record<string, string> = {}
        for (const f of fields) {
          const col = mapping[f.key]
          const idx = col ? headers.indexOf(col) : -1
          obj[f.key] = idx >= 0 ? (r[idx] ?? '').trim() : ''
        }
        return obj
      })

    const result = await onImport(mappedRows)
    setImporting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setDone(result.count ?? mappedRows.length)
    setRows([])
    setHeaders([])
  }

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <div className="space-y-4">
        <Field label="CSV file">
          <input type="file" accept=".csv,text/csv" className={inputClass} onChange={handleFile} />
        </Field>

        {headers.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {rows.length} row{rows.length === 1 ? '' : 's'} found. Match each field to a column from your file
              (fields marked * are required):
            </p>
            {fields.map((f) => (
              <Field key={f.key} label={f.label + (f.required ? ' *' : '')}>
                <select
                  className={inputClass}
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                >
                  <option value="">— not mapped —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        )}

        {error && <ErrorState message={error} />}
        {done != null && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Imported {done} record{done === 1 ? '' : 's'}.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Close
          </Button>
          {headers.length > 0 && done == null && (
            <Button type="button" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${rows.length} row${rows.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
