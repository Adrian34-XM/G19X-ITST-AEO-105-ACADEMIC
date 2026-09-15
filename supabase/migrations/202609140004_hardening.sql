-- Invalidate recommendations whenever their inputs change.
create function public.invalidate_recommendations() returns trigger language plpgsql security definer set search_path='' as $$ begin
if TG_TABLE_NAME='candidates' then
 update public.applications set ai_result=null where candidate_id=new.id and ai_result is not null;
else
 update public.applications set ai_result=null where vacancy_id=new.id and ai_result is not null;
end if;return new;end $$;
create trigger candidate_ai_stale after update of skills,experience_years,cv_text on public.candidates for each row execute function public.invalidate_recommendations();
create trigger vacancy_ai_stale after update of requirements,skills,experience_required,description,title on public.vacancies for each row execute function public.invalidate_recommendations();
revoke all on function public.invalidate_recommendations() from public,anon,authenticated;
-- Keep all human-entered text bounded even when the REST RPC is called directly.
alter table public.candidates drop constraint candidates_profile_id_fkey;
alter table public.candidates add constraint candidates_profile_id_fkey foreign key(profile_id) references public.profiles(id) on delete cascade;
alter table public.departments add constraint department_name_length check(length(name) between 1 and 150);
alter table public.positions add constraint position_name_length check(length(name) between 1 and 150);
alter table public.vacancies add constraint vacancy_text_length check(length(description) between 1 and 14000 and length(requirements) between 1 and 14000 and cardinality(skills)<=40);
alter table public.candidates add constraint candidate_text_length check(length(phone)<=40 and cardinality(skills)<=40 and length(cv_text)<=14000);
alter table public.courses add constraint course_text_length check(length(title) between 1 and 150 and length(content) between 1 and 14000 and length(description) between 1 and 14000 and duration_minutes<=10000);
alter table public.tasks add constraint task_text_length check(length(title) between 1 and 150 and length(description) between 1 and 14000 and length(comments)<=4000);
alter table public.interviews add constraint interview_notes_length check(length(notes)<=4000);
-- Deactivate privileged helper execution unless needed by an authenticated policy.
revoke all on function public.owns_candidate(uuid),public.owns_employee(uuid),public.manages_employee(uuid),public.read_employee(uuid),public.read_application(uuid) from public;
grant execute on function public.owns_candidate(uuid),public.owns_employee(uuid),public.manages_employee(uuid),public.read_employee(uuid),public.read_application(uuid) to authenticated,anon;
grant all on all tables in schema public to service_role;
