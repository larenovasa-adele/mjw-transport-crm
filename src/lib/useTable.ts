import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Small generic hook for a Supabase table: fetches all rows (ordered by the
 * given column) and exposes insert/update/remove helpers that refetch after
 * writing. Good enough for a CRM this size; reach for something like
 * react-query if the data volume or caching needs grow.
 */
export function useTable<T extends { id: string }>(
  table: string,
  orderBy: string = 'created_at',
  ascending = false,
) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
    if (error) {
      setError(error.message)
    } else {
      setRows((data ?? []) as T[])
    }
    setLoading(false)
  }, [table, orderBy, ascending])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function insert(values: Partial<T>) {
    const { error } = await supabase.from(table).insert(values as never)
    if (error) return { error: error.message }
    await refetch()
    return { error: null }
  }

  async function update(id: string, values: Partial<T>) {
    const { error } = await supabase.from(table).update(values as never).eq('id', id)
    if (error) return { error: error.message }
    await refetch()
    return { error: null }
  }

  async function remove(id: string) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return { error: error.message }
    await refetch()
    return { error: null }
  }

  return { rows, loading, error, refetch, insert, update, remove }
}
