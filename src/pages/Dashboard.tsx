import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Invoice, Route, Staff, Vehicle } from '../lib/types'
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui'
import { addDays, format, isToday, parseISO } from 'date-fns'

interface Stats {
  activeVehicles: number
  totalVehicles: number
  routesToday: number
  outstandingTotal: number
  outstandingCount: number
}

interface Alert {
  label: string
  detail: string
  due: string
  href: string
}

const ALERT_WINDOW_DAYS = 30

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [upcomingRoutes, setUpcomingRoutes] = useState<Route[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const [
        { data: vehicles, error: vErr },
        { data: routes, error: rErr },
        { data: invoices, error: iErr },
        { data: staffList, error: sErr },
      ] = await Promise.all([
        supabase.from('vehicles').select('*') as unknown as Promise<{ data: Vehicle[] | null; error: any }>,
        supabase.from('routes').select('*').order('scheduled_date', { ascending: true }) as unknown as Promise<{
          data: Route[] | null
          error: any
        }>,
        supabase.from('invoices').select('*') as unknown as Promise<{ data: Invoice[] | null; error: any }>,
        supabase.from('staff').select('*') as unknown as Promise<{ data: Staff[] | null; error: any }>,
      ])

      const firstError = vErr ?? rErr ?? iErr ?? sErr
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      const allVehicles = vehicles ?? []
      const allRoutes = routes ?? []
      const allInvoices = invoices ?? []
      const allStaff = staffList ?? []

      const outstanding = allInvoices.filter((inv) => inv.status === 'sent' || inv.status === 'overdue')

      setStats({
        activeVehicles: allVehicles.filter((v) => v.status === 'active').length,
        totalVehicles: allVehicles.length,
        routesToday: allRoutes.filter((r) => isToday(parseISO(r.scheduled_date))).length,
        outstandingTotal: outstanding.reduce((sum, inv) => sum + Number(inv.total), 0),
        outstandingCount: outstanding.length,
      })

      setUpcomingRoutes(allRoutes.filter((r) => r.status === 'scheduled' || r.status === 'in_progress').slice(0, 6))

      // ---- expiry/service alerts, next 30 days (including anything already overdue) ----
      const cutoff = addDays(new Date(), ALERT_WINDOW_DAYS)
      const dueSoon = (dateStr: string | null) => {
        if (!dateStr) return false
        const d = parseISO(dateStr)
        return d <= cutoff
      }
      const fmt = (dateStr: string) => format(parseISO(dateStr), 'd MMM yyyy')

      const found: Alert[] = []
      for (const v of allVehicles) {
        if (dueSoon(v.license_disc_expiry)) {
          found.push({
            label: v.registration_number,
            detail: 'License disc expiry',
            due: fmt(v.license_disc_expiry!),
            href: '/fleet',
          })
        }
        if (dueSoon(v.next_service_due)) {
          found.push({
            label: v.registration_number,
            detail: 'Service due',
            due: fmt(v.next_service_due!),
            href: '/fleet',
          })
        }
      }
      for (const s of allStaff) {
        if (dueSoon(s.drivers_license_expiry)) {
          found.push({
            label: s.full_name,
            detail: "Driver's license expiry",
            due: fmt(s.drivers_license_expiry!),
            href: '/staff',
          })
        }
        if (dueSoon(s.pdp_expiry)) {
          found.push({ label: s.full_name, detail: 'PDP expiry', due: fmt(s.pdp_expiry!), href: '/staff' })
        }
      }
      found.sort((a, b) => a.due.localeCompare(b.due))
      setAlerts(found)

      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of MJW Transport's operations" />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active vehicles"
              value={`${stats.activeVehicles} / ${stats.totalVehicles}`}
              href="/fleet"
            />
            <StatCard label="Routes today" value={String(stats.routesToday)} href="/routes" />
            <StatCard
              label="Outstanding invoices"
              value={`R ${stats.outstandingTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`}
              sub={`${stats.outstandingCount} unpaid`}
              href="/finances"
            />
            <StatCard label="Upcoming routes" value={String(upcomingRoutes.length)} href="/routes" />
          </div>

          {alerts.length > 0 && (
            <Card className="mt-6 border-amber-200 bg-amber-50">
              <div className="border-b border-amber-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-amber-900">
                  Attention needed — expiring or due within {ALERT_WINDOW_DAYS} days
                </h2>
              </div>
              <ul className="divide-y divide-amber-200/70">
                {alerts.map((a, i) => (
                  <li key={i} className="px-5 py-3 text-sm">
                    <Link to={a.href} className="flex items-center justify-between hover:underline">
                      <span>
                        <span className="font-medium text-amber-900">{a.label}</span>
                        <span className="text-amber-700"> — {a.detail}</span>
                      </span>
                      <span className="text-amber-700">{a.due}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="mt-6">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Upcoming & active routes</h2>
            </div>
            {upcomingRoutes.length === 0 ? (
              <EmptyState message="No scheduled or in-progress routes yet." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingRoutes.map((route) => (
                  <li key={route.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">
                        {route.origin} → {route.destination}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(parseISO(route.scheduled_date), 'd MMM yyyy')}
                        {route.scheduled_time ? ` · ${route.scheduled_time}` : ''}
                      </p>
                    </div>
                    <Badge value={route.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  href,
}: {
  label: string
  value: string
  sub?: string
  href: string
}) {
  return (
    <Link to={href}>
      <Card className="p-5 transition-shadow hover:shadow-md">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </Card>
    </Link>
  )
}
