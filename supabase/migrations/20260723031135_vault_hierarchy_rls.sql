-- Vault/Interviews hierarchy — Phase A (RLS). Owner-scoped policies for the new
-- tables, plus ADDITIVE transition policies on rounds/documents/sessions keyed
-- on the denormalized user_id / new parent. These are OR'd with the existing
-- application-based policies, so pre-backfill rows stay reachable via
-- application_id while new-hierarchy rows (no legacy application_id) are
-- reachable via user_id. The old application-based policies are removed in the
-- Phase E contract migration once application_id is gone.

alter table public.companies enable row level security;
alter table public.roles enable row level security;
alter table public.interviews enable row level security;

-- ------------------------------------------------------------ companies (CRUD)
create policy "companies_select_own" on public.companies for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "companies_insert_own" on public.companies for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "companies_update_own" on public.companies for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "companies_delete_own" on public.companies for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- roles (CRUD)
-- Writes must also reference a company the user owns.
create policy "roles_select_own" on public.roles for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "roles_insert_own" on public.roles for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.companies c
                where c.id = company_id and c.user_id = (select auth.uid()))
  );
create policy "roles_update_own" on public.roles for update
  to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.companies c
                where c.id = company_id and c.user_id = (select auth.uid()))
  );
create policy "roles_delete_own" on public.roles for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ----------------------------------------------------------- interviews (CRUD)
create policy "interviews_select_own" on public.interviews for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "interviews_insert_own" on public.interviews for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.roles r
                where r.id = role_id and r.user_id = (select auth.uid()))
  );
create policy "interviews_update_own" on public.interviews for update
  to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.roles r
                where r.id = role_id and r.user_id = (select auth.uid()))
  );
create policy "interviews_delete_own" on public.interviews for delete
  to authenticated using ((select auth.uid()) = user_id);

-- --------------------------------------------- rounds (additive transition RLS)
create policy "rounds_select_via_owner" on public.rounds for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "rounds_insert_via_interview" on public.rounds for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.interviews i
                where i.id = interview_id and i.user_id = (select auth.uid()))
  );
create policy "rounds_update_via_owner" on public.rounds for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "rounds_delete_via_owner" on public.rounds for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------ documents (additive transition RLS)
create policy "documents_select_via_owner" on public.documents for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "documents_insert_via_role" on public.documents for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.roles r
                where r.id = role_id and r.user_id = (select auth.uid()))
  );
create policy "documents_update_via_owner" on public.documents for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "documents_delete_via_owner" on public.documents for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------- sessions (additive transition RLS)
-- SELECT/DELETE are already user_id-based (cover all rows). Add interview-based
-- INSERT/UPDATE so sessions can be created under the new hierarchy; the round
-- (if any) must belong to the same interview.
create policy "sessions_insert_via_interview" on public.sessions for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.interviews i
                where i.id = interview_id and i.user_id = (select auth.uid()))
    and (
      round_id is null
      or exists (select 1 from public.rounds r
                 where r.id = round_id and r.interview_id = interview_id)
    )
  );
create policy "sessions_update_via_interview" on public.sessions for update
  to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.interviews i
                where i.id = interview_id and i.user_id = (select auth.uid()))
  );
