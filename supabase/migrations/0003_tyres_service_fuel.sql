-- Adds: driver monthly salary, vehicle service history, tyre tracking, and
-- litre-based fuel logging — the data the Reports page (cost-per-km,
-- profit-per-vehicle, fleet P&L) is built on. Run in the SQL Editor after
-- 0001_init.sql and 0002_driver_photos.sql.

-- ============================================================================
-- STAFF: fixed monthly salary (MJW's drivers are paid a flat monthly wage,
-- not per trip/km) — used as a fleet-wide overhead line in Reports.
-- ============================================================================
alter table staff add column if not exists monthly_salary numeric;

-- ============================================================================
-- SERVICE RECORDS — maintenance/repair history per vehicle. Distinct from the
-- single "next_service_due" field already on vehicles (which stays as the
-- forward-looking reminder); this is the backward-looking log of what was
-- actually done and what it cost.
-- ============================================================================
create table if not exists service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  service_date date not null default current_date,
  odometer_km numeric,
  category text not null default 'service', -- 'service' | 'repair' | 'inspection' | 'other'
  description text,
  workshop text,
  cost numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists service_records_vehicle_id_idx
  on service_records (vehicle_id, service_date desc);

-- ============================================================================
-- TYRES — one row per physical tyre fitted to a vehicle, so cost-per-km and
-- retread history can be tracked per tyre rather than as a lump "maintenance"
-- expense.
-- ============================================================================
create table if not exists tyres (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  position text not null,               -- e.g. 'Front left', 'Rear right outer'
  brand text,
  size text,
  serial_number text,
  status text not null default 'fitted', -- 'fitted' | 'removed' | 'scrapped'
  install_date date,
  install_odometer_km numeric,
  cost numeric,
  retread_count int not null default 0,
  removed_date date,
  removed_odometer_km numeric,
  removal_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tyres_vehicle_id_idx on tyres (vehicle_id);

create table if not exists tyre_inspections (
  id uuid primary key default gen_random_uuid(),
  tyre_id uuid not null references tyres(id) on delete cascade,
  inspected_at date not null default current_date,
  tread_depth_mm numeric,
  pressure_kpa numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists tyre_inspections_tyre_id_idx
  on tyre_inspections (tyre_id, inspected_at desc);

drop trigger if exists trg_tyres_updated_at on tyres;
create trigger trg_tyres_updated_at before update on tyres
  for each row execute function set_updated_at();

-- ============================================================================
-- FUEL LOGS — litre + odometer based fill-up logging (separate from the
-- generic "fuel" expense category, which only ever captured a rand amount).
-- This is what makes km/L efficiency and an accurate fuel-cost-per-km
-- possible. Going forward, log fill-ups here rather than as a generic
-- expense, so costs aren't double-counted in Reports.
-- ============================================================================
create table if not exists fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  filled_at date not null default current_date,
  odometer_km numeric,
  litres numeric not null,
  cost numeric not null,
  full_tank boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists fuel_logs_vehicle_id_idx on fuel_logs (vehicle_id, filled_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY — same model as everything else in this app: any
-- authenticated user has full read/write access.
-- ============================================================================
alter table service_records enable row level security;
alter table tyres enable row level security;
alter table tyre_inspections enable row level security;
alter table fuel_logs enable row level security;

drop policy if exists "Authenticated users full access" on service_records;
create policy "Authenticated users full access" on service_records for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on tyres;
create policy "Authenticated users full access" on tyres for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on tyre_inspections;
create policy "Authenticated users full access" on tyre_inspections for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users full access" on fuel_logs;
create policy "Authenticated users full access" on fuel_logs for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
