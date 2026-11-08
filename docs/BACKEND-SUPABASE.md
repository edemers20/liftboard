# Lift Board backend (Supabase)

Replaces the Vercel draft in `docs/BACKEND.md` for the React Native app. Same principle: **the plan is computed on the phone by the engine; the server stores inputs and logs.** The app works fully offline and syncs when it can.

## Projects and keys
- Two Supabase projects: `liftboard-dev` and `liftboard-prod`.
- The app gets only the project URL and the public **anon** key (as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- The **service role** key never goes in the app or the repo. It lives in Supabase (for Edge Functions) and EAS secrets if a build step needs it.
- Every schema change is a SQL file in `supabase/migrations/`, created with `supabase migration new <name>`. Never edit tables by clicking in the dashboard.

## Auth
- Email one-time code (Supabase Auth, "Email OTP"). No passwords, no magic links, no social sign-in.
- Use a custom SMTP sender (for example Resend) on your own domain; Supabase's built-in sender is for testing.
- Beta cap: keep an `invites` table of allowed emails and reject sign-ups not on it (a database hook or a check before sending the code).

## Tables (version 1)

```sql
-- Who the person is; one row per account
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  name text,
  units text not null default 'lb',          -- 'lb' | 'kg'
  week_start text not null default 'Mon',    -- 'Mon' | 'Sun'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The engine's saved state (wk, slots, exHist), so a new phone can restore everything
create table app_state (
  user_id uuid primary key references auth.users on delete cascade,
  version int not null default 1,            -- bump when the engine's data shape changes
  wk jsonb not null,
  slots jsonb not null,
  ex_hist jsonb not null,
  updated_at timestamptz not null default now()
);

-- One row per lift or activity
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id text not null,                   -- id made on the phone, for de-duplicating syncs
  at timestamptz not null,
  kind text not null,                        -- 'lift' or an activity key ('pickle', 'yoga', ...)
  day_id text,                               -- engine day id for lifts ('d1'...)
  title text,
  minutes int,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- Exercises: shared list plus each person's custom ones
create table exercises (
  id text primary key,                       -- stable slug, e.g. 'hip-thrust-barbell'
  name text not null,
  owner uuid references auth.users on delete cascade   -- null = shared
);

-- One row per logged set
create table set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id text not null,
  session_client_id text not null,
  exercise_id text not null references exercises,
  set_index int not null,
  weight numeric,                            -- always stored in lb
  reps int,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- Beta usage events; no health values in here
create table events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,                        -- 'day_done', 'exercise_swapped', 'onboarding_finished', ...
  props jsonb,
  at timestamptz not null default now()
);
```

## Row-level security
Turn on RLS for every table. Each person can only see and change their own rows:

```sql
alter table sessions enable row level security;
create policy "own rows" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- repeat for profiles, app_state, set_logs, events
-- exercises: everyone can read shared rows (owner is null) and their own; only write their own
```

## Sync (offline first)
1. The engine reads and writes MMKV on the phone, exactly like the web app does with local storage.
2. Every change to a session or set gets a `client_id` and `updated_at` and goes into an outbox in MMKV.
3. When online (app open, network back, or after a change), push the outbox with upserts on `(user_id, client_id)`, then pull rows changed since the last sync time. Last write wins per row.
4. `app_state` is upserted after each change, debounced (for example every 10 seconds).
5. Deletes are soft (`deleted = true`) so they sync too.
6. New phone: sign in → download `app_state`, then sessions and set logs → `init(storage)` → done.

## Edge Functions (the only server code)
- `delete-account`: deletes the auth user (cascades every row). Required by Apple for any app with sign-up.
- `export-data`: returns all of the person's rows as one JSON file.

## Migrating the web app data
One-time "Import a Lift Board backup" screen after first sign-in: read the backup JSON, write its three objects to MMKV, call `init(storage)`, then upload `app_state` and turn `wk.sessions` into `sessions` rows. Set history from the web app is top sets only (`exHist`). After import, the Lifts / Activities / Weeks active counts must match the web app.
