-- Vault/Interviews hierarchy — Phase B (backfill). Runs as the migration role,
-- so RLS never blocks it. Every statement is guarded (where new col is null /
-- not exists) so re-running is a no-op. Additive only: old application_id
-- columns are left intact for rollback until Phase E.

-- 1. Companies, deduped by (user_id, lower(trim(name))): two applications at the
--    same employer become one company with two roles.
insert into public.companies (user_id, name)
select distinct on (a.user_id, lower(trim(a.company_name)))
       a.user_id, a.company_name
from public.applications a
where not exists (
  select 1 from public.companies c
  where c.user_id = a.user_id
    and lower(trim(c.name)) = lower(trim(a.company_name))
)
order by a.user_id, lower(trim(a.company_name)), a.created_at;

-- 2. Roles: one per application, carrying JD/resume/hiring_manager/team, with the
--    round plan seeded from that application's existing rounds.
insert into public.roles (
  user_id, company_id, title, job_description, resume,
  hiring_manager, team_name, is_archived, round_plan, legacy_application_id, created_at
)
select a.user_id, c.id, a.role_title, a.job_description, a.resume,
       a.hiring_manager, a.team_name, a.is_archived,
       coalesce((
         select jsonb_agg(
                  jsonb_build_object(
                    'name', initcap(replace(r.round_type, '_', ' ')),
                    'type', r.round_type)
                  order by r.round_number)
         from public.rounds r where r.application_id = a.id
       ), '[]'::jsonb),
       a.id, a.created_at
from public.applications a
join public.companies c
  on c.user_id = a.user_id
 and lower(trim(c.name)) = lower(trim(a.company_name))
where not exists (
  select 1 from public.roles ro where ro.legacy_application_id = a.id
);

-- 3. Interviews: one default interview per migrated role.
insert into public.interviews (user_id, role_id, label, status, legacy_application_id, created_at)
select ro.user_id, ro.id, 'Interview', 'active', ro.legacy_application_id, ro.created_at
from public.roles ro
where ro.legacy_application_id is not null
  and not exists (
    select 1 from public.interviews iv
    where iv.legacy_application_id = ro.legacy_application_id
  );

-- 4. Re-parent rounds to the default interview; stamp user_id + round_name.
update public.rounds r
set interview_id = iv.id,
    user_id = a.user_id,
    round_name = coalesce(r.round_name, initcap(replace(r.round_type, '_', ' ')))
from public.applications a
join public.interviews iv on iv.legacy_application_id = a.id
where r.application_id = a.id and r.interview_id is null;

-- 5. Re-point sessions to the default interview (user_id already present).
update public.sessions s
set interview_id = iv.id
from public.interviews iv
where iv.legacy_application_id = s.application_id and s.interview_id is null;

-- 6. Re-parent documents to the role; stamp user_id.
update public.documents d
set role_id = ro.id,
    user_id = ro.user_id
from public.roles ro
where ro.legacy_application_id = d.application_id and d.role_id is null;

-- 7. Remap any insight evidence that cited an application to its company (the
--    brain already treated "application" as the company node). No-op when none.
with mapping as (
  select ro.legacy_application_id as app_id, ro.company_id
  from public.roles ro
  where ro.legacy_application_id is not null
)
update public.insights ins
set evidence = (
  select jsonb_agg(
    case
      when (e->>'source_type') = 'application' and m.company_id is not null
        then jsonb_build_object('source_type', 'company', 'source_id', m.company_id::text)
      else e
    end)
  from jsonb_array_elements(ins.evidence) e
  left join mapping m on m.app_id::text = (e->>'source_id')
)
where ins.evidence is not null
  and jsonb_typeof(ins.evidence) = 'array'
  and exists (
    select 1 from jsonb_array_elements(ins.evidence) e2
    where e2->>'source_type' = 'application'
  );
