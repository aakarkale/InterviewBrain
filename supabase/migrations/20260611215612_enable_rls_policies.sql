-- Row Level Security for every table (SPEC.md: RLS on every table).
-- All user data is owner-scoped. Child tables (rounds, documents)
-- derive ownership from their parent application. competencies is
-- global read-only seed data: no write policies, so writes are denied.
-- auth.uid() is wrapped in a scalar subquery so Postgres caches it
-- per statement instead of evaluating per row.

alter table public.users enable row level security;
alter table public.applications enable row level security;
alter table public.rounds enable row level security;
alter table public.documents enable row level security;
alter table public.competencies enable row level security;
alter table public.sessions enable row level security;
alter table public.insights enable row level security;
alter table public.stories enable row level security;

-- users: read/update own profile; inserts happen via the
-- security-definer signup trigger, deletes cascade from auth.users
create policy "users_select_own"
  on public.users for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "users_update_own"
  on public.users for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- applications: full owner CRUD
create policy "applications_select_own"
  on public.applications for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "applications_insert_own"
  on public.applications for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "applications_update_own"
  on public.applications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "applications_delete_own"
  on public.applications for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- rounds: owned through the parent application
create policy "rounds_select_own"
  on public.rounds for select
  to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

create policy "rounds_insert_own"
  on public.rounds for insert
  to authenticated
  with check (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

create policy "rounds_update_own"
  on public.rounds for update
  to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

create policy "rounds_delete_own"
  on public.rounds for delete
  to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

-- documents: owned through the parent application
create policy "documents_select_own"
  on public.documents for select
  to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

create policy "documents_update_own"
  on public.documents for update
  to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

create policy "documents_delete_own"
  on public.documents for delete
  to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

-- competencies: global read-only taxonomy
create policy "competencies_select_authenticated"
  on public.competencies for select
  to authenticated
  using (true);

-- sessions: owner CRUD; writes must also reference an application the
-- user owns so a session can never point into someone else's vault
create policy "sessions_select_own"
  on public.sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "sessions_insert_own"
  on public.sessions for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy "sessions_update_own"
  on public.sessions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy "sessions_delete_own"
  on public.sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- insights: owner CRUD
create policy "insights_select_own"
  on public.insights for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "insights_insert_own"
  on public.insights for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "insights_update_own"
  on public.insights for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "insights_delete_own"
  on public.insights for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- stories: owner CRUD
create policy "stories_select_own"
  on public.stories for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "stories_insert_own"
  on public.stories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "stories_update_own"
  on public.stories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "stories_delete_own"
  on public.stories for delete
  to authenticated
  using ((select auth.uid()) = user_id);
