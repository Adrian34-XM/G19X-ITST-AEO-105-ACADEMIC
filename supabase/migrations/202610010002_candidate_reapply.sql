-- Reactivar únicamente retiros propios en vacantes publicadas, conservando auditoría.
create or replace function public.guard_application_candidate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and old.status='RETIRADO' and new.status<>'RETIRADO' then
  if new.status<>'POSTULADO' or public.current_role() is distinct from 'CANDIDATO'::public.app_role
   or not exists(select 1 from public.candidates where id=old.candidate_id and profile_id=auth.uid())
   or new.candidate_id<>old.candidate_id or new.vacancy_id<>old.vacancy_id then
   raise insufficient_privilege;
  end if;
  if not exists(select 1 from public.vacancies where id=new.vacancy_id and status='PUBLISHED') then
   raise exception 'VACANCY_CLOSED' using errcode='22023';
  end if;
 end if;
 if TG_OP='INSERT' or (TG_OP='UPDATE' and old.status='RETIRADO' and new.status='POSTULADO') then
  if not exists(select 1 from public.candidates where id=new.candidate_id and nullif(trim(cv_path),'') is not null) then
   raise exception 'CV_REQUIRED' using errcode='22023';
  end if;
 end if;
 return new;
end $$;

do $migration$
declare definition text; original text := 'insert into public.applications(candidate_id,vacancy_id) values(cid,v.id) returning id into rid;';
begin
 definition := pg_get_functiondef('public.workforce_legacy_command(text,jsonb)'::regprocedure);
 if position(original in definition)=0 then raise exception 'No se encontró application.create. Revisa las migraciones anteriores.'; end if;
 definition := replace(definition, original, $replacement$
 insert into public.applications(candidate_id,vacancy_id) values(cid,v.id)
 on conflict(candidate_id,vacancy_id) do update
 set status='POSTULADO', ai_result=null, applied_at=now(), updated_at=now()
 where public.applications.status='RETIRADO'
 returning id into rid;
 if rid is null then raise exception 'APPLICATION_EXISTS' using errcode='23505'; end if;
 $replacement$);
 execute definition;
end $migration$;
