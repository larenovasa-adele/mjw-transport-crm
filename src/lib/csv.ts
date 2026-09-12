// Minimal CSV helpers for the Sage import/export feature. Sage's own import
// templates (and its CSV exports) are plain comma-delimited files with a
// header row — nothing fancier is needed here.

export function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value)
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','))
  }
  return lines.join('\r\n')
}

export function downloadCsv(filename: string, content: string) {
  // Prefix with a UTF-8 BOM so Excel (which Sage exports are usually opened
  // in) doesn't mangle special characters.
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Simple RFC4180-ish CSV parser: handles quoted fields, embedded commas,
 * escaped quotes (""), and \n / \r\n line endings. Not a full spec
 * implementation, but good enough for exports out of Sage, Excel, or Google
 * Sheets. Returns an array of rows, each an array of cell strings; the first
 * row is expected to be the header row.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}
