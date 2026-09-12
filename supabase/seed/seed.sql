-- MJW Transport CRM — sample/placeholder data
-- Run AFTER supabase/migrations/0001_init.sql, on a project you're happy to
-- wipe and reseed. None of this is real MJW Transport data — it exists so
-- the screens have something to show before Marius's actual fleet, staff,
-- clients and financials are entered.

-- Wipe existing rows (safe to skip on a brand-new project).
truncate table
  invoice_line_items, invoices,
  quote_line_items, quotes,
  expenses, trips, vehicle_positions,
  routes, telematics_integrations,
  clients, vehicles, staff
restart identity cascade;

-- ============================================================================
-- STAFF
-- ============================================================================
insert into staff (id, full_name, role, status, phone, email, drivers_license_code, drivers_license_expiry, pdp_expiry, hire_date) values
  ('a0000000-0000-0000-0000-000000000001', 'Marius Wiese', 'owner', 'active', '082 000 0001', 'marius@mjwtransport.example', null, null, null, '2020-01-01'),
  ('a0000000-0000-0000-0000-000000000002', 'Johan du Plessis', 'driver', 'active', '082 000 0002', 'johan@mjwtransport.example', 'EC', '2027-03-15', '2027-06-01', '2021-04-01'),
  ('a0000000-0000-0000-0000-000000000003', 'Sipho Nkosi', 'driver', 'active', '082 000 0003', 'sipho@mjwtransport.example', 'C1', '2026-11-20', '2027-01-10', '2022-02-15'),
  ('a0000000-0000-0000-0000-000000000004', 'Pieter Botha', 'driver', 'on_leave', '082 000 0004', 'pieter@mjwtransport.example', 'EC', '2026-08-05', '2026-09-30', '2019-09-01'),
  ('a0000000-0000-0000-0000-000000000005', 'Nomvula Dlamini', 'dispatcher', 'active', '082 000 0005', 'nomvula@mjwtransport.example', null, null, null, '2023-01-10'),
  ('a0000000-0000-0000-0000-000000000006', 'Willem Kruger', 'mechanic', 'active', '082 000 0006', 'willem@mjwtransport.example', null, null, null, '2020-06-01');

-- ============================================================================
-- VEHICLES
-- ============================================================================
insert into vehicles (id, registration_number, make, model, year, vehicle_type, capacity_kg, status, assigned_driver_id, license_disc_expiry, next_service_due, next_service_odometer_km, current_odometer_km) values
  ('b0000000-0000-0000-0000-000000000001', 'CA 123-456', 'Freightliner', 'Argosy', 2019, 'horse', 34000, 'active', 'a0000000-0000-0000-0000-000000000002', '2027-01-31', '2026-10-15', 285000, 268400),
  ('b0000000-0000-0000-0000-000000000002', 'CA 234-567', 'Volvo', 'FH440', 2021, 'horse', 34000, 'active', 'a0000000-0000-0000-0000-000000000003', '2026-12-15', '2026-11-01', 190000, 176200),
  ('b0000000-0000-0000-0000-000000000003', 'CA 345-678', 'Afrit', 'Tri-axle flatbed', 2018, 'trailer', 28000, 'active', null, '2027-02-28', null, null),
  ('b0000000-0000-0000-0000-000000000004', 'CA 456-789', 'Isuzu', 'FVZ 1400', 2020, 'rigid truck', 14000, 'in_maintenance', 'a0000000-0000-0000-0000-000000000004', '2026-09-30', '2026-09-20', 145000, 143950),
  ('b0000000-0000-0000-0000-000000000005', 'CA 567-891', 'Toyota', 'Hilux', 2022, 'bakkie', 1000, 'active', null, '2027-04-30', '2026-12-01', 62000, 58100);

-- ============================================================================
-- CLIENTS
-- ============================================================================
insert into clients (id, company_name, contact_name, phone, email, billing_address, vat_number) values
  ('c0000000-0000-0000-0000-000000000001', 'Boland Agri Produce', 'Estelle van Zyl', '021 000 1001', 'accounts@bolandagri.example', '12 Voortrekker Road, Paarl, 7646', '4123456789'),
  ('c0000000-0000-0000-0000-000000000002', 'Cape Build Supplies', 'Riaan Coetzee', '021 000 1002', 'riaan@capebuild.example', '45 Industria Ave, Bellville, 7530', '4223456780'),
  ('c0000000-0000-0000-0000-000000000003', 'Winelands Bottling Co', 'Thandiwe Mokoena', '021 000 1003', 'logistics@winelandsbottling.example', '8 Kelder Street, Stellenbosch, 7600', '4323456781');

-- ============================================================================
-- ROUTES
-- ============================================================================
insert into routes (id, client_id, vehicle_id, driver_id, origin, destination, scheduled_date, scheduled_time, distance_km, cargo_description, status, rate) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Paarl', 'Cape Town Harbour', current_date, '06:00', 60, 'Palletised fresh produce', 'in_progress', 8500),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Bellville', 'George', current_date, '07:30', 420, 'Building materials', 'scheduled', 14200),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Stellenbosch', 'Durban', current_date + interval '2 day', null, 1650, 'Bottled wine, palletised', 'scheduled', 32000),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Paarl', 'Johannesburg City Deep', current_date - interval '3 day', '05:00', 1400, 'Palletised fresh produce', 'completed', 28500),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Bellville', 'Mossel Bay', current_date - interval '1 day', '08:00', 390, 'Building materials', 'delayed', 13100);

-- ============================================================================
-- TELEMATICS INTEGRATION (none connected yet — see Settings page)
-- ============================================================================
insert into telematics_integrations (id, provider, is_active, account_reference, notes) values
  ('e0000000-0000-0000-0000-000000000001', 'none', false, null, 'Awaiting confirmation from Marius on which GPS/tracker provider MJW Transport uses.');

-- ============================================================================
-- VEHICLE POSITIONS (manual sample pings, Western Cape corridor)
-- ============================================================================
insert into vehicle_positions (vehicle_id, latitude, longitude, speed_kmh, recorded_at, source) values
  ('b0000000-0000-0000-0000-000000000001', -33.7346, 18.9621, 68, now() - interval '10 minutes', 'manual'),
  ('b0000000-0000-0000-0000-000000000002', -33.9249, 18.6241, 0, now() - interval '2 hours', 'manual'),
  ('b0000000-0000-0000-0000-000000000005', -33.9847, 18.8617, 45, now() - interval '30 minutes', 'manual');

-- ============================================================================
-- TRIPS
-- ============================================================================
insert into trips (route_id, vehicle_id, driver_id, start_time, end_time, start_odometer_km, end_odometer_km, start_location, end_location, status) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', now() - interval '3 hours', null, 268340, null, 'Paarl depot', null, 'in_progress'),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', now() - interval '4 day', now() - interval '3 day', 174600, 176200, 'Paarl depot', 'Johannesburg City Deep', 'completed');

-- ============================================================================
-- QUOTES + LINE ITEMS
-- ============================================================================
insert into quotes (id, client_id, quote_number, status, issue_date, expiry_date, subtotal, vat_amount, total) values
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Q-0001', 'sent', current_date - interval '5 day', current_date + interval '25 day', 32000, 4800, 36800);

insert into quote_line_items (quote_id, description, quantity, unit_price) values
  ('f0000000-0000-0000-0000-000000000001', 'Stellenbosch to Durban — palletised wine (1 load)', 1, 32000);

-- ============================================================================
-- INVOICES + LINE ITEMS
-- ============================================================================
insert into invoices (id, client_id, route_id, invoice_number, status, issue_date, due_date, subtotal, vat_amount, total, paid_at) values
  ('11110000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'INV-0001', 'paid', current_date - interval '3 day', current_date + interval '27 day', 28500, 4275, 32775, current_date - interval '1 day'),
  ('11110000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'INV-0002', 'sent', current_date - interval '1 day', current_date + interval '29 day', 13100, 1965, 15065, null);

insert into invoice_line_items (invoice_id, description, quantity, unit_price) values
  ('11110000-0000-0000-0000-000000000001', 'Paarl to Johannesburg City Deep — palletised produce', 1, 28500),
  ('11110000-0000-0000-0000-000000000002', 'Bellville to Mossel Bay — building materials', 1, 13100);

-- ============================================================================
-- EXPENSES
-- ============================================================================
insert into expenses (vehicle_id, route_id, category, description, amount, expense_date, odometer_km) values
  ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'fuel', 'Diesel fill-up, Paarl depot', 4200.00, current_date, 268340),
  ('b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 'fuel', 'Diesel, N1 Beaufort West', 6100.50, current_date - interval '4 day', 175200),
  ('b0000000-0000-0000-0000-000000000004', null, 'maintenance', 'Brake pad replacement', 3850.00, current_date - interval '2 day', 143950),
  ('b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 'tolls', 'N1 toll gates, round trip', 980.00, current_date - interval '3 day', null);
