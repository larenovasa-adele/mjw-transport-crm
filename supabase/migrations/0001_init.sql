-- MJW Transport CRM — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
create type staff_role as enum ('driver', 'dispatcher', 'mechanic', 'admin', 'owner');
create type staff_status as enum ('active', 'on_leave', 'suspended', 'terminated');
create type vehicle_status as enum ('active', 'in_maintenance', 'out_of_service', 'sold');
create type route_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled', 'delayed');
create type quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
create type telematics_provider as enum ('none', 'cartrack', 'netstar', 'mix_telematics', 'other');

-- ============================================================================
-- STAFF (drivers, dispatchers, mechanics, admin)
-- ============================================================================
create table staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role staff_role not null default 'driver',
  status staff_status not null default 'active',
  phone text,
  email text,
  id_number text,                     -- SA ID number (kept in-app only; do not expose client-side beyond authorised roles)
  drivers_license_code text,          -- e.g. C1, EC
  drivers_license_expiry date,
  pdp_expiry date,                    -- Professional Driving Permit expiry, if applicable
  hire_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- VEHICLES (fleet)
-- ============================================================================
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  make text,
  model text,
  year int,
  vehicle_type text,                  -- e.g. 'horse', 'trailer', 'rigid truck', 'bakkie'
  capacity_kg numeric,
  status vehicle_status not null default 'active',
  assigned_driver_id uuid references staff(id) on delete set null,
  license_disc_expiry date,
  next_service_due date,
  next_service_odometer_km numeric,
  current_odometer_km numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- CLIENTS
-- ============================================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  billing_address text,
  vat_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ROUTES / JOBS
-- ============================================================================
create table routes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  driver_id uuid references staff(id) on delete set null,
  origin text not null,
  destination text not null,
  scheduled_date date not null,
  scheduled_time time,
  distance_km numeric,
  cargo_description text,
  status route_status not null default 'scheduled',
  rate numeric,                       -- what the client is charged for this route
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- TELEMATICS INTEGRATION CONFIG
-- One row per provider connection. Populate once Marius confirms which GPS/
-- tracker provider MJW Transport uses. api_key/secret should really live in
-- Supabase Vault or an Edge Function secret, not in a plain table, before
-- go-live — this column is a placeholder for wiring it up.
-- ============================================================================
create table telematics_integrations (
  id uuid primary key default gen_random_uuid(),
  provider telematics_provider not null default 'none',
  is_active boolean not null default false,
  account_reference text,             -- provider's account/fleet ID
  webhook_url text,                   -- URL provider will push updates to (Supabase Edge Function)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- VEHICLE POSITIONS (live/last-known GPS pings)
-- Populated either by manual entry or, once connected, by a Supabase Edge
-- Function receiving webhooks/polling from the telematics provider.
-- ============================================================================
create table vehicle_positions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  latitude numeric not null,
  longitude numeric not null,
  speed_kmh numeric,
  heading_degrees numeric,
  recorded_at timestamptz not null default now(),
  source text not null default 'manual', -- 'manual' | 'cartrack' | 'netstar' | 'mix_telematics' | ...
  created_at timestamptz not null default now()
);
create index vehicle_positions_vehicle_id_recorded_at_idx
  on vehicle_positions (vehicle_id, recorded_at desc);

-- ============================================================================
-- TRIPS (manual or synced trip log — the "tracker" feature)
-- ============================================================================
create table trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references routes(id) on delete set null,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  driver_id uuid references staff(id) on delete set null,
  start_time timestamptz,
  end_time timestamptz,
  start_odometer_km numeric,
  end_odometer_km numeric,
  start_location text,
  end_location text,
  status text not null default 'planned', -- 'planned' | 'in_progress' | 'completed' | 'cancelled'
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- QUOTES
-- ============================================================================
create table quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  quote_number text not null unique,
  status quote_status not null default 'draft',
  issue_date date not null default current_date,
  expiry_date date,
  subtotal numeric not null default 0,
  vat_amount numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  line_total numeric generated always as (quantity * unit_price) stored
);

-- ============================================================================
-- INVOICES
-- ============================================================================
create table invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  route_id uuid references routes(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  invoice_number text not null unique,
  status invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric not null default 0,
  vat_amount numeric not null default 0,
  total numeric not null default 0,
  paid_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  line_total numeric generated always as (quantity * unit_price) stored
);

-- ============================================================================
-- EXPENSES (fuel, maintenance, tolls, etc.)
-- ============================================================================
create table expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete set null,
  route_id uuid references routes(id) on delete set null,
  category text not null,             -- 'fuel' | 'maintenance' | 'tolls' | 'fines' | 'insurance' | 'other'
  description text,
  amount numeric not null,
  expense_date date not null default current_date,
  odometer_km numeric,
  receipt_reference text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_staff_updated_at before update on staff
  for each row execute function set_updated_at();
create trigger trg_vehicles_updated_at before update on vehicles
  for each row execute function set_updated_at();
create trigger trg_clients_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger trg_routes_updated_at before update on routes
  for each row execute function set_updated_at();
create trigger trg_telematics_updated_at before update on telematics_integrations
  for each row execute function set_updated_at();
create trigger trg_trips_updated_at before update on trips
  for each row execute function set_updated_at();
create trigger trg_quotes_updated_at before update on quotes
  for each row execute function set_updated_at();
create trigger trg_invoices_updated_at before update on invoices
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Simple model: any authenticated user (i.e. anyone Marius/Adele creates a
-- login for in Supabase Auth) can read/write everything. Tighten this later
-- with per-role policies (e.g. drivers can only see their own trips) once
-- staff logins are actually issued.
-- ============================================================================
alter table staff enable row level security;
alter table vehicles enable row level security;
alter table clients enable row level security;
alter table routes enable row level security;
alter table telematics_integrations enable row level security;
alter table vehicle_positions enable row level security;
alter table trips enable row level security;
alter table quotes enable row level security;
alter table quote_line_items enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
alter table expenses enable row level security;

create policy "Authenticated users full access" on staff for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on vehicles for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on clients for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on routes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on telematics_integrations for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on vehicle_positions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on trips for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on quotes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on quote_line_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on invoice_line_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users full access" on expenses for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
