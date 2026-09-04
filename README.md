# Port Arthur PD Shift Scheduler

A progressive web application (PWA) for managing work schedules across a police department of **129+ officers**. It handles shift assignments, "The Book" of schedule views, PTO/vacation tracking, vacancy alerts, officer partnerships, staffing rules, and notifications — with tiered access for **officers**, **supervisors**, and **admins**.

Built with **React 18 + TypeScript**, **Vite**, **TailwindCSS**, **shadcn/ui**, and a **Supabase** backend (Postgres + Auth + Edge Functions). Deployed to **GitHub Pages**.

> **Live site:** https://port-arthur-police-department.github.io/scheduler/

---

## Table of Contents

- [Core Concepts](#core-concepts)
- [Features](#features)
- [Roles & Permissions](#roles--permissions)
- [The Tabs](#the-tabs)
- [How It Works (Architecture)](#how-it-works-architecture)
- [Data Model](#data-model)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [PWA & Notifications](#pwa--notifications)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)

---

## Core Concepts

The system is built around a few foundational ideas:

- **Shift types** define the departments' work shifts (e.g. Day Shift, Evening Shift), each with a start/end time.
- **Recurring schedules** define which officers work which shift on which days of the week, over a date range, optionally on a 4-week rotation (`week_offset`), and with a unit number / position.
- **Schedule exceptions** are one-off overrides for a specific date — extra shifts (overtime), PTO days off, partnership changes, or custom times. **Exceptions always take priority over recurring schedules.**
- **The Book** is the primary read view of the schedule: weekly, monthly, force list, vacation list, and beat preferences.
- **Minimum staffing** rules define how many officers/supervisors are required per shift per day of the week; the app uses these to detect **understaffed shifts** and create **vacancy alerts**.
- **Service credit** (years of service, with an optional manual override) drives seniority sorting, promotion logic, and PTO accrual bands.

---

## Features

### Schedule Management (Riding List & The Book)

- **Daily "Riding List" view** — shows each shift and the officers assigned today, with live staffing counts against minimum requirements. Auto-defaults to the logged-in officer's own shift.
- **The Book — Weekly view** — a full grid of all officers' schedules for a week, by shift. Extra shifts / overtime are grouped under a dedicated **"Overtime"** row while still appearing on the officer's primary shift for that date.
- **The Book — Monthly view** — a month-at-a-glance calendar of assignments and staffing.
- **The Book — Force List** — filter schedules by **True Force** vs **Regular Force** over a date range.
- **The Book — Vacation List** — yearly view of scheduled vacations / PTO across officers.
- **The Book — Beat Preferences** — record each officer's preferred and unavailable beats.
- **Schedule editing** — admins/supervisors can assign PTO, edit assignments, add/remove officers, set positions, and manage individual schedules.
- **PDF export** — export weekly, monthly, force list, vacation list, and beat-preference views to formatted PDFs (using `jspdf` + `jspdf-autotable`), with configurable layout/colors.

### PTO & Time Off

- **Time-off requests** — officers submit PTO requests; supervisors/admins review and approve/deny (approval auto-deducts the balance from the officer's profile via a DB trigger).
- **Bulk PTO assignment** — admins assign PTO across a date range and multiple shifts at once, with weekend exclusion, full/partial-day options, smart detection of which shifts the officer actually works, real-time hour totals, and balance validation.
- **PTO management panel** — view all officers' vacation/sick/comp/holiday balances, manual adjustments, and bulk accrual (sick time and annual PTO).
- **Accrual rules** — configure how vacation (tiered by service-credit years) and holiday (flat rate) time accrues.

### Staffing & Vacancies

- **Understaffed detection** — automatically scans the next 7 days for shifts below minimum staffing and surfaces supervisor/officer breakdowns.
- **Vacancy alerts** — create and broadcast open-shift alerts to active officers (email via Resend, SMS, and in-app), respecting each officer's notification preferences.
- **Officer responses** — officers can respond to vacancy alerts; supervisors can approve responses (which creates an extra-shift exception) or deny them with a reason.
- **Manual alert sender** — compose and dispatch alerts targeted at officers currently on specific shifts, via in-app and/or push channels, with alert type and urgency.

### Officer & Partnership Management

- **Staff directory** — searchable list of all officers (name, badge, rank, phone) with PTO balances, service credit, seniority, and promotion history.
- **Officer profiles** — create/edit profiles (personal info, rank, hire/birthday, promotion dates, PTO balances, service-credit override). Rank drives the user's app role automatically. Includes password reset and profile deletion (via Edge Functions).
- **Officer schedule manager** — manage an officer's recurring work schedules and default unit/position assignments (adding a default cascades to their active schedules).
- **Partnerships** — pair regular officers with Probationary Officers (PPOs) for ride-alongs, as one-time or recurring schedules, with validation and orphaned-partnership cleanup. PPOs are identified by their rank.

### Notifications & Alerts

- **In-app notification bell** — per-user notifications with unread badge, read tracking, and per-type icons/colors.
- **Push / browser notifications** — subscribe to the service worker for shift reminders, schedule updates, vacancy alerts, and emergency alerts.
- **Anniversary & birthday alerts** — background daily check that notifies configured recipients about officer anniversaries and birthdays (role-based visibility and countdown dashboards).
- **Audit log** — significant mutations (profile edits, officer-schedule creation/deletion, password resets, PTO adjustments, logins) are recorded to `audit_logs`, viewable and exportable to PDF by admins.

### Admin Settings (`Settings` tab)

A centralized panel backed by a single `website_settings` row, organized into tabs:

- **Notifications** — enable/disable the mass-alert system, vacancy-alert buttons, PTO request/status notifications, schedule-change notifications, and dashboard display.
- **PTO Settings** — toggle PTO balance visibility and which PTO types show in staff profiles.
- **PDF Layout** — page size, columns, fonts, headers, and per-item colors for exported PDFs (with live preview).
- **Events Dashboard** — visibility of birthdays, anniversaries, and awards by role.
- **Staffing Rules** — manage `minimum_staffing` rules per shift type and day of week.
- **Colors** — customize weekly schedule and PDF color schemes (with reset-to-defaults).
- **Alerts** — anniversary/birthday recipient roles and countdown settings.
- **System** — password reset, audit log viewer, and settings instructions.

---

## Roles & Permissions

Three app roles, ordered by hierarchy. Access is enforced via the `app_role` enum, RLS policies, and role-based UI.

| Role | Access |
|------|--------|
| **Officer** | View the Riding List and The Book, submit PTO requests, respond to vacancy alerts, manage their own notification preferences. |
| **Supervisor** | Everything officers can do, plus editing schedules, approving PTO and vacancy responses, managing officer schedules, and the Vacancies management tools. |
| **Admin** | Everything supervisors can do, plus the Settings tab, staff/profile management, audit logs, password resets, and system-wide configuration. |

Ranks (`officer_rank` enum) map to roles automatically: Chief/Deputy Chief → admin; Sergeant/Lieutenant/Secretary/Coordinator → supervisor; others → officer.

---

## The Tabs

The app uses a tabbed layout. Which tabs appear depends on role and settings (e.g. the PTO tab can be disabled via settings).

| Tab | Content |
|-----|---------|
| **Riding List** | Daily schedule view (staffing by shift). |
| **The Book** | Weekly, Monthly, Force List, Vacation List, and Beat Preferences views. |
| **Vacancies** | Vacancy alert management (supervisor/admin) or the officer's vacancy alert feed. |
| **Staff** | Officer directory and management (supervisor/admin). |
| **PTO** (conditional) | Time-off requests and PTO management. |
| **Settings** (admin) | System-wide configuration. |

Routing uses a **HashRouter** (URLs like `/#/dashboard`, `/#/the-book`, `/#/vacancies`), and there is a dedicated **mobile layout** with a bottom navigation bar and mobile-optimized components for every view.

---

## How It Works (Architecture)

```
React SPA (Vite) ──► Supabase JS client
      │                        │
      │   REST / Realtime      │
      ▼                        ▼
 Browser (PWA)            Supabase
 (Service Worker)      ├── Postgres (RLS-secured)
  ├─ Push               ├── Auth (email/password + JWT)
  ├─ Offline cache      ├── Edge Functions (Deno)
  └─ Background sync    └── Realtime subscriptions
```

- **Frontend:** A single-page React app. A `UserContext` provider manages auth state, and TanStack React Query handles server state (with real-time invalidation via Supabase Realtime subscriptions on schedule/notification tables).
- **Role gatekeeping:** The `Dashboard` component reads the user's role and conditionally renders admin/supervisor/officer tabs and actions. `useUserRole` and `permissions.ts` provide role checks.
- **Schedule calculation:** `staffingCalculations.ts` / `scheduleUtils.ts` merge recurring schedules with schedule exceptions for any date range, categorize officers (supervisors / officers / PPOs), and compare against `minimum_staffing`.
- **Shift auto-detection:** On login, the app looks up the user's active recurring schedule and pre-selects their assigned shift in the Riding List.
- **Backend:** Supabase handles authentication (JWT), row-level security, database triggers (e.g. PTO deduction on approval), and the `accrue_annual_pto` / `accrue_sick_time` / `get_service_credit` SQL functions. Four Edge Functions handle privileged actions (creating users, resetting passwords, sending vacancy/text alerts).

---

## Data Model

Core tables (managed in Supabase, secured with RLS):

- **`profiles`** — officer records: name, email, badge, phone, rank, hire/birthday dates, PTO balances, service-credit override.
- **`shift_types`** — shift definitions (name, start/end time, crosses-midnight flag).
- **`shift_positions`** — positions within a shift (allowed roles, overflow flag, ordering).
- **`recurring_schedules`** — recurring weekly assignments (officer, shift, day of week, date range, unit/position, 4-week `week_offset`, partnership flags).
- **`schedule_exceptions`** — one-off overrides (extra shifts, PTO/`is_off`, custom times, partnership suspension).
- **`time_off_requests`** — PTO requests with status, review notes, and reviewer.
- **`minimum_staffing`** — minimum officers/supervisors per shift per day of week.
- **`vacancy_alerts`** & **`vacancy_responses`** — open-shift postings and officer responses.
- **`pto_accrual_rules`** — accrual rules by service-credit band.
- **`user_roles`** — role assignments (`app_role`: officer/supervisor/admin).
- **`website_settings`** — global admin configuration (notification toggles, PTO visibility, colors, etc.).
- **`notifications`**, **`audit_logs`**, **`user_push_subscriptions`**, **`officer_beat_preferences`**, **`officer_default_assignments`**, **`partnership_exceptions`** — in-app notifications, audit trail, push subscriptions, and supporting data.

**SQL functions:** `accrue_annual_pto`, `accrue_sick_time`, `get_service_credit`, `has_role`, `has_admin_or_supervisor_role`.

**Edge Functions** (`supabase/functions/`): `create-user`, `update.password`, `send-vacancy-alert`, `send-text-alert`.

> **Note:** Several tables used by the app (`notifications`, `audit_logs`, `user_push_subscriptions`, and others) are not yet reflected in the generated `src/integrations/supabase/types.ts`. Only `pto_accrual_rules` and `user_roles` are created via migration files; the rest are set up directly in the Supabase project.

---

## Tech Stack

- **Frontend:** React 18.3, TypeScript 5.8, Vite 5 (SWC), React Router v6
- **UI:** TailwindCSS 3, shadcn/ui (Radix primitives), `lucide-react` icons, `next-themes` (light/dark/system)
- **State/Data:** TanStack React Query 5, react-hook-form + zod, `@supabase/supabase-js`
- **Charts / Export:** Recharts, jsPDF + jsPDF-AutoTable, html2canvas, date-fns
- **PWA:** vite-plugin-pwa (Workbox), service worker with push notifications and offline caching

---

## Project Structure

```
src/
├── App.tsx                  # Root: routing, PWA init, push/notification bootstrap
├── pages/
│   ├── Dashboard.tsx        # Main tabbed layout (role-gated)
│   └── Auth.tsx             # Login / sign-up
├── components/
│   ├── schedule/            # Riding List + "The Book" (desktop & mobile)
│   ├── admin/               # Staff, PTO, vacancies, partnerships, settings
│   ├── vacancy/             # Officer-facing vacancy alerts
│   ├── time-off/            # PTO request flow
│   └── ui/                  # shadcn/ui primitives
├── hooks/                   # React Query hooks, notifications, PDF exports
├── utils/                   # notifications, alerts, permissions, schedule math, PWA
├── lib/                     # audit logger, shared utils
├── context/                 # UserContext (auth)
└── integrations/supabase/   # Supabase client + generated types
supabase/
├── migrations/              # SQL migrations (RLS, functions, triggers)
└── functions/               # Edge Functions (Deno)
```

---

## Getting Started

**Prerequisites:** Node.js, npm (or bun), and a Supabase project.

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Preview the production build
npm run preview
```

**Environment:** Configure your Supabase URL and anon key in `.env`:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Apply the SQL migrations in `supabase/migrations/` to your Supabase project and deploy the Edge Functions in `supabase/functions/`.

---

## PWA & Notifications

The app is a full **Progressive Web App**: it can be installed from the browser (with a custom install prompt), works offline via Workbox caching, and registers a service worker for **push notifications**.

Notification capabilities include:
- Browser permission onboarding (a banner prompts officers to enable notifications).
- Shift reminders, schedule-update alerts, vacancy alerts, and emergency alerts.
- A daily background **anniversary/birthday check** via scheduled tasks and background sync.

See [`PWA_SETUP.md`](./PWA_SETUP.md) for the full PWA implementation guide.

> **Note:** Full push delivery currently uses a demo VAPID key and a placeholder `/api/save-subscription` endpoint; wire up a real VAPID key and push server to enable production push. SMS sending is currently simulated (Twilio is present but commented out).

---

## Deployment

Deployment targets **GitHub Pages** under the `scheduler` path (see `homepage` in `package.json` and the `base: './'` in `vite.config.ts`):

```bash
npm run predeploy   # clean + build
npm run deploy      # publish dist/ via gh-pages
```

---

## Known Limitations

- `supabasePushNotifications.ts` reads `NEXT_PUBLIC_*` (Next.js-style) env vars inside a Vite app, so they may be undefined at runtime — push requires real VAPID configuration.
- The Realtime subscription filters on `officer_id` while notifications are written with `user_id`, so live notification inserts may not always be received.
- `notifications`, `audit_logs`, and `user_push_subscriptions` are used but missing from the generated Supabase types (treated as untyped).
- Several tables are created directly in the Supabase project rather than in the `supabase/migrations/` folder.
- Heavy inline debug logging exists throughout the notification and dashboard code.
