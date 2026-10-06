-- Impide volver a asignar la misma encuesta; no vincula respuestas anónimas con personas.
begin;
create or replace function public.guard_completed_climate_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Las respuestas también bloquean la encuesta: serializa asignación y envío.
 perform 1 from public.climate_surveys where id=new.survey_id for update;
 if exists(select 1 from public.climate_participation
   where survey_id=new.survey_id and employee_id=new.employee_id) then
   raise exception 'CLIMATE_ALREADY_RESPONDED' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function public.guard_completed_climate_assignment() from public,anon,authenticated;
create trigger climate_completed_assignment before insert or update on public.climate_assignments
for each row execute function public.guard_completed_climate_assignment();
commit;
