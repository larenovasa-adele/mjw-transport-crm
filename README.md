# MJW Transport CRM

A production web app for MJW Transport (Marius Wiese) covering fleet/vehicles, tyres, service
history, staff, routes, a GPS tracker/trip log, clients, and finances (quotes, invoices, expenses,
fuel) with a Reports page for cost-per-km and profit.

**Status:** freshly scaffolded, not yet deployed. It currently runs on sample/placeholder data —
no real MJW Transport records have been entered. This is a separate project from LaRenova's CRM:
its own Supabase project, its own Vercel deployment, its own GitHub repo.

Stack: React 19 + TypeScript + Vite, Tailwind CSS v4, Supabase (Postgres + Auth), React Router,
Leaflet/OpenStreetMap for the tracker map, deployed on Vercel.

---

## 1. What's real vs. placeholder right now

- **Data**: everything in the app (vehicles, staff, clients, routes, invoices, GPS pings) is sample
  data from `supabase/seed/seed.sql`, invented to populate the screens — not MJW Transport's actual
  fleet, staff, or financials.
- **GPS tracker**: there is no live GPS/telematics connection. The Tracker page supports *manual*
  position logging and a manual trip log, plus a data model (`vehicle_positions`,
  `telematics_integrations` tables) designed to receive live data later. Wiring up a real provider
  (Cartrack, Netstar, MiX Telematics, or another) needs three things I don't have yet: which
  provider MJW Transport uses, an API/webhook credential from that provider, and — most likely — a
  small Supabase Edge Function to receive and store their pings. Section 6 below has the plan.
- **VAT**: invoices/quotes calculate VAT at South Africa's current standard rate of 15% (confirmed
  against SARS and the 2026 Budget, which withdrew the previously proposed increase to 16%). If
  that rate changes, update `VAT_RATE` in `src/lib/lineItems.ts`.
- **Login**: there's no public sign-up — accounts are created by hand in the Supabase dashboard
  (step 4 below). Every logged-in user currently has full read/write access to everything; there's
  no per-role restriction (e.g. a driver seeing only their own trips) yet.

## 2. Local development

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project's URL + anon key (step 3)
npm run dev
```

## 3. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**.
2. Give it a name (e.g. `mjw-transport-crm`), pick a region close to South Africa (e.g. `eu-west` or
   `af-south-1` if offered), and set a database password — save that password somewhere safe.
3. Once the project finishes provisioning, open **SQL Editor** in the left sidebar.
4. Paste the entire contents of `supabase/migrations/0001_init.sql` and click **Run**. This creates
   every table, enum, and security policy.
5. If you want the app to open with sample data instead of empty screens, also paste and run
   `supabase/seed/seed.sql` (it truncates and reseeds — safe to run more than once on a project
   you're happy to reset).
6. Go to **Project Settings → API**. You'll need two values for the next step:
   - **Project URL**
   - **anon public** key (NOT the `service_role` key — never put that in frontend code)

## 4. Create a login for Marius (and any staff who'll use the CRM)

Supabase Auth handles logins, but there's no public sign-up page in this app on purpose — accounts
are created by an admin:

1. In the Supabase dashboard, go to **Authentication → Users → Add user**.
2. Enter Marius's email and a temporary password, and tick **Auto Confirm User**.
3. Repeat for anyone else (dispatcher, admin) who needs to log in. Share their temporary password
   with them directly — they can change it after logging in once you add a "change password" flow,
   or you can reset it for them from the same screen.

## 5. Connect the app to Supabase and deploy

1. Copy `.env.example` to `.env.local` and fill in the Project URL and anon key from step 3.
2. Confirm it works locally: `npm run dev`, then log in with the account from step 4.
3. Push this project to a new GitHub repository (separate from `weinandsmith-ops/larenova-crm`).
4. Go to [vercel.com](https://vercel.com), **Add New → Project**, import that GitHub repo.
5. Vercel auto-detects Vite. Before deploying, add the two environment variables from step 3
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) under **Environment Variables**.
6. Click **Deploy**. You'll get a live URL (e.g. `mjw-transport-crm.vercel.app`) within a minute or two.

## 6. Connecting a real GPS/tracker provider (not done yet)

Once Marius confirms which tracker MJW Transport uses:

1. Get API/webhook documentation and credentials from that provider.
2. Record the provider name and account reference on the **Settings** page in the app (this only
   stores which provider is in use — it doesn't connect to anything by itself).
3. Build a small Supabase Edge Function that either:
   - receives the provider's webhook pushes and inserts a row into `vehicle_positions` per vehicle, or
   - polls the provider's API on a schedule (Supabase supports scheduled Edge Functions) and does the same.
4. Set `source` on those inserted rows to the provider's name (e.g. `'cartrack'`) so manual and
   provider-fed positions stay distinguishable in the data.
5. Flip `is_active` to true on the Settings page once it's flowing.

Until then, the tracker page is a fully functional manual log — dispatch can log a position or a
trip by hand — it just won't update itself automatically.

## 7. Project structure

```
src/
  components/    Layout, shared UI primitives (Card, Modal, Badge, form fields)
  context/       AuthContext (Supabase session)
  lib/           supabase client, domain types, generic table hook, line-item math
  pages/         Dashboard, Fleet, Staff, Routes, Tracker, Clients, Finances, Settings, Login
supabase/
  migrations/    SQL schema (run once per environment)
  seed/          Sample data (optional, for demoing before real data exists)
```

## 8. Sage import/export

There's no live connection to Sage — that turned out not to be straightforward either way:

- **Sage Pastel Partner** (the desktop product) has no API at all, only manual CSV file
  import/export inside Pastel itself.
- **Sage Business Cloud Accounting** (the online product) does have an API, but it runs on its
  own older, South-Africa-specific system, and getting API access means contacting Sage's API
  team directly rather than self-service signup — not something to depend on for a first version.

So for now this is CSV-based, which works regardless of which Sage product MJW ends up using:

- **Finances → Invoices** and **Finances → Expenses** each have an "Export CSV (for Sage)"
  button. Invoices export one row per line item (invoice number, dates, customer, description,
  quantity, unit price, line total, invoice VAT/total) — the most common layout for Sage's batch
  invoice import. Column names may need a small tweak in Excel to match your exact Sage import
  template before importing.
- **Clients → Import CSV** lets you upload any CSV (e.g. a customer list exported from Sage) and
  map its columns to the CRM's client fields — it doesn't assume a fixed column layout, since
  Sage's export format depends on which product and version you're using. **Clients → Export
  CSV** does the reverse (all clients, one row each).

If MJW ends up on Sage Business Cloud Accounting and you want a live, no-CSV connection later,
that would mean requesting API access from Sage and building a proper sync — a bigger job than
this CSV round-trip.

## 9. Tyres, service history, fuel, and Reports

Added after the initial build, based on research into what fleet/transport management systems
typically track. Run `supabase/migrations/0003_tyres_service_fuel.sql` in the SQL Editor (after
0001 and 0002) before using any of this — it adds the tables these features need, plus a
`monthly_salary` column on Staff.

- **Fleet → Service history** tab: work-order-style log of what was done to a vehicle, by whom,
  and for how much — separate from the single "next service due" reminder date already on each
  vehicle.
- **Tyres** (its own nav item): one row per physical tyre — vehicle, position, brand/size, install
  date/odometer, cost — with a "Log inspection" action for tread-depth readings over time and a
  "Remove" action that records removal date/odometer/reason. Cost-per-km is calculated
  automatically once a tyre has enough distance on it.
- **Finances → Fuel** tab: litre + odometer based fill-up logging, separate from the old generic
  "fuel" expense category. Log fill-ups here going forward, and mark "full tank" when applicable —
  that's what makes an accurate cost-per-km possible. (The old Expenses "fuel" category still
  works for a quick one-off entry, but won't feed into Reports' fuel figures — Reports will call
  out if a fuel amount was logged that way instead, so it doesn't go unnoticed.)
- **Staff**: each staff member now has an optional monthly salary field. MJW's drivers are paid a
  fixed monthly wage (not per trip/km), so this feeds Reports as a single fleet-wide overhead line
  rather than being split across vehicles.
- **Dashboard**: an "Attention needed" card now surfaces vehicle license discs, service dates,
  driver's licenses, and PDPs expiring within 30 days (previously tracked in the data but never
  surfaced anywhere).
- **Reports** (its own nav item): a fleet-wide profit & loss for this month or year-to-date,
  cost-per-km and profit per vehicle, revenue by client, and route-linked profit. Every table notes
  exactly what it includes and excludes — e.g. per-vehicle profit excludes driver wages (shown
  separately, fleet-wide), and route profit only counts expenses specifically tagged to that route.
  This is deliberately conservative rather than presenting a single confident-looking number built
  on assumptions the data can't actually support yet (e.g. allocating a driver's salary across the
  specific vehicles they drove, which isn't tracked).

## 10. Driver mobile login + dashboard photo

Drivers log in on their own phone (in the browser — no app to install) and get a simplified
mobile page instead of the full CRM: their active trips, a "Start trip" / "End trip" button that
opens the phone's camera, and a place to enter the odometer reading. The photo and reading are
saved to the trip record and show up in the CRM.

**How a driver's login gets linked to their staff record:** by email match — there's no separate
login-linking step in the UI. To set up a driver:

1. In Supabase, **Authentication → Users → Add user** — same as step 4 above — using the exact
   email address you want that driver to log in with.
2. In the CRM's **Staff** page, make sure that driver's staff record has that *same* email address
   (edit it if the seed data placeholder `.example` email is still there).
3. That's it — when they log in with that email, the app matches it to their staff record and
   sends them to the driver page automatically (anyone whose staff role isn't `driver` still gets
   the full CRM).

Photos upload to a Supabase Storage bucket called `trip-photos` (created by
`supabase/migrations/0002_driver_photos.sql` — run that migration the same way you ran the first
one, in the SQL Editor). The bucket is public so photos display via a plain URL; only signed-in
users can upload to it.

Note: like the rest of the app, this doesn't yet stop a driver from opening the browser's address
bar and typing in a full-CRM URL directly — every logged-in user still has full database access
(see the gaps list below). The driver page is a UI convenience, not a security boundary, until
proper per-role permissions are added.

## 11. Known gaps / suggested next steps

- No per-role permissions yet (any logged-in user, including a driver, can read/write anything in
  the database directly — the driver mobile page is a UI convenience, not an access restriction).
- No PDF export for quotes/invoices — they're viewable in-app only.
- No password-reset self-service flow for staff.
- Tracker map defaults to Paarl until real positions exist.
- Consider moving telematics API credentials into Supabase Vault or Edge Function secrets rather
  than a plain table, before connecting a real provider.
- Driver photo uploads aren't compressed before upload — fine on Wi-Fi, could be slow on a weak
  mobile signal. Worth revisiting if that turns out to be a problem in practice.
- No offline support on the driver page — if a driver has no signal when starting/ending a trip,
  the upload will fail and they'll need to retry once they have signal again.
