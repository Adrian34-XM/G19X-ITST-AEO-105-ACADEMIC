-- Separate anonymous visibility from policies that reference private tables.
-- Do not grant anonymous access to applications or candidate data.
alter policy vacancies_read on public.vacancies to authenticated;
drop policy if exists vacancies_public_read on public.vacancies;
create policy vacancies_public_read on public.vacancies
for select to anon using (status = 'PUBLISHED');
