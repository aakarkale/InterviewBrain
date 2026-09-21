-- InterviewBrain schema for Neon (ported from Supabase).
--
-- Differences from the Supabase original, and why:
--
-- 1. public.users.id references neon_auth."user"(id) instead of auth.users(id).
--    Neon Auth (Managed Better Auth) stores identities in the neon_auth schema,
--    and its user ids are uuid -- the same type Supabase used -- so every
--    user_id column carries over unchanged.
--
-- 2. RLS policies are VERBATIM copies of the Supabase ones. Neon's
--    pg_session_jwt ships auth.uid() returning uuid, matching Supabase's
--    signature exactly. (Neon's migration guide suggests rewriting auth.uid()
--    to auth.user_id(), but that returns text and would force a cast against
--    every uuid column here, so it is deliberately not used.)
--
-- 3. The legacy `applications` table and the roles/interviews
--    legacy_application_id columns are dropped. They were retained only as a
--    rollback path for the vault migration; no application code reads them.
--
-- 4. The sessions insert policy's round check is fixed -- see the note there.
--
-- 5. Supabase's on-signup trigger against auth.users is gone. Neon Auth owns
--    identity, so the app upserts its public.users profile row after sign-in.

-- ---------------------------------------------------------------- profiles
-- Mirrors the authenticated identity. Neon Auth owns email/name; this holds
-- app-level profile fields and is the FK target for all owned rows.
create table public.users (
  id uuid primary key references neon_auth."user" (id) on delete cascade,
  full_name text
);

-- ------------------------------------------------------------ competencies
-- Global reference data (not user-owned): the rubric every session is scored
-- against and every insight is tagged with.
create table public.competencies (
  id text primary key,
  name text not null,
  interview_type text not null
    check (interview_type in ('behavioral', 'product_sense', 'execution'))
);

create index competencies_interview_type_idx
  on public.competencies (interview_type);

-- --------------------------------------------------------------- companies
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
-- One vault per company name per user (case/whitespace insensitive).
create unique index companies_user_id_name_key
  on public.companies (user_id, lower(btrim(name)));

-- ------------------------------------------------------------------- roles
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index roles_user_id_idx on public.roles (user_id);
create index roles_company_id_idx on public.roles (company_id);

-- -------------------------------------------------------------- interviews
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interviews_user_id_idx on public.interviews (user_id);
create index interviews_role_id_idx on public.interviews (role_id);

-- ------------------------------------------------------------------ rounds
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  interview_id uuid not null references public.interviews (id) on delete cascade,
  round_number integer not null,
  round_name text,
  round_type text not null
    check (round_type in ('recruiter', 'behavioral', 'product_sense', 'execution', 'other')),
  interviewer_name text,
  interviewer_role text,
  scheduled_date date,
  outcome text not null default 'upcoming'
    check (outcome in ('upcoming', 'completed', 'passed', 'rejected')),
  post_round_notes text,
  transcript text,
  summary text,
  coaching jsonb,
  coaching_generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index rounds_user_id_idx on public.rounds (user_id);
create index rounds_interview_id_idx on public.rounds (interview_id);

-- --------------------------------------------------------------- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  type text not null
    check (type in ('note', 'call_summary', 'call_transcript', 'other')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_id_idx on public.documents (user_id);
create index documents_role_id_idx on public.documents (role_id);

-- ---------------------------------------------------------------- sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  interview_id uuid not null references public.interviews (id) on delete cascade,
  round_id uuid references public.rounds (id) on delete set null,
  interview_type text not null
    check (interview_type in ('behavioral', 'product_sense', 'execution')),
  transcript jsonb not null default '[]'::jsonb,
  feedback_summary text,
  rubric_scores jsonb,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index sessions_user_id_idx on public.sessions (user_id);
create index sessions_interview_id_idx on public.sessions (interview_id);
create index sessions_round_id_idx on public.sessions (round_id);

-- ---------------------------------------------------------------- insights
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('weakness', 'strength', 'pattern')),
  competency_id text references public.competencies (id),
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'stale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index insights_user_id_idx on public.insights (user_id);
create index insights_competency_id_idx on public.insights (competency_id);

-- ----------------------------------------------------------------- stories
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  content text not null,
  competency_tags jsonb not null default '[]'::jsonb,
  source_session_id uuid references public.sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stories_user_id_idx on public.stories (user_id);
create index stories_source_session_id_idx on public.stories (source_session_id);

-- ------------------------------------------------------- updated_at trigger
-- search_path is pinned empty and execute revoked, per the repo's existing
-- function-hardening convention.
create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anonymous, authenticated;

create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();
create trigger interviews_set_updated_at before update on public.interviews
  for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger insights_set_updated_at before update on public.insights
  for each row execute function public.set_updated_at();
create trigger stories_set_updated_at before update on public.stories
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------- RLS
-- Owner-scoped throughout. auth.uid() is wrapped in a scalar subselect so the
-- planner evaluates it once per statement rather than per row.

alter table public.users enable row level security;
alter table public.competencies enable row level security;
alter table public.companies enable row level security;
alter table public.roles enable row level security;
alter table public.interviews enable row level security;
alter table public.rounds enable row level security;
alter table public.documents enable row level security;
alter table public.sessions enable row level security;
alter table public.insights enable row level security;
alter table public.stories enable row level security;

-- users --------------------------------------------------------------------
-- NOTE: insert is new. Supabase created this row from a trigger on
-- auth.users; Neon Auth owns identity outside this database, so the app
-- upserts its own profile row and needs an insert policy to do it.
create policy users_select_own on public.users
  for select using ((select auth.uid()) = id);
create policy users_insert_own on public.users
  for insert with check ((select auth.uid()) = id);
create policy users_update_own on public.users
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- competencies -------------------------------------------------------------
-- Global reference data: readable by any signed-in user, written by migrations.
create policy competencies_select_authenticated on public.competencies
  for select using (true);

-- companies ----------------------------------------------------------------
create policy companies_select_own on public.companies
  for select using ((select auth.uid()) = user_id);
create policy companies_insert_own on public.companies
  for insert with check ((select auth.uid()) = user_id);
create policy companies_update_own on public.companies
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy companies_delete_own on public.companies
  for delete using ((select auth.uid()) = user_id);

-- roles --------------------------------------------------------------------
create policy roles_select_own on public.roles
  for select using ((select auth.uid()) = user_id);
create policy roles_insert_own on public.roles
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.companies c
      where c.id = roles.company_id and c.user_id = (select auth.uid())
    )
  );
create policy roles_update_own on public.roles
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.companies c
      where c.id = roles.company_id and c.user_id = (select auth.uid())
    )
  );
create policy roles_delete_own on public.roles
  for delete using ((select auth.uid()) = user_id);

-- interviews ---------------------------------------------------------------
create policy interviews_select_own on public.interviews
  for select using ((select auth.uid()) = user_id);
create policy interviews_insert_own on public.interviews
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.roles r
      where r.id = interviews.role_id and r.user_id = (select auth.uid())
    )
  );
create policy interviews_update_own on public.interviews
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.roles r
      where r.id = interviews.role_id and r.user_id = (select auth.uid())
    )
  );
create policy interviews_delete_own on public.interviews
  for delete using ((select auth.uid()) = user_id);

-- rounds -------------------------------------------------------------------
create policy rounds_select_via_owner on public.rounds
  for select using ((select auth.uid()) = user_id);
create policy rounds_insert_via_interview on public.rounds
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.interviews i
      where i.id = rounds.interview_id and i.user_id = (select auth.uid())
    )
  );
create policy rounds_update_via_owner on public.rounds
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy rounds_delete_via_owner on public.rounds
  for delete using ((select auth.uid()) = user_id);

-- documents ----------------------------------------------------------------
create policy documents_select_via_owner on public.documents
  for select using ((select auth.uid()) = user_id);
create policy documents_insert_via_role on public.documents
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.roles r
      where r.id = documents.role_id and r.user_id = (select auth.uid())
    )
  );
create policy documents_update_via_owner on public.documents
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy documents_delete_via_owner on public.documents
  for delete using ((select auth.uid()) = user_id);

-- sessions -----------------------------------------------------------------
create policy sessions_select_own on public.sessions
  for select using ((select auth.uid()) = user_id);
-- BUGFIX vs the Supabase original, which read `r.interview_id = r.interview_id`
-- -- a tautology that let a session attach to a round from a DIFFERENT
-- interview. The round must belong to the session's own interview.
create policy sessions_insert_via_interview on public.sessions
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.interviews i
      where i.id = sessions.interview_id and i.user_id = (select auth.uid())
    )
    and (
      round_id is null
      or exists (
        select 1 from public.rounds r
        where r.id = sessions.round_id and r.interview_id = sessions.interview_id
      )
    )
  );
create policy sessions_update_via_interview on public.sessions
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.interviews i
      where i.id = sessions.interview_id and i.user_id = (select auth.uid())
    )
  );
create policy sessions_delete_own on public.sessions
  for delete using ((select auth.uid()) = user_id);

-- insights -----------------------------------------------------------------
create policy insights_select_own on public.insights
  for select using ((select auth.uid()) = user_id);
create policy insights_insert_own on public.insights
  for insert with check ((select auth.uid()) = user_id);
create policy insights_update_own on public.insights
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy insights_delete_own on public.insights
  for delete using ((select auth.uid()) = user_id);

-- stories ------------------------------------------------------------------
create policy stories_select_own on public.stories
  for select using ((select auth.uid()) = user_id);
create policy stories_insert_own on public.stories
  for insert with check ((select auth.uid()) = user_id);
create policy stories_update_own on public.stories
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy stories_delete_own on public.stories
  for delete using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------ grants
-- The Data API connects as `authenticated` (signed-in) or `anonymous`. RLS
-- still gates every row; these grants only make the tables reachable.
grant usage on schema public to authenticated, anonymous;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Nothing in this app is readable while signed out, so `anonymous` gets no
-- table grants at all.

-- -------------------------------------------------------------------- seed
insert into public.competencies (id, name, interview_type) values
  ('ambiguity_adaptability', 'Adaptability in Ambiguity', 'behavioral'),
  ('conflict_navigation', 'Conflict Navigation', 'behavioral'),
  ('failure_growth', 'Failure & Growth', 'behavioral'),
  ('impact_storytelling', 'Impact Storytelling', 'behavioral'),
  ('influencing_stakeholders', 'Influencing & Stakeholder Management', 'behavioral'),
  ('ownership_initiative', 'Ownership & Initiative', 'behavioral'),
  ('team_leadership', 'Team Leadership & Collaboration', 'behavioral'),
  ('execution_planning', 'Execution Planning & Risk', 'execution'),
  ('experiment_design', 'Experiment Design & Interpretation', 'execution'),
  ('metric_definition', 'Metric Definition & Goal Setting', 'execution'),
  ('metric_diagnosis', 'Metric Diagnosis', 'execution'),
  ('structured_problem_solving', 'Structured Problem Solving', 'execution'),
  ('tradeoff_judgment', 'Trade-off Judgment', 'execution'),
  ('prioritization_tradeoffs', 'Prioritization & Trade-offs', 'product_sense'),
  ('problem_framing', 'Problem Framing & Scoping', 'product_sense'),
  ('product_metrics', 'Product Success Metrics', 'product_sense'),
  ('solution_creativity', 'Solution Creativity', 'product_sense'),
  ('strategic_alignment', 'Strategic & Business Alignment', 'product_sense'),
  ('user_empathy', 'User Empathy & Problem Discovery', 'product_sense')
on conflict (id) do nothing;
