import { useMemo, useState } from 'react'
import { useTable } from '../lib/useTable'
import { formatZAR } from '../lib/lineItems'
import type { Client, Expense, FuelLog, Invoice, Route, ServiceRecord, Staff, Trip, Tyre, Vehicle } from '../lib/types'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui'
import { format } from 'date-fns'

type Period = 'month' | 'year'

/**
 * Financial reporting: cost-per-km and profit per vehicle, revenue by client,
 * route-linked profit, and a fleet-wide P&L. Built from invoices, expenses,
 * fuel logs, service records, tyre costs, trips (for km driven), and driver
 * salaries. Every number here is labelled with what it includes/excludes —
 * see the notes under each table — rather than presenting a single figure
 * that quietly assumes a costing method.
 */
export default function Reports() {
  const [period, setPeriod] = useState<Period>('month')

  const { rows: vehicles, loading: l1, error: e1 } = useTable<Vehicle>('vehicles', 'registration_number', true)
  const { rows: routes, loading: l2, error: e2 } = useTable<Route>('routes', 'scheduled_date', false)
  const { rows: invoices, loading: l3, error: e3 } = useTable<Invoice>('invoices', 'issue_date', false)
  const { rows: clients, loading: l4, error: e4 } = useTable<Client>('clients', 'company_name', true)
  const { rows: expenses, loading: l5, error: e5 } = useTable<Expense>('expenses', 'expense_date', false)
  const { rows: fuelLogs, loading: l6, error: e6 } = useTable<FuelLog>('fuel_logs', 'filled_at', false)
  const { rows: serviceRecords, loading: l7, error: e7 } = useTable<ServiceRecord>(
    'service_records',
    'service_date',
    false,
  )
  const { rows: tyres, loading: l8, error: e8 } = useTable<Tyre>('tyres', 'created_at', false)
  const { rows: trips, loading: l9, error: e9 } = useTable<Trip>('trips', 'created_at', false)
  const { rows: staff, loading: l10, error: e10 } = useTable<Staff>('staff', 'full_name', true)

  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9 || l10
  const error = e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6 ?? e7 ?? e8 ?? e9 ?? e10

  const now = new Date()
  const monthPrefix = format(now, 'yyyy-MM')
  const yearPrefix = format(now, 'yyyy')
  const monthsElapsedThisYear = now.getMonth() + 1 // Jan = 0 -> 1 month elapsed

  const inPeriod = useMemo(
    () => (dateStr: string) => (period === 'month' ? dateStr.startsWith(monthPrefix) : dateStr.startsWith(yearPrefix)),
    [period, monthPrefix, yearPrefix],
  )

  const report = useMemo(() => {
    const vehicleReg = new Map(vehicles.map((v) => [v.id, v.registration_number]))
    const routeVehicle = new Map(routes.map((r) => [r.id, r.vehicle_id]))
    const clientName = new Map(clients.map((c) => [c.id, c.company_name]))

    // ---- per-vehicle rollups ----
    const fuelByVehicle = new Map<string, number>()
    for (const f of fuelLogs) {
      if (!inPeriod(f.filled_at)) continue
      fuelByVehicle.set(f.vehicle_id, (fuelByVehicle.get(f.vehicle_id) ?? 0) + Number(f.cost))
    }

    const otherExpenseByVehicle = new Map<string, number>()
    let unlinkedOtherExpenses = 0
    let totalFuelExpenseCategory = 0 // legacy 'fuel' category expenses — excluded from per-vehicle fuel to avoid double counting, reported separately
    for (const e of expenses) {
      if (!inPeriod(e.expense_date)) continue
      if (e.category === 'fuel') {
        totalFuelExpenseCategory += Number(e.amount)
        continue
      }
      if (e.vehicle_id) {
        otherExpenseByVehicle.set(e.vehicle_id, (otherExpenseByVehicle.get(e.vehicle_id) ?? 0) + Number(e.amount))
      } else {
        unlinkedOtherExpenses += Number(e.amount)
      }
    }

    const serviceByVehicle = new Map<string, number>()
    for (const s of serviceRecords) {
      if (!inPeriod(s.service_date)) continue
      serviceByVehicle.set(s.vehicle_id, (serviceByVehicle.get(s.vehicle_id) ?? 0) + Number(s.cost))
    }

    const tyreByVehicle = new Map<string, number>()
    for (const t of tyres) {
      if (!t.install_date || !inPeriod(t.install_date) || !t.cost) continue
      tyreByVehicle.set(t.vehicle_id, (tyreByVehicle.get(t.vehicle_id) ?? 0) + Number(t.cost))
    }

    const kmByVehicle = new Map<string, number>()
    for (const t of trips) {
      if (!t.end_time || !inPeriod(t.end_time.slice(0, 10))) continue
      if (t.start_odometer_km == null || t.end_odometer_km == null) continue
      const distance = Number(t.end_odometer_km) - Number(t.start_odometer_km)
      if (distance > 0) kmByVehicle.set(t.vehicle_id, (kmByVehicle.get(t.vehicle_id) ?? 0) + distance)
    }

    const revenueByVehicle = new Map<string, number>()
    const revenueByClient = new Map<string, number>()
    let unlinkedRevenue = 0
    let totalRevenue = 0
    for (const inv of invoices) {
      if (!inPeriod(inv.issue_date)) continue
      const total = Number(inv.total)
      totalRevenue += total
      if (inv.client_id) revenueByClient.set(inv.client_id, (revenueByClient.get(inv.client_id) ?? 0) + total)
      const vehicleId = inv.route_id ? routeVehicle.get(inv.route_id) : null
      if (vehicleId) {
        revenueByVehicle.set(vehicleId, (revenueByVehicle.get(vehicleId) ?? 0) + total)
      } else {
        unlinkedRevenue += total
      }
    }

    const vehicleRows = vehicles.map((v) => {
      const fuel = fuelByVehicle.get(v.id) ?? 0
      const other = otherExpenseByVehicle.get(v.id) ?? 0
      const service = serviceByVehicle.get(v.id) ?? 0
      const tyreCost = tyreByVehicle.get(v.id) ?? 0
      const totalCost = fuel + other + service + tyreCost
      const km = kmByVehicle.get(v.id) ?? 0
      const revenue = revenueByVehicle.get(v.id) ?? 0
      return {
        vehicleId: v.id,
        registration: v.registration_number,
        fuel,
        service,
        tyreCost,
        other,
        totalCost,
        km,
        costPerKm: km > 0 ? totalCost / km : null,
        revenue,
        profit: revenue - totalCost,
      }
    })

    const clientRows = Array.from(revenueByClient.entries())
      .map(([clientId, revenue]) => ({ clientId, name: clientName.get(clientId) ?? 'Unknown client', revenue }))
      .sort((a, b) => b.revenue - a.revenue)

    // ---- route-linked profit ----
    const expensesByRoute = new Map<string, number>()
    for (const e of expenses) {
      if (!e.route_id || !inPeriod(e.expense_date)) continue
      expensesByRoute.set(e.route_id, (expensesByRoute.get(e.route_id) ?? 0) + Number(e.amount))
    }
    const revenueByRoute = new Map<string, number>()
    for (const inv of invoices) {
      if (!inv.route_id || !inPeriod(inv.issue_date)) continue
      revenueByRoute.set(inv.route_id, (revenueByRoute.get(inv.route_id) ?? 0) + Number(inv.total))
    }
    const routeRows = routes
      .filter((r) => revenueByRoute.has(r.id) || expensesByRoute.has(r.id))
      .map((r) => {
        const revenue = revenueByRoute.get(r.id) ?? 0
        const cost = expensesByRoute.get(r.id) ?? 0
        return {
          routeId: r.id,
          label: `${r.origin} → ${r.destination}`,
          date: r.scheduled_date,
          vehicle: r.vehicle_id ? vehicleReg.get(r.vehicle_id) ?? '—' : '—',
          revenue,
          cost,
          profit: revenue - cost,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))

    // ---- fleet-wide P&L ----
    const totalFuelCost = Array.from(fuelByVehicle.values()).reduce((s, v) => s + v, 0)
    const totalOtherExpenses = Array.from(otherExpenseByVehicle.values()).reduce((s, v) => s + v, 0) + unlinkedOtherExpenses
    const totalServiceCost = Array.from(serviceByVehicle.values()).reduce((s, v) => s + v, 0)
    const totalTyreCost = Array.from(tyreByVehicle.values()).reduce((s, v) => s + v, 0)
    const monthsInPeriod = period === 'month' ? 1 : monthsElapsedThisYear
    const activeDriverSalaries = staff
      .filter((s) => s.role === 'driver' && s.status === 'active' && s.monthly_salary)
      .reduce((sum, s) => sum + Number(s.monthly_salary), 0)
    const totalDriverWages = activeDriverSalaries * monthsInPeriod
    const totalCosts = totalFuelCost + totalOtherExpenses + totalServiceCost + totalTyreCost + totalDriverWages
    const netProfit = totalRevenue - totalCosts

    return {
      vehicleRows,
      clientRows,
      routeRows,
      totalRevenue,
      unlinkedRevenue,
      totalFuelCost,
      totalFuelExpenseCategory,
      totalOtherExpenses,
      totalServiceCost,
      totalTyreCost,
      totalDriverWages,
      totalCosts,
      netProfit,
      monthsInPeriod,
    }
  }, [vehicles, routes, invoices, clients, expenses, fuelLogs, serviceRecords, tyres, trips, staff, inPeriod, period, monthsElapsedThisYear])

  return (
    <div>
      <PageHeader title="Reports" subtitle="Cost per km, profit, and fleet-wide P&L" />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm font-medium sm:w-fit">
        <button
          onClick={() => setPeriod('month')}
          className={`rounded-md px-4 py-1.5 ${period === 'month' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
        >
          This month
        </button>
        <button
          onClick={() => setPeriod('year')}
          className={`rounded-md px-4 py-1.5 ${period === 'year' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
        >
          This year (YTD)
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <>
          <Card className="mb-6 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Fleet P&L — {period === 'month' ? format(now, 'MMMM yyyy') : `${format(now, 'yyyy')} year to date`}
            </h2>
            <div className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
              <PLLine label="Revenue" value={report.totalRevenue} />
              <PLLine label="Fuel" value={-report.totalFuelCost} />
              <PLLine label="Service & repairs" value={-report.totalServiceCost} />
              <PLLine label="Tyres" value={-report.totalTyreCost} />
              <PLLine label="Other expenses" value={-report.totalOtherExpenses} />
              <PLLine
                label={`Driver wages (${report.monthsInPeriod} mo.)`}
                value={-report.totalDriverWages}
              />
              <PLLine label="Net profit" value={report.netProfit} strong />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Driver wages use each active driver's monthly salary from Staff, multiplied by
              {' '}
              {report.monthsInPeriod} month{report.monthsInPeriod === 1 ? '' : 's'} — set a salary on a driver's
              Staff record if this looks low.
              {report.totalFuelExpenseCategory > 0 && (
                <>
                  {' '}
                  Note: {formatZAR(report.totalFuelExpenseCategory)} was logged as a "fuel" expense in Finances →
                  Expenses rather than Finances → Fuel this period, so it's excluded here — use the Fuel tab going
                  forward to avoid this gap.
                </>
              )}
            </p>
          </Card>

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Cost per km & profit by vehicle
          </h2>
          <Card className="mb-6">
            {report.vehicleRows.length === 0 ? (
              <EmptyState message="No vehicles yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Vehicle</th>
                      <th className="px-5 py-3">Revenue</th>
                      <th className="px-5 py-3">Fuel</th>
                      <th className="px-5 py-3">Service</th>
                      <th className="px-5 py-3">Tyres</th>
                      <th className="px-5 py-3">Other</th>
                      <th className="px-5 py-3">Km driven</th>
                      <th className="px-5 py-3">Cost/km</th>
                      <th className="px-5 py-3">Profit*</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.vehicleRows.map((r) => (
                      <tr key={r.vehicleId}>
                        <td className="px-5 py-3 font-medium text-slate-900">{r.registration}</td>
                        <td className="px-5 py-3 text-slate-600">{formatZAR(r.revenue)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatZAR(r.fuel)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatZAR(r.service)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatZAR(r.tyreCost)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatZAR(r.other)}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {r.km > 0 ? `${r.km.toLocaleString()} km` : '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {r.costPerKm != null ? `R ${r.costPerKm.toFixed(2)}` : '—'}
                        </td>
                        <td
                          className={`px-5 py-3 font-medium ${r.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}
                        >
                          {formatZAR(r.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              * Revenue here is only from invoices linked to a route with this vehicle assigned
              {report.unlinkedRevenue > 0 && (
                <> — {formatZAR(report.unlinkedRevenue)} in invoiced revenue this period isn't linked to a route/vehicle and isn't included above</>
              )}
              . Profit excludes driver wages (shown as a fleet-wide line above, since one driver can cover several
              vehicles). Km driven comes from completed trips with both start and end odometer readings logged.
            </p>
          </Card>

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Revenue by client</h2>
          <Card className="mb-6">
            {report.clientRows.length === 0 ? (
              <EmptyState message="No invoiced revenue this period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Client</th>
                      <th className="px-5 py-3">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.clientRows.map((c) => (
                      <tr key={c.clientId}>
                        <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                        <td className="px-5 py-3 text-slate-600">{formatZAR(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Revenue only — costs aren't allocated to clients, since a single trip's fuel/service/tyre costs
              aren't tracked per client.
            </p>
          </Card>

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Route-linked profit
          </h2>
          <Card>
            {report.routeRows.length === 0 ? (
              <EmptyState message="No routes with invoiced revenue or route-linked expenses this period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Route</th>
                      <th className="px-5 py-3">Vehicle</th>
                      <th className="px-5 py-3">Revenue</th>
                      <th className="px-5 py-3">Route-linked costs</th>
                      <th className="px-5 py-3">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.routeRows.map((r) => (
                      <tr key={r.routeId}>
                        <td className="px-5 py-3 font-medium text-slate-900">{r.label}</td>
                        <td className="px-5 py-3 text-slate-600">{r.vehicle}</td>
                        <td className="px-5 py-3 text-slate-600">{formatZAR(r.revenue)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatZAR(r.cost)}</td>
                        <td className={`px-5 py-3 font-medium ${r.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {formatZAR(r.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Only counts expenses specifically tagged to this route in Finances → Expenses — fuel, tyre, and
              general service costs aren't included unless logged against the route directly.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}

function PLLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={
          strong
            ? `text-lg font-semibold ${value < 0 ? 'text-red-600' : 'text-slate-900'}`
            : `text-sm font-medium ${value < 0 ? 'text-red-600' : 'text-slate-700'}`
        }
      >
        {formatZAR(value)}
      </p>
    </div>
  )
}
