-- Jerarquía de RH, entregas revisables e historiales. Todas las escrituras conservan permisos SQL.
begin;
-- Una cuenta de RH con registro laboral también puede entregar sus propias actividades.
create or replace function public.owns_employee(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.employees where id=eid and profile_id=auth.uid() and status='ACTIVE') and public.current_role() in ('EMPLEADO','JEFE','RH_ADMIN');
$$;
alter table public.onboarding_items drop constraint onboarding_items_status_check;
alter table public.onboarding_items add constraint onboarding_items_status_check check(status in ('PENDING','IN_PROGRESS','SUBMITTED','COMPLETED'));
alter table public.onboarding_items add column review_comments text not null default '', add column reviewed_by uuid references public.profiles, add column reviewed_at timestamptz;
alter table public.onboarding_documents add column item_id uuid references public.onboarding_items;
alter table public.courses add column department_id uuid references public.departments, add column position_id uuid references public.positions;
alter table public.course_assignments drop constraint course_assignments_status_check;
alter table public.course_assignments add constraint course_assignments_status_check check(status in ('ASSIGNED','IN_PROGRESS','SUBMITTED','COMPLETED'));
alter table public.course_assignments add column reviewed_by uuid references public.profiles, add column reviewed_at timestamptz, add column review_comments text not null default '';

-- RH también puede ocupar puestos y dirigir equipos. Se conservan los controles de ciclos.
do $patch$ declare definition text; begin
 select pg_get_functiondef('public.validate_manager_tree()'::regprocedure) into definition;
 definition:=replace(definition,'p.role=''JEFE''','p.role in (''JEFE'',''RH_ADMIN'')');
 execute definition;
end $patch$;
create function public.protect_own_position() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.profile_id=auth.uid() and new.position_id is distinct from old.position_id and public.current_role()<>'SUPERUSER' then raise insufficient_privilege; end if;
 return new;
end $$;
create trigger protect_own_position before update on public.employees for each row execute function public.protect_own_position();

create or replace function public.guard_onboarding_step() returns trigger language plpgsql security definer set search_path='' as $$
declare eid uuid; begin
 select employee_id into eid from public.onboarding where id=new.onboarding_id for update;
 if new.status='COMPLETED' and old.status<>'COMPLETED' then
  if not public.is_hr() or old.status<>'SUBMITTED' or (public.owns_employee(eid) and public.current_role()<>'SUPERUSER') then raise insufficient_privilege; end if;
  if new.requires_document and not exists(select 1 from public.onboarding_documents where item_id=new.id and status='APPROVED') then raise exception 'DOCUMENT_REQUIRED' using errcode='22023'; end if;
  -- Toda entrega de la actividad debe revisarse antes de aprobarla.
  if exists(select 1 from public.onboarding_documents where item_id=new.id and status='SUBMITTED') then raise exception 'DOCUMENT_REVIEW_PENDING' using errcode='22023'; end if;
 end if;
 return new;
end $$;

alter function public.onboarding_command(text,jsonb) rename to onboarding_legacy_command;
revoke all on function public.onboarding_legacy_command(text,jsonb) from public,anon,authenticated;
create function public.onboarding_command(op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.onboarding_items; eid uuid; oid uuid; path text; begin
 if public.current_role() is null then raise insufficient_privilege; end if;
 if op='item.save' and exists(select 1 from public.onboarding_items where id=(payload->>'id')::uuid and status in ('SUBMITTED','COMPLETED')) then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
 if op='plan.start' then
  eid:=(payload->>'employee_id')::uuid;
  if not public.is_hr() or not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=eid and e.status='ACTIVE' and p.active) then raise insufficient_privilege; end if;
  insert into public.onboarding(employee_id) values(eid) returning id into oid;
  perform public.initialize_onboarding(oid);
  return jsonb_build_object('id',oid);
 elsif op in ('item.complete','item.review','document.attach') then
  -- Serializa entregas, adjuntos y revisión del mismo paso.
  select * into item from public.onboarding_items where id=(payload->>'id')::uuid for update;
  if not found then raise no_data_found; end if;
  select employee_id into eid from public.onboarding where id=item.onboarding_id for update;
  if op='document.attach' then
   path:=payload->>'path';
   if not coalesce(public.owns_employee(eid),false) or item.status not in ('PENDING','IN_PROGRESS') or split_part(path,'/',1)<>auth.uid()::text then raise insufficient_privilege; end if;
   insert into public.onboarding_documents(onboarding_id,item_id,file_path) values(item.onboarding_id,item.id,path);
  elsif op='item.complete' then
   if not ((item.owner_role='EMPLOYEE' and public.owns_employee(eid)) or (item.owner_role='MANAGER' and public.manages_employee(eid)) or (item.owner_role='HR' and public.is_hr())) then raise insufficient_privilege; end if;
   if item.status not in ('PENDING','IN_PROGRESS') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
   if item.requires_document and not exists(select 1 from public.onboarding_documents where item_id=item.id and status<>'REJECTED') then raise exception 'DOCUMENT_REQUIRED' using errcode='22023'; end if;
   update public.onboarding_items set status='SUBMITTED',completed_at=null,reviewed_by=null,reviewed_at=null where id=item.id;
  else
   if not public.is_hr() or (public.owns_employee(eid) and public.current_role()<>'SUPERUSER') then raise insufficient_privilege; end if;
   if item.status<>'SUBMITTED' or payload->>'status' not in ('COMPLETED','IN_PROGRESS') or length(trim(coalesce(payload->>'comments','')))=0 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
   update public.onboarding_items set status=payload->>'status',review_comments=payload->>'comments',reviewed_by=auth.uid(),reviewed_at=now(),completed_at=case when payload->>'status'='COMPLETED' then now() else null end where id=item.id;
  end if;
  update public.onboarding set status=case when not exists(select 1 from public.onboarding_items where onboarding_id=item.onboarding_id and status<>'COMPLETED') then 'COMPLETED' else 'IN_PROGRESS' end where id=item.onboarding_id;
  return jsonb_build_object('id',item.onboarding_id);
 end if;
 return public.onboarding_legacy_command(op,payload);
end $$;
revoke all on function public.onboarding_command(text,jsonb) from public,anon;
grant execute on function public.onboarding_command(text,jsonb) to authenticated;

-- El 100% declarado por el colaborador se entrega a revisión, sin aprobación automática.
create function public.guard_course_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='COMPLETED' and old.status<>'COMPLETED' then
  if new.reviewed_by is null then new.status:='SUBMITTED'; new.completed_at:=null;
  elsif old.status<>'SUBMITTED' or not coalesce(public.manages_employee(old.employee_id),false) or (public.owns_employee(old.employee_id) and public.current_role()<>'SUPERUSER') then raise insufficient_privilege; end if;
 end if;
 if old.status='COMPLETED' and new.progress is distinct from old.progress then raise insufficient_privilege; end if;
 return new;
end $$;
create trigger guard_course_review before update on public.course_assignments for each row execute function public.guard_course_review();

alter function public.command(text,jsonb) rename to workforce_legacy_command;
revoke all on function public.workforce_legacy_command(text,jsonb) from public,anon,authenticated;
create function public.command(op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; rid uuid; ca public.course_assignments; begin
 if public.current_role() is null then raise insufficient_privilege; end if;
 if op='file.attach' and payload->>'bucket'='onboarding-documents' then raise invalid_parameter_value; end if;
 if op='employee.enroll' then
  if not public.is_hr() then raise insufficient_privilege; end if;
  if not exists(select 1 from public.profiles where id=(payload->>'profile_id')::uuid and active and role in ('RH_ADMIN','JEFE','EMPLEADO')) then raise insufficient_privilege; end if;
  insert into public.employees(profile_id,position_id,manager_id) values((payload->>'profile_id')::uuid,(payload->>'position_id')::uuid,nullif(payload->>'manager_id','')::uuid) returning id into rid;
  return jsonb_build_object('id',rid);
 elsif op='employee.save' then
  if not public.is_hr() then raise insufficient_privilege; end if;
  update public.employees set position_id=(payload->>'position_id')::uuid,manager_id=nullif(payload->>'manager_id','')::uuid,status=payload->>'status' where id=(payload->>'id')::uuid;
  return jsonb_build_object('id',payload->>'id');
 elsif op='onboarding.complete' then
  return public.onboarding_command('item.complete',payload);
 elsif op='course.review' then
  select * into ca from public.course_assignments where id=(payload->>'id')::uuid for update;
  if not found or not coalesce(public.manages_employee(ca.employee_id),false) or (public.owns_employee(ca.employee_id) and public.current_role()<>'SUPERUSER') then raise insufficient_privilege; end if;
  if ca.status<>'SUBMITTED' or payload->>'status' not in ('COMPLETED','IN_PROGRESS') or length(trim(coalesce(payload->>'comments','')))=0 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  update public.course_assignments set status=payload->>'status',progress=case when payload->>'status'='COMPLETED' then 100 else 75 end,completed_at=case when payload->>'status'='COMPLETED' then now() else null end,reviewed_by=auth.uid(),reviewed_at=now(),review_comments=payload->>'comments' where id=ca.id;
  return jsonb_build_object('id',ca.id);
 elsif op='course.progress' then
  select * into ca from public.course_assignments where id=(payload->>'id')::uuid for update;
  if ca.status in ('SUBMITTED','COMPLETED') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  update public.course_assignments set reviewed_by=null,reviewed_at=null where id=ca.id and public.owns_employee(ca.employee_id);
 end if;
 result:=public.workforce_legacy_command(op,payload);
 if op='course.save' then
  if nullif(payload->>'position_id','') is not null and nullif(payload->>'department_id','') is not null and not exists(select 1 from public.positions where id=(payload->>'position_id')::uuid and department_id=(payload->>'department_id')::uuid) then raise invalid_parameter_value; end if;
  update public.courses set department_id=nullif(payload->>'department_id','')::uuid,position_id=nullif(payload->>'position_id','')::uuid where id=(result->>'id')::uuid;
 end if;
 return result;
end $$;
revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;

-- La inducción automática respeta el área/puesto de cada plantilla.
do $patch$ declare definition text; begin
 select pg_get_functiondef('public.workforce_legacy_command(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'from public.courses where required','from public.courses where required and (position_id is null or position_id=v.position_id) and (department_id is null or department_id=(select department_id from public.positions where id=v.position_id))');
 execute definition;
end $patch$;

-- Solo publica totales; comentarios y promedios quedan bloqueados hasta cierre y cinco respuestas.
create function public.climate_results(sid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.climate_surveys; total int; invited int; result jsonb; begin
 select * into s from public.climate_surveys where id=sid;
 if not found or not coalesce(public.manages_climate(sid),false) then raise insufficient_privilege; end if;
 select count(*) into total from public.climate_answers where survey_id=sid;
 select count(*) into invited from public.climate_assignments where survey_id=sid;
 result:=jsonb_build_object('status',s.status,'title',s.title,'questions',s.questions,'summary',s.summary,'responses',total,'invited',invited,'comments','[]'::jsonb,'averages','[]'::jsonb);
 if s.status='CLOSED' and total>=5 then
  result:=result || (public.climate_aggregate(sid,auth.uid()) - 'summary' - 'title' - 'questions');
 end if;
 return result;
end $$;
revoke all on function public.climate_results(uuid) from public,anon;
grant execute on function public.climate_results(uuid) to authenticated;

-- Buzón separado de la encuesta. Recibo y comentario se guardan sin relación identificable.
create table public.climate_feedback (id uuid primary key default gen_random_uuid(),survey_id uuid not null references public.climate_surveys,comment text not null check(length(trim(comment)) between 3 and 3000));
create table public.climate_feedback_receipts (survey_id uuid not null references public.climate_surveys,employee_id uuid not null references public.employees,primary key(survey_id,employee_id));
alter table public.climate_feedback enable row level security;
alter table public.climate_feedback_receipts enable row level security;
grant all on public.climate_feedback,public.climate_feedback_receipts to service_role;
create function public.climate_comment(sid uuid,message text) returns void language plpgsql security definer set search_path='' as $$
declare eid uuid; s public.climate_surveys; begin
 select * into s from public.climate_surveys where id=sid for update;
 select id into eid from public.employees where profile_id=auth.uid() and status='ACTIVE';
 if public.current_role() is null or s.status is distinct from 'OPEN' or eid is null or not exists(select 1 from public.climate_assignments where survey_id=sid and employee_id=eid) then raise insufficient_privilege; end if;
 insert into public.climate_feedback_receipts values(sid,eid);
 insert into public.climate_feedback(survey_id,comment) values(sid,message);
end $$;
revoke all on function public.climate_comment(uuid,text) from public,anon;
grant execute on function public.climate_comment(uuid,text) to authenticated;
alter function public.climate_results(uuid) rename to climate_survey_results;
revoke all on function public.climate_survey_results(uuid) from authenticated;
create function public.climate_results(sid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; comments jsonb; begin
 result:=public.climate_survey_results(sid);
 if exists(select 1 from public.climate_surveys where id=sid and status='CLOSED') and (select count(*) from public.climate_feedback where survey_id=sid)>=5 then
  select coalesce(jsonb_agg(comment),'[]') into comments from (select comment from public.climate_feedback where survey_id=sid order by id limit 200) f;
  result:=result || jsonb_build_object('feedback',comments);
 end if;
 return result;
end $$;
revoke all on function public.climate_results(uuid) from public,anon;
grant execute on function public.climate_results(uuid) to authenticated;
commit;
