-- Diagnóstico de solo lectura para el proyecto Supabase utilizado por la aplicación.
-- Cada fila PENDIENTE identifica un requisito ausente; no modifica tablas ni datos.
with expected(kind, object_name) as (values
 ('table','public.audit_logs'), ('table','public.orchestration_runs'),
 ('table','public.course_evidence'), ('table','public.onboarding_documents'),
 ('table','public.onboarding_learning'), ('table','public.onboarding_attempts'),
 ('table','public.profile_corrections'), ('table','public.task_messages'),
 ('table','public.climate_participation'), ('table','public.climate_assignments'),
 ('function','public.hr_hierarchy_ready()'),
 ('function','public.hiring_options_ready()'),
 ('function','public.assign_many(text,uuid[],jsonb)'),
 ('function','public.save_department(uuid,text)'),
 ('function','public.delete_unused_department(uuid)'),
 ('function','public.delete_unused_position(uuid)'),
 ('function','public.mx_working_day(date)'),
 ('function','public.next_working_day(date)'),
 ('function','public.withdraw_application(uuid)'),
 ('function','public.guard_completed_climate_assignment()'),
 ('trigger','public.climate_assignments:climate_completed_assignment'),
 ('trigger','public.tasks:working_day_guard'),
 ('trigger','public.interviews:working_day_guard'),
 ('trigger','public.onboarding_items:onboarding_learning_guard'),
 ('trigger','public.applications:candidate_application_guard')
), inspected as (
 select kind,object_name,case
 when kind='table' then to_regclass(object_name) is not null
 when kind='function' then to_regprocedure(object_name) is not null
 else exists(select 1 from pg_trigger t where t.tgrelid=to_regclass(split_part(object_name,':',1)) and t.tgname=split_part(object_name,':',2) and not t.tgisinternal and t.tgenabled <> 'D') end as present
 from expected
)
select kind as tipo,object_name as requisito,case when present then 'OK' else 'PENDIENTE' end as estado from inspected order by present,kind,object_name;
