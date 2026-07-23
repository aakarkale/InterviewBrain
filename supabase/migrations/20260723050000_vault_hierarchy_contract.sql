-- Vault/Interviews hierarchy — Phase E (contract). DESTRUCTIVE.
--
-- ⚠️  DO NOT APPLY until the new Vault/Interviews code is deployed to
--     production. This drops the application_id columns that the pre-migration
--     app still reads; running it before the new code is live breaks prod.
--     Expand → migrate → contract: Phases A/B (additive) shipped ahead of the
--     code; this contract runs only after the code cutover is deployed and
--     verified. Apply via the Supabase MCP once that's true.
--
-- Removes the transitional application-based policies and the now-redundant
-- application_id columns, and enforces the new NOT NULL parents. The
-- `applications` table itself is kept one release as a safety net (its rows are
-- still reachable by legacy_application_id for rollback); a later migration
-- drops it.

-- ---------------------------------------------------------------------- rounds
drop policy if exists "rounds_select_own" on public.rounds;
drop policy if exists "rounds_insert_own" on public.rounds;
drop policy if exists "rounds_update_own" on public.rounds;
drop policy if exists "rounds_delete_own" on public.rounds;

alter table public.rounds alter column interview_id set not null;
alter table public.rounds alter column user_id set not null;
alter table public.rounds drop column application_id;

-- ------------------------------------------------------------------- documents
drop policy if exists "documents_select_own" on public.documents;
drop policy if exists "documents_insert_own" on public.documents;
drop policy if exists "documents_update_own" on public.documents;
drop policy if exists "documents_delete_own" on public.documents;

alter table public.documents alter column role_id set not null;
alter table public.documents alter column user_id set not null;
alter table public.documents drop column application_id;

-- -------------------------------------------------------------------- sessions
-- select/delete are already user_id-based and stay; only the application-based
-- insert/update policies are replaced (the interview-based ones from Phase A
-- take over).
drop policy if exists "sessions_insert_own" on public.sessions;
drop policy if exists "sessions_update_own" on public.sessions;

alter table public.sessions alter column interview_id set not null;
alter table public.sessions drop column application_id;
