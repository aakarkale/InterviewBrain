-- Vault/Interviews hierarchy — Phase A (expand): additive schema only.
-- Splits the flat `applications` row into Company (Vault) -> Role -> Interview,
-- with rounds re-parented to interviews and documents to roles. Old
-- `application_id` columns are kept (made nullable) so the app keeps running on
-- the old path until the code cutover; the backfill (Phase B) and the
-- destructive contract (Phase E) are separate migrations.
--
-- Ownership is denormalized (user_id on every table) so RLS stays flat instead
-- of chaining EXISTS four levels deep — the same pattern sessions already uses.

-- ------------------------------------------------------------------ companies
-- One row per company the user is interviewing at (the "Vault"). Holds the
-- cached, web-grounded company insights (details / H1B / funding / leadership).
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  h1b_tracking_enabled boolean not null default false,
  insights jsonb,
  insights_generated_at timestamptz,
  insights_input_fingerprint text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_user_id_idx on public.companies (user_id);
-- One vault tile per company per user (realizes "one vault -> many roles").
create unique index companies_user_id_name_key
  on public.companies (user_id, lower(trim(name)));

-- ---------------------------------------------------------------------- roles
-- One row per role inside a company. Holds the JD, resume, research, LinkedIn
-- profile text, the reusable round plan template, and cached role-alignment
-- insights.
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  job_description text not null,
  resume text not null,
  research_notes text,
  linkedin_profile text,
  round_plan jsonb not null default '[]'::jsonb,
  alignment jsonb,
  alignment_generated_at timestamptz,
  alignment_input_fingerprint text,
  hiring_manager text,
  team_name text,
  is_archived boolean not null default false,
  legacy_application_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index roles_user_id_idx on public.roles (user_id);
create index roles_company_id_idx on public.roles (company_id);

-- ----------------------------------------------------------------- interviews
-- One interview instance for a role. A role can have several over time. Holds
-- cached interview-prep guidance. Rounds are snapshotted from the role's
-- round_plan at creation and hang off the interview.
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  label text not null default 'Interview',
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  scheduled_date date,
  prep jsonb,
  prep_generated_at timestamptz,
  prep_input_fingerprint text,
  legacy_application_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interviews_user_id_idx on public.interviews (user_id);
create index interviews_role_id_idx on public.interviews (role_id);

-- --------------------------------------------------------- rounds (re-parent)
-- Rounds move from application_id to interview_id and gain per-round prep
-- surfaces (transcript / summary / round-to-round coaching cache) plus a
-- freeform round_name (the plan entry's label). application_id kept nullable
-- through the transition; dropped in Phase E.
alter table public.rounds
  add column interview_id uuid references public.interviews (id) on delete cascade,
  add column user_id uuid references public.users (id) on delete cascade,
  add column round_name text,
  add column transcript text,
  add column summary text,
  add column coaching jsonb,
  add column coaching_generated_at timestamptz;

alter table public.rounds alter column application_id drop not null;

create index rounds_interview_id_idx on public.rounds (interview_id);
create index rounds_user_id_idx on public.rounds (user_id);

-- ------------------------------------------------------ documents (re-parent)
alter table public.documents
  add column role_id uuid references public.roles (id) on delete cascade,
  add column user_id uuid references public.users (id) on delete cascade;

alter table public.documents alter column application_id drop not null;

create index documents_role_id_idx on public.documents (role_id);
create index documents_user_id_idx on public.documents (user_id);

-- ------------------------------------------------------- sessions (re-point)
-- Practice sessions belong to an interview (company/role reachable by join).
-- round_id and user_id already exist. application_id kept nullable in transition.
alter table public.sessions
  add column interview_id uuid references public.interviews (id) on delete cascade;

alter table public.sessions alter column application_id drop not null;

create index sessions_interview_id_idx on public.sessions (interview_id);

-- ------------------------------------------------------ updated_at triggers
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

create trigger interviews_set_updated_at
  before update on public.interviews
  for each row execute function public.set_updated_at();
