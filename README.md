# MJW Transport CRM

A production web app for MJW Transport (Marius Wiese) covering fleet/vehicles, staff, routes,
a GPS tracker/trip log, clients, and finances (quotes, invoices, expenses).

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

## 8. Known gaps / suggested next steps

- No per-role permissions yet (any logged-in user can edit anything).
- No PDF export for quotes/invoices — they're viewable in-app only.
- No password-reset self-service flow for staff.
- Tracker map defaults to Paarl until real positions exist.
- Consider moving telematics API credentials into Supabase Vault or Edge Function secrets rather
  than a plain table, before connecting a real provider.
