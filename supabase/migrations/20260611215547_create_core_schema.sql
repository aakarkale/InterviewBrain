-- InterviewBrain core schema (SPEC.md Data Model).
-- RLS is enabled and policies are defined in the enable_rls_policies
-- migration; the competencies seed lives in seed_competencies.
-- The mind-map deliberately has no table: it is derived at render time
-- from applications, competencies, insights, and stories.

-- profile table: Supabase Auth owns identity; this mirrors auth.users
-- with extra profile columns
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text
);

-- keep public.users in sync with auth signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- one row per company/role the user is interviewing for
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  company_name text not null,
  role_title text not null,
  job_description text not null,
  resume text not null,
  hiring_manager text,
  team_name text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index applications_user_id_idx on public.applications (user_id);

-- per-round records inside an application
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  round_number int not null,
  round_type text not null
    check (round_type in ('recruiter', 'behavioral', 'product_sense', 'execution', 'other')),
  interviewer_name text,
  interviewer_role text,
  scheduled_date date,
  outcome text not null default 'upcoming'
    check (outcome in ('upcoming', 'completed', 'passed', 'rejected')),
  post_round_notes text,
  created_at timestamptz not null default now()
);

create index rounds_application_id_idx on public.rounds (application_id);

-- candidate-added context attached to an application; every type is
-- brain input and interviewer context
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  type text not null
    check (type in ('note', 'call_summary', 'call_transcript', 'other')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_application_id_idx on public.documents (application_id);

-- fixed competency taxonomy; stable slugs are the rubric keys every
-- session scores against, so ids are text and never renamed
create table public.competencies (
  id text primary key,
  name text not null,
  interview_type text not null
    check (interview_type in ('behavioral', 'product_sense', 'execution'))
);

create index competencies_interview_type_idx on public.competencies (interview_type);

-- mock interview sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
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
create index sessions_application_id_idx on public.sessions (application_id);
create index sessions_round_id_idx on public.sessions (round_id);

-- cross-application brain output; evidence must cite source rows
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

-- reusable STAR stories, user-level (cross-application)
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

-- shared updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger insights_set_updated_at
  before update on public.insights
  for each row execute function public.set_updated_at();

create trigger stories_set_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();
