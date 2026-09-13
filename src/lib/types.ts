// Domain types mirroring supabase/migrations/0001_init.sql.
// These are hand-written to match the schema; if you alter the SQL, update
// these too (or generate proper types later with `supabase gen types typescript`
// once the project is live).

export type StaffRole = 'driver' | 'dispatcher' | 'mechanic' | 'admin' | 'owner'
export type StaffStatus = 'active' | 'on_leave' | 'suspended' | 'terminated'
export type VehicleStatus = 'active' | 'in_maintenance' | 'out_of_service' | 'sold'
export type RouteStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'delayed'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type TelematicsProvider = 'none' | 'cartrack' | 'netstar' | 'mix_telematics' | 'other'
export type TripStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type ExpenseCategory = 'fuel' | 'maintenance' | 'tolls' | 'fines' | 'insurance' | 'other'
export type ServiceCategory = 'service' | 'repair' | 'inspection' | 'other'
export type TyreStatus = 'fitted' | 'removed' | 'scrapped'

export interface Staff {
  id: string
  full_name: string
  role: StaffRole
  status: StaffStatus
  phone: string | null
  email: string | null
  id_number: string | null
  drivers_license_code: string | null
  drivers_license_expiry: string | null
  pdp_expiry: string | null
  hire_date: string | null
  notes: string | null
  /** Fixed monthly wage, if this person is on salary (MJW's current model for all drivers). */
  monthly_salary: number | null
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  registration_number: string
  make: string | null
  model: string | null
  year: number | null
  vehicle_type: string | null
  capacity_kg: number | null
  status: VehicleStatus
  assigned_driver_id: string | null
  license_disc_expiry: string | null
  next_service_due: string | null
  next_service_odometer_km: number | null
  current_odometer_km: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  billing_address: string | null
  vat_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Route {
  id: string
  client_id: string | null
  vehicle_id: string | null
  driver_id: string | null
  origin: string
  destination: string
  scheduled_date: string
  scheduled_time: string | null
  distance_km: number | null
  cargo_description: string | null
  status: RouteStatus
  rate: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TelematicsIntegration {
  id: string
  provider: TelematicsProvider
  is_active: boolean
  account_reference: string | null
  webhook_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VehiclePosition {
  id: string
  vehicle_id: string
  latitude: number
  longitude: number
  speed_kmh: number | null
  heading_degrees: number | null
  recorded_at: string
  source: string
  created_at: string
}

export interface Trip {
  id: string
  route_id: string | null
  vehicle_id: string
  driver_id: string | null
  start_time: string | null
  end_time: string | null
  start_odometer_km: number | null
  end_odometer_km: number | null
  start_location: string | null
  end_location: string | null
  status: TripStatus
  notes: string | null
  start_photo_url: string | null
  end_photo_url: string | null
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  client_id: string | null
  quote_number: string
  status: QuoteStatus
  issue_date: string
  expiry_date: string | null
  subtotal: number
  vat_amount: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface QuoteLineItem {
  id: string
  quote_id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Invoice {
  id: string
  client_id: string | null
  route_id: string | null
  quote_id: string | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  subtotal: number
  vat_amount: number
  total: number
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Expense {
  id: string
  vehicle_id: string | null
  route_id: string | null
  category: ExpenseCategory
  description: string | null
  amount: number
  expense_date: string
  odometer_km: number | null
  receipt_reference: string | null
  created_at: string
}

export interface ServiceRecord {
  id: string
  vehicle_id: string
  service_date: string
  odometer_km: number | null
  category: ServiceCategory
  description: string | null
  workshop: string | null
  cost: number
  created_at: string
}

export interface Tyre {
  id: string
  vehicle_id: string
  position: string
  brand: string | null
  size: string | null
  serial_number: string | null
  status: TyreStatus
  install_date: string | null
  install_odometer_km: number | null
  cost: number | null
  retread_count: number
  removed_date: string | null
  removed_odometer_km: number | null
  removal_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TyreInspection {
  id: string
  tyre_id: string
  inspected_at: string
  tread_depth_mm: number | null
  pressure_kpa: number | null
  notes: string | null
  created_at: string
}

export interface FuelLog {
  id: string
  vehicle_id: string
  filled_at: string
  odometer_km: number | null
  litres: number
  cost: number
  full_tank: boolean
  notes: string | null
  created_at: string
}
