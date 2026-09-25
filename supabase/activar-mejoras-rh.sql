-- Activación repetible. Ejecutar completo en SQL Editor del proyecto existente.
-- Requiere las migraciones iniciales del 14 y 15 de septiembre.
begin;

-- Detiene la actualización antes de cualquier cambio si falta la instalación base.
do $prerequisites$
begin
 if to_regclass('public.audit_logs') is null
    or to_regclass('public.profiles') is null
    or to_regclass('public.courses') is null
    or to_regprocedure('public.command(text,jsonb)') is null then
  raise exception 'BASE_RH_INCOMPLETA: verifica que este sea el proyecto Supabase configurado en .env.local. Este archivo solo actualiza una instalación existente. Si el proyecto está vacío, ejecuta primero supabase/instalar-proyecto.sql. Si ya contiene datos o tablas del sistema, no reinstales: revisa las migraciones base pendientes.';
 end if;
end $prerequisites$;
do $activation$
begin
 if to_regclass('public.orchestration_runs') is null then
 execute $migration$
-- Auditoría exclusiva de SUPERUSER. El servidor también restringe las rutas.
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select using (public.current_role()='SUPERUSER');

-- Catálogo formativo visible a cuentas internas activas; asignación y progreso conservan sus permisos.
create policy courses_catalog_read on public.courses for select using (public.current_role() in ('RH_ADMIN','JEFE','EMPLEADO'));

-- Metadatos útiles sin copiar CV, contraseñas ni contenidos de documentos al registro.
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; changed jsonb;
begin
 if TG_OP <> 'INSERT' then before_row=to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then after_row=to_jsonb(new); end if;
 select coalesce(jsonb_agg(k),'[]'::jsonb) into changed from jsonb_object_keys(coalesce(after_row,before_row)) k
 where (before_row->k) is distinct from (after_row->k);
 insert into public.audit_logs(user_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id),jsonb_build_object('changed_fields',changed,'previous_status',before_row->>'status','new_status',after_row->>'status','actor_role',public.current_role()));
 if TG_OP='DELETE' then return old; end if; return new;
end $$;

create table public.orchestration_runs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 area text not null check(area in ('overview','courses','tasks','performance','analytics')),
 status text not null default 'PENDING' check(status in ('PENDING','COMPLETED','FAILED')),
 result jsonb, model text, created_at timestamptz not null default now()
);
alter table public.orchestration_runs enable row level security;
grant select on public.orchestration_runs to authenticated;
grant all on public.orchestration_runs to service_role;
create policy orchestration_own on public.orchestration_runs for select using(user_id=auth.uid() and public.current_role() is not null);
create index on public.orchestration_runs(user_id,created_at desc);
create trigger audit after insert or update or delete on public.orchestration_runs for each row execute function public.audit_change();
create function public.begin_orchestration(section text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.app_role:=public.current_role(); rid uuid;
begin
 if uid is null or r is null then raise insufficient_privilege; end if;
 if section not in ('overview','courses','tasks','performance','analytics') then raise invalid_parameter_value; end if;
 if section<>'overview' and (r not in ('RH_ADMIN','JEFE','EMPLEADO') or (section='analytics' and r<>'RH_ADMIN')) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 if exists(select 1 from public.orchestration_runs where user_id=uid and status='PENDING' and created_at>now()-interval '2 minutes') then raise exception 'AI_IN_PROGRESS' using errcode='23505'; end if;
 if (select count(*) from public.orchestration_runs where user_id=uid and created_at>now()-interval '1 minute')>=3 then raise exception 'RATE_LIMIT' using errcode='P0001'; end if;
 insert into public.orchestration_runs(user_id,area) values(uid,section) returning id into rid;
 return rid;
end $$;
revoke all on function public.begin_orchestration(text) from public,anon;
grant execute on function public.begin_orchestration(text) to authenticated;

$migration$;
 end if;
 if to_regclass('public.climate_surveys') is null then
 execute $migration$
-- Jerarquía multinivel: todas las políticas que usan manages_employee heredan este alcance.

create or replace function public.manages_employee(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_hr() or (public.current_role()='JEFE' and exists(
 with recursive team(id) as (
 select e.id from public.employees e join public.employees m on m.id=e.manager_id where m.profile_id=auth.uid() and m.status='ACTIVE'
 union select e.id from public.employees e join team t on e.manager_id=t.id
 ) select 1 from team where id=eid));
$$;

create function public.validate_manager_tree() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(17092026);
 if new.manager_id is null then return new; end if;
 if not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=new.manager_id and e.status='ACTIVE' and p.active and p.role='JEFE') then raise exception 'INVALID_MANAGER' using errcode='22023'; end if;
 if new.manager_id=new.id or exists(
 with recursive ancestors(id,manager_id) as (
 select id,manager_id from public.employees where id=new.manager_id
 union select e.id,e.manager_id from public.employees e join ancestors a on e.id=a.manager_id
 ) select 1 from ancestors where id=new.id) then raise exception 'HIERARCHY_CYCLE' using errcode='22023'; end if;
 return new;
end $$;
create trigger validate_manager_tree before insert or update of manager_id on public.employees for each row execute function public.validate_manager_tree();
create function public.assign_team_manager(employee uuid,manager uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(17092026);
 if not coalesce(public.manages_employee(employee),false) then raise insufficient_privilege; end if;
 if not public.is_hr() and (public.owns_employee(employee) or manager is null or not(public.owns_employee(manager) or public.manages_employee(manager))) then raise insufficient_privilege; end if;
 update public.employees set manager_id=manager where id=employee;
 if not found then raise no_data_found; end if;
end $$;
revoke all on function public.validate_manager_tree(),public.assign_team_manager(uuid,uuid) from public,anon;
grant execute on function public.assign_team_manager(uuid,uuid) to authenticated;

-- Respuestas anónimas: no tienen empleado, perfil ni fecha individual. La participación
-- se registra por separado para impedir duplicados, sin vínculo con la respuesta.
create table public.climate_surveys(
 id uuid primary key default gen_random_uuid(),created_by uuid not null references public.profiles,
 title text not null check(length(title) between 1 and 160),description text not null default '' check(length(description)<=3000),
 questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 3 and 12),
 status text not null default 'DRAFT' check(status in ('DRAFT','OPEN','CLOSED')),
 summary jsonb, model text, created_at timestamptz not null default now()
);
create table public.climate_assignments(survey_id uuid references public.climate_surveys on delete cascade,employee_id uuid references public.employees,primary key(survey_id,employee_id));
create table public.climate_participation(survey_id uuid references public.climate_surveys on delete cascade,employee_id uuid references public.employees,primary key(survey_id,employee_id));
create table public.climate_answers(id uuid primary key default gen_random_uuid(),survey_id uuid not null references public.climate_surveys on delete cascade,ratings jsonb not null,comment text not null default '' check(length(comment)<=3000));
create index on public.climate_answers(survey_id);
alter table public.climate_surveys enable row level security;
alter table public.climate_assignments enable row level security;
alter table public.climate_participation enable row level security;
alter table public.climate_answers enable row level security;
revoke all on public.climate_surveys,public.climate_assignments,public.climate_participation,public.climate_answers from anon,authenticated;
grant select on public.climate_surveys,public.climate_assignments,public.climate_participation to authenticated;
grant all on public.climate_surveys,public.climate_assignments,public.climate_participation,public.climate_answers to service_role;
create function public.manages_climate(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_hr() or (public.current_role()='JEFE' and exists(select 1 from public.climate_surveys where id=sid and created_by=auth.uid()));
$$;
create policy climate_surveys_read on public.climate_surveys for select using(public.manages_climate(id) or (status<>'DRAFT' and exists(select 1 from public.climate_assignments a where a.survey_id=id and public.owns_employee(a.employee_id))));
create policy climate_assignment_read on public.climate_assignments for select using(public.manages_climate(survey_id) or public.owns_employee(employee_id));
-- Nadie puede consultar quién respondió salvo su propio recibo. No hay política para leer respuestas crudas.
create policy climate_participation_own on public.climate_participation for select using(public.owns_employee(employee_id));
revoke all on function public.manages_climate(uuid) from public,anon;
grant execute on function public.manages_climate(uuid) to authenticated;

create function public.climate_command(op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.app_role:=public.current_role(); sid uuid:=nullif(payload->>'id','')::uuid; s public.climate_surveys; eid uuid; q jsonb; recipient uuid; recipients uuid[]; vals jsonb;
begin
 if uid is null or r is null then raise insufficient_privilege; end if;
 if op='save' then
  if r not in ('RH_ADMIN','JEFE') then raise insufficient_privilege; end if;
  if sid is not null then
   select * into s from public.climate_surveys where id=sid for update;
   if not found or not public.manages_climate(sid) then raise insufficient_privilege; end if;
   if s.status<>'DRAFT' then raise exception 'CLIMATE_FROZEN' using errcode='22023'; end if;
  end if;
  if jsonb_typeof(payload->'questions') is distinct from 'array' then raise invalid_parameter_value; end if;
  if jsonb_array_length(payload->'questions') not between 3 and 12 then raise invalid_parameter_value; end if;
  for q in select value from jsonb_array_elements(payload->'questions') loop
   if jsonb_typeof(q)<>'string' or length(q#>>'{}') not between 3 and 400 then raise invalid_parameter_value; end if;
  end loop;
  if sid is null then insert into public.climate_surveys(created_by,title,description,questions) values(uid,payload->>'title',coalesce(payload->>'description',''),payload->'questions') returning id into sid;
  else update public.climate_surveys set title=payload->>'title',description=coalesce(payload->>'description',''),questions=payload->'questions' where id=sid; end if;
 elsif op='publish' then
  select * into s from public.climate_surveys where id=sid for update;
  if not found or not public.manages_climate(sid) then raise insufficient_privilege; end if;
  if s.status<>'DRAFT' then raise exception 'CLIMATE_FROZEN' using errcode='22023'; end if;
  select array_agg(distinct value::uuid) into recipients from jsonb_array_elements_text(payload->'employees');
  if coalesce(array_length(recipients,1),0)<5 then raise exception 'CLIMATE_MINIMUM' using errcode='22023'; end if;
  foreach recipient in array recipients loop
   if not public.manages_employee(recipient) or not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=recipient and e.status='ACTIVE' and p.active and p.role in ('JEFE','EMPLEADO')) then raise insufficient_privilege; end if;
   insert into public.climate_assignments values(sid,recipient);
  end loop;
  update public.climate_surveys set status='OPEN' where id=sid;
 elsif op='respond' then
  select * into s from public.climate_surveys where id=sid for update;
  select id into eid from public.employees where profile_id=uid and status='ACTIVE';
  if not found or r not in ('JEFE','EMPLEADO') or s.status is distinct from 'OPEN' or not exists(select 1 from public.climate_assignments where survey_id=sid and employee_id=eid) then raise insufficient_privilege; end if;
  vals=payload->'ratings';
  if jsonb_typeof(vals) is distinct from 'array' then raise invalid_parameter_value; end if;
  if jsonb_array_length(vals)<>jsonb_array_length(s.questions) then raise invalid_parameter_value; end if;
  for q in select value from jsonb_array_elements(vals) loop
   if jsonb_typeof(q)<>'number' or (q#>>'{}')::numeric not in (1,2,3,4,5) then raise invalid_parameter_value; end if;
  end loop;
  insert into public.climate_participation values(sid,eid);
  insert into public.climate_answers(survey_id,ratings,comment) values(sid,vals,coalesce(payload->>'comment',''));
  -- Sin auditoría del envío individual: no registrar autor, comentario ni marca temporal.
  return jsonb_build_object('id',sid);
 elsif op='close' then
  select * into s from public.climate_surveys where id=sid for update;
  if not found or not public.manages_climate(sid) then raise insufficient_privilege; end if;
  if s.status<>'OPEN' then raise exception 'CLIMATE_FROZEN' using errcode='22023'; end if;
  update public.climate_surveys set status='CLOSED' where id=sid;
 else raise invalid_parameter_value;
 end if;
 insert into public.audit_logs(user_id,action,resource_type,resource_id) values(uid,'climate.'||op,'climate_surveys',sid);
 return jsonb_build_object('id',sid);
end $$;
revoke all on function public.climate_command(text,jsonb) from public,anon;
grant execute on function public.climate_command(text,jsonb) to authenticated;

-- Solo el backend puede solicitar agregados. La identidad del actor se verifica de nuevo.
create function public.climate_aggregate(sid uuid,actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.climate_surveys; total int; averages jsonb; comments jsonb;
begin
 select * into s from public.climate_surveys where id=sid;
 if not found or not exists(select 1 from public.profiles where id=actor and active and (role='RH_ADMIN' or (role='JEFE' and s.created_by=actor))) then raise insufficient_privilege; end if;
 if s.status<>'CLOSED' then raise exception 'CLIMATE_CLOSE_FIRST' using errcode='22023'; end if;
 select count(*) into total from public.climate_answers where survey_id=sid;
 if total<5 then raise exception 'CLIMATE_MINIMUM' using errcode='22023'; end if;
 select jsonb_agg(jsonb_build_object('question_index',idx,'average',avg_rating) order by idx) into averages from
 (select item.ordinality as idx,round(avg((item.value#>>'{}')::numeric),2) avg_rating from public.climate_answers a cross join lateral jsonb_array_elements(a.ratings) with ordinality item where a.survey_id=sid group by item.ordinality) grouped;
 select coalesce(jsonb_agg(comment),'[]') into comments from (select comment from public.climate_answers where survey_id=sid and comment<>'' order by id limit 200) c;
 return jsonb_build_object('title',s.title,'questions',s.questions,'response_count',total,'averages',averages,'comments',comments,'summary',s.summary);
end $$;
revoke all on function public.climate_aggregate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.climate_aggregate(uuid,uuid) to service_role;

$migration$;
 end if;
 if to_regclass('public.vacancy_documents') is null then
 execute $migration$
-- Amplía RH al superadministrador sin cambiar su rol ni su identidad de auditoría.

create or replace function public.is_hr() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.current_role() in ('RH_ADMIN','SUPERUSER'),false)
$$;

-- Conserva las correcciones de las migraciones anteriores de command.
do $$ declare definition text;
begin
 select pg_get_functiondef('public.command(text,jsonb)'::regprocedure) into definition;
 definition := replace(definition, 'r<>''RH_ADMIN''', 'r not in (''RH_ADMIN'',''SUPERUSER'')');
 definition := replace(definition, 'role=''RH_ADMIN'' and active', 'role in (''RH_ADMIN'',''SUPERUSER'') and active');
 execute definition;
 select pg_get_functiondef('public.begin_orchestration(text)'::regprocedure) into definition;
 definition := replace(definition, '(''RH_ADMIN'',''JEFE'',''EMPLEADO'')', '(''SUPERUSER'',''RH_ADMIN'',''JEFE'',''EMPLEADO'')');
 definition := replace(definition, 'r<>''RH_ADMIN''', 'r not in (''RH_ADMIN'',''SUPERUSER'')');
 execute definition;
 select pg_get_functiondef('public.climate_command(text,jsonb)'::regprocedure) into definition;
 definition := replace(definition, '(''RH_ADMIN'',''JEFE'')', '(''SUPERUSER'',''RH_ADMIN'',''JEFE'')');
 execute definition;
 select pg_get_functiondef('public.climate_aggregate(uuid,uuid)'::regprocedure) into definition;
 definition := replace(definition, 'role=''RH_ADMIN''', 'role in (''RH_ADMIN'',''SUPERUSER'')');
 execute definition;
end $$;

-- Una sola entrevista pendiente por persona, incluso en diferentes vacantes.
-- Se conservan las citas históricas; los duplicados previos deben cancelarse desde la agenda.
create function public.guard_candidate_interview() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if new.status <> 'SCHEDULED' then return new; end if;
 select candidate_id into cid from public.applications where id=new.application_id;
 perform pg_advisory_xact_lock(hashtext('candidate-interview:'||cid::text));
 if exists(select 1 from public.interviews i join public.applications a on a.id=i.application_id
   where a.candidate_id=cid and i.status='SCHEDULED' and i.id is distinct from new.id)
 then raise exception 'CANDIDATE_SCHEDULED' using errcode='23505'; end if;
 return new;
end $$;
create trigger candidate_interview before insert or update on public.interviews
 for each row execute function public.guard_candidate_interview();

-- Referencias de vacante privadas: nunca se incluyen en el portal público de candidatos.
create table public.vacancy_documents (
 id uuid primary key default gen_random_uuid(), vacancy_id uuid not null references public.vacancies on delete cascade,
 file_path text unique not null, filename text not null check(length(filename) between 1 and 200),
 created_by uuid not null references public.profiles, created_at timestamptz not null default now()
);
alter table public.vacancy_documents enable row level security;
grant select on public.vacancy_documents to authenticated;
grant all on public.vacancy_documents to service_role;
create policy vacancy_documents_read on public.vacancy_documents for select using(public.is_hr());
create trigger audit after insert or update or delete on public.vacancy_documents for each row execute function public.audit_change();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vacancy-documents','vacancy-documents',false,5242880,array['application/pdf','text/plain']);
create policy vacancy_files_insert on storage.objects for insert to authenticated with check(
 bucket_id='vacancy-documents' and public.is_hr() and (storage.foldername(name))[1]=auth.uid()::text);
create policy vacancy_files_read on storage.objects for select to authenticated using(
 bucket_id='vacancy-documents' and public.is_hr() and exists(select 1 from public.vacancy_documents where file_path=name));
create policy vacancy_files_cleanup on storage.objects for delete to authenticated using(
 bucket_id='vacancy-documents' and public.is_hr() and (storage.foldername(name))[1]=auth.uid()::text
 and not exists(select 1 from public.vacancy_documents where file_path=name));
create function public.attach_vacancy_document(vacancy uuid, path text, filename text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not public.is_hr() then raise insufficient_privilege; end if;
 if split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='vacancy-documents' and name=path) then raise insufficient_privilege; end if;
 insert into public.vacancy_documents(vacancy_id,file_path,filename,created_by) values(vacancy,path,filename,auth.uid()) returning id into rid;
 return rid;
end $$;
revoke all on function public.attach_vacancy_document(uuid,text,text) from public,anon;
grant execute on function public.attach_vacancy_document(uuid,text,text) to authenticated;

$migration$;
 end if;
 if to_regprocedure('public.assign_many(text,uuid[],jsonb)') is null then
 execute $migration$
-- Asignaciones masivas atómicas: una persona fuera del alcance invalida el lote completo.

create function public.assign_many(kind text,people uuid[],payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare eid uuid; created_count int:=0; skipped_count int:=0; changed int; r public.app_role:=public.current_role();
begin
 if r is null or r not in ('SUPERUSER','RH_ADMIN','JEFE') then raise insufficient_privilege; end if;
 if kind not in ('course','task') or kind is null or people is null or cardinality(people) not between 1 and 100 then raise invalid_parameter_value; end if;
 if (select count(distinct id) from unnest(people) id)<>cardinality(people) then raise invalid_parameter_value; end if;
 if payload->>'due_date' is null then raise invalid_parameter_value; end if;
 perform (payload->>'due_date')::date;
 -- La interfaz no concede permisos; se valida de nuevo cada persona y su cuenta activa.
 foreach eid in array people loop
  if not coalesce(public.manages_employee(eid),false) or not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=eid and e.status='ACTIVE' and p.active and p.role in ('EMPLEADO','JEFE')) then raise insufficient_privilege; end if;
 end loop;
 if kind='course' and not exists(select 1 from public.courses where id=(payload->>'id')::uuid) then raise no_data_found; end if;
 foreach eid in array people loop
  if kind='course' then
   insert into public.course_assignments(course_id,employee_id,due_date) values((payload->>'id')::uuid,eid,(payload->>'due_date')::date) on conflict(course_id,employee_id) do nothing;
   get diagnostics changed=row_count;
   created_count:=created_count+changed; skipped_count:=skipped_count+1-changed;
  else
   -- No acepta id ni employee_id del payload: cada registro nuevo tiene destinatario validado.
   perform public.command('task.save',(payload-'id'-'employee_id')||jsonb_build_object('employee_id',eid));
   created_count:=created_count+1;
  end if;
 end loop;
 return jsonb_build_object('created',created_count,'skipped',skipped_count);
end $$;
revoke all on function public.assign_many(text,uuid[],jsonb) from public,anon;
grant execute on function public.assign_many(text,uuid[],jsonb) to authenticated;

$migration$;
 end if;
 if to_regclass('public.onboarding_templates') is null then
 execute $migration$
-- Planes de incorporación, responsables y revisión documental con permisos en PostgreSQL.

create table public.onboarding_templates (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 160),
 position_id uuid references public.positions, department_id uuid references public.departments,
 steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 30),
 active boolean not null default true, created_at timestamptz not null default now()
);
create unique index onboarding_template_scope on public.onboarding_templates(coalesce(position_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(department_id,'00000000-0000-0000-0000-000000000000'::uuid)) where active;
alter table public.onboarding_templates enable row level security;
create policy templates_read on public.onboarding_templates for select using(public.is_hr() or public.current_role()='JEFE');
grant select on public.onboarding_templates to authenticated;
alter table public.onboarding add column template_id uuid references public.onboarding_templates;
alter table public.onboarding_items add column description text not null default '', add column owner_role text not null default 'EMPLOYEE' check(owner_role in ('EMPLOYEE','MANAGER','HR')), add column requires_document boolean not null default false;
alter table public.onboarding_documents add column status text not null default 'SUBMITTED' check(status in ('SUBMITTED','APPROVED','REJECTED')), add column comments text not null default '', add column reviewed_by uuid references public.profiles, add column reviewed_at timestamptz;

create function public.onboarding_steps_valid(steps jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 30 and not exists(
 select 1 from jsonb_array_elements(steps) s where coalesce(length(trim(s->>'title')),0) not between 1 and 160 or coalesce(s->>'owner_role','') not in ('EMPLOYEE','MANAGER','HR') or coalesce((s->>'days')::int,-1) not between 0 and 365 or coalesce(length(s->>'description'),0)>2000 or jsonb_typeof(s->'requires_document') is distinct from 'boolean');
$$;
alter table public.onboarding_templates add constraint valid_steps check(public.onboarding_steps_valid(steps));

-- Bloquea la vía antigua de completar pasos cuando falta documentación o responsabilidad.
create function public.guard_onboarding_step() returns trigger language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 select employee_id into eid from public.onboarding where id=new.onboarding_id for update;
 if new.status='COMPLETED' and old.status<>'COMPLETED' then
  if not (public.is_hr() or (new.owner_role='EMPLOYEE' and public.owns_employee(eid)) or (new.owner_role='MANAGER' and public.manages_employee(eid))) then raise insufficient_privilege; end if;
  if new.requires_document and not exists(select 1 from public.onboarding_documents where onboarding_id=new.onboarding_id and status='APPROVED') then raise exception 'DOCUMENT_REQUIRED' using errcode='22023'; end if;
 end if;
 return new;
end $$;
create trigger onboarding_step_guard before update on public.onboarding_items for each row execute function public.guard_onboarding_step();

create function public.onboarding_command(op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid; eid uuid; tid uuid; s jsonb; steps jsonb; base date; item public.onboarding_items; d public.onboarding_documents;
begin
 if public.current_role() is null then raise insufficient_privilege; end if;
 if op='template.save' then
  if not public.is_hr() then raise insufficient_privilege; end if;
  if not public.onboarding_steps_valid(payload->'steps') then raise invalid_parameter_value; end if;
  if nullif(payload->>'position_id','') is not null and nullif(payload->>'department_id','') is not null and not exists(select 1 from public.positions where id=(payload->>'position_id')::uuid and department_id=(payload->>'department_id')::uuid) then raise invalid_parameter_value; end if;
  insert into public.onboarding_templates(title,position_id,department_id,steps) values(payload->>'title',nullif(payload->>'position_id','')::uuid,nullif(payload->>'department_id','')::uuid,payload->'steps') returning id into tid;
  return jsonb_build_object('id',tid);
 elsif op='template.disable' then
  if not public.is_hr() then raise insufficient_privilege; end if;
  update public.onboarding_templates set active=false where id=(payload->>'id')::uuid;
  return '{}';
 end if;
 if op='document.review' then
  if not public.is_hr() then raise insufficient_privilege; end if;
  select * into d from public.onboarding_documents where id=(payload->>'id')::uuid for update;
  if not found then raise no_data_found; end if;
  if payload->>'status' not in ('APPROVED','REJECTED') or length(trim(coalesce(payload->>'comments','')))=0 then raise invalid_parameter_value; end if;
  if d.status<>'SUBMITTED' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  update public.onboarding_documents set status=payload->>'status',comments=payload->>'comments',reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
  return '{}';
 end if;
 if op in ('item.save','item.complete') then
  select * into item from public.onboarding_items where id=(payload->>'id')::uuid;
  oid:=item.onboarding_id;
 else oid:=(payload->>'id')::uuid; end if;
 select employee_id into eid from public.onboarding where id=oid for update;
 if eid is null then raise no_data_found; end if;
 if op='item.complete' then
  if not coalesce(public.read_employee(eid),false) then raise insufficient_privilege; end if;
  update public.onboarding_items set status='COMPLETED',completed_at=now() where id=item.id and status<>'COMPLETED';
 elsif op='item.save' then
  if not coalesce(public.manages_employee(eid),false) or item.status='COMPLETED' then raise insufficient_privilege; end if;
  if payload->>'due_date' is null then raise invalid_parameter_value; end if;
  update public.onboarding_items set due_date=(payload->>'due_date')::date,owner_role=payload->>'owner_role' where id=item.id;
 elsif op='plan.apply' then
  if not coalesce(public.manages_employee(eid),false) then raise insufficient_privilege; end if;
  -- No reemplaza un plan que ya recibió entregas o tiene progreso.
  if exists(select 1 from public.onboarding_items where onboarding_id=oid and status<>'PENDING') or exists(select 1 from public.onboarding_documents where onboarding_id=oid) then raise exception 'PLAN_STARTED' using errcode='22023'; end if;
  tid:=nullif(payload->>'template_id','')::uuid;
  if tid is not null then select t.steps into steps from public.onboarding_templates t where t.id=tid and active; else steps:=payload->'steps'; end if;
  if steps is null or not public.onboarding_steps_valid(steps) then raise invalid_parameter_value; end if;
  base:=(payload->>'start_date')::date;
  if base is null then raise invalid_parameter_value; end if;
  delete from public.onboarding_items where onboarding_id=oid;
  for s in select * from jsonb_array_elements(steps) loop
   insert into public.onboarding_items(onboarding_id,title,description,owner_role,requires_document,due_date) values(oid,s->>'title',coalesce(s->>'description',''),s->>'owner_role',(s->>'requires_document')::boolean,base+(s->>'days')::int);
  end loop;
  update public.onboarding set template_id=tid where id=oid;
 else raise invalid_parameter_value; end if;
 update public.onboarding set status=case when not exists(select 1 from public.onboarding_items where onboarding_id=oid and status<>'COMPLETED') then 'COMPLETED' when exists(select 1 from public.onboarding_items where onboarding_id=oid and status='COMPLETED') then 'IN_PROGRESS' else 'PENDING' end where id=oid;
 return jsonb_build_object('id',oid);
end $$;
revoke all on function public.onboarding_command(text,jsonb) from public,anon;
grant execute on function public.onboarding_command(text,jsonb) to authenticated;

-- La contratación elige primero el puesto y después el área; si no hay plantilla conserva el plan básico.
create function public.initialize_onboarding(oid uuid) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid; eid uuid;
begin
 select employee_id into eid from public.onboarding where id=oid;
 select t.id into tid from public.onboarding_templates t join public.employees e on e.id=eid join public.positions p on p.id=e.position_id where t.active and (t.position_id=e.position_id or (t.position_id is null and (t.department_id=p.department_id or t.department_id is null))) order by (t.position_id is not null) desc,(t.department_id is not null) desc,t.created_at desc limit 1;
 if tid is not null then perform public.onboarding_command('plan.apply',jsonb_build_object('id',oid,'template_id',tid,'start_date',current_date));
 else insert into public.onboarding_items(onboarding_id,title,due_date) select oid,title,current_date+7 from unnest(array['Entregar documentación','Conocer al equipo','Leer reglamento','Configurar herramientas']) title; end if;
end $$;
revoke all on function public.initialize_onboarding(uuid) from public,anon,authenticated;
do $patch$ declare definition text; old_fragment text := 'insert into public.onboarding_items(onboarding_id,title,due_date) select oid,title,current_date+7 from unnest(array[''Entregar documentación'',''Conocer al equipo'',''Leer reglamento'',''Configurar herramientas'']) title;';
begin
 select pg_get_functiondef('public.command(text,jsonb)'::regprocedure) into definition;
 if position(old_fragment in definition)=0 then raise exception 'No se encontró el bloque de contratación'; end if;
 definition:=replace(definition,old_fragment,'perform public.initialize_onboarding(oid);');
 execute definition;
end $patch$;
create trigger audit after insert or update or delete on public.onboarding_templates for each row execute function public.audit_change();

$migration$;
 end if;
 if to_regprocedure('public.workforce_legacy_command(text,jsonb)') is null then
 execute $migration$
-- Jerarquía de RH, entregas revisables e historiales. Todas las escrituras conservan permisos SQL.

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


$migration$;
 end if;
end $activation$;
commit;
select to_regclass('public.orchestration_runs') is not null as orquestacion,
 to_regclass('public.climate_surveys') is not null as ambiente_laboral,
 to_regclass('public.vacancy_documents') is not null as operaciones_rh,
 to_regprocedure('public.assign_many(text,uuid[],jsonb)') is not null as asignaciones_multiples,
 to_regclass('public.onboarding_templates') is not null as planes_onboarding,
 to_regprocedure('public.workforce_legacy_command(text,jsonb)') is not null as revisiones_historiales;
-- Permite publicar encuestas desde una persona sin alterar la jerarquía ni el anonimato.
begin;
do $$ declare definition text;
begin
 select pg_get_functiondef('public.climate_command(text,jsonb)'::regprocedure) into definition;
 definition := replace(definition,
  'coalesce(array_length(recipients,1),0)<5',
  'coalesce(array_length(recipients,1),0)<1');
 definition := replace(definition, 'CLIMATE_MINIMUM', 'CLIMATE_RECIPIENT_REQUIRED');
 execute definition;
end $$;
commit;


begin;
do $activation$ begin
 if to_regclass('public.course_evidence') is null then
 execute $migration$
-- Evidencias privadas de capacitación y validación humana obligatoria.
alter table public.course_assignments add column evidence_required_after timestamptz;
create table public.course_evidence (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.course_assignments on delete cascade,
 file_path text not null unique,
 evidence_text text not null default '',
 progress integer not null check(progress between 1 and 100),
 created_at timestamptz not null default now()
);
alter table public.course_evidence enable row level security;
grant select on public.course_evidence to authenticated;
grant all on public.course_evidence to service_role;
create policy course_evidence_read on public.course_evidence for select using(exists(select 1 from public.course_assignments a where a.id=assignment_id and (public.owns_employee(a.employee_id) or public.manages_employee(a.employee_id))));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('course-evidence','course-evidence',false,5242880,array['application/pdf','text/plain','image/png','image/jpeg']);
create policy course_evidence_upload on storage.objects for insert to authenticated with check(bucket_id='course-evidence' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.course_assignments a where public.owns_employee(a.employee_id) and a.status in ('ASSIGNED','IN_PROGRESS')));
create policy course_evidence_download on storage.objects for select to authenticated using(bucket_id='course-evidence' and exists(select 1 from public.course_evidence e join public.course_assignments a on a.id=e.assignment_id where e.file_path=name and (public.owns_employee(a.employee_id) or public.manages_employee(a.employee_id))));
create policy course_evidence_cleanup on storage.objects for delete to authenticated using(bucket_id='course-evidence' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.course_evidence e where e.file_path=name));
create function public.attach_course_evidence(aid uuid,path text,body text,reported_progress integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.course_assignments; rid uuid;
begin
 select * into a from public.course_assignments where id=aid for update;
 if not found or not coalesce(public.owns_employee(a.employee_id),false) then raise insufficient_privilege; end if;
 if a.status not in ('ASSIGNED','IN_PROGRESS') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
 if reported_progress not between 1 and 100 or reported_progress<a.progress or length(body)>14000 then raise invalid_parameter_value; end if;
 if split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='course-evidence' and name=path) then raise insufficient_privilege; end if;
 insert into public.course_evidence(assignment_id,file_path,evidence_text,progress) values(aid,path,body,reported_progress) returning id into rid;
 insert into public.audit_logs(user_id,action,resource_type,resource_id) values(auth.uid(),'course.evidence','course_assignments',aid);
 return jsonb_build_object('id',rid);
end $$;
revoke all on function public.attach_course_evidence(uuid,text,text,integer) from public,anon;
grant execute on function public.attach_course_evidence(uuid,text,text,integer) to authenticated;
-- Se valida en SQL también al usar las rutas REST antiguas.
alter function public.command(text,jsonb) rename to course_evidence_legacy_command;
revoke all on function public.course_evidence_legacy_command(text,jsonb) from public,anon,authenticated;
create function public.command(op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.course_assignments; required_progress integer; result jsonb;
begin
 if op in ('course.progress','course.review') then
  select * into a from public.course_assignments where id=(payload->>'id')::uuid for update;
  if not found then raise no_data_found; end if;
  if op='course.progress' then
   if not coalesce(public.owns_employee(a.employee_id),false) then raise insufficient_privilege; end if;
   required_progress:=(payload->>'progress')::integer;
  else
   if not coalesce(public.manages_employee(a.employee_id),false) or public.current_role() not in ('RH_ADMIN','JEFE','SUPERUSER') or public.owns_employee(a.employee_id) then raise insufficient_privilege; end if;
   required_progress:=case when payload->>'status'='COMPLETED' then 100 else 0 end;
  end if;
  if required_progress>0 and not exists(select 1 from public.course_evidence e where e.assignment_id=a.id and e.progress>=required_progress and (a.evidence_required_after is null or e.created_at>a.evidence_required_after)) then raise exception 'COURSE_EVIDENCE_REQUIRED' using errcode='22023'; end if;
 end if;
 result:=public.course_evidence_legacy_command(op,payload);
 if op='course.review' and payload->>'status'='IN_PROGRESS' then update public.course_assignments set evidence_required_after=now() where id=a.id; end if;
 return result;
end $$;
revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;


$migration$;
 end if;
end $activation$;
commit;


begin;
do $activation$ begin
 if to_regprocedure('public.hiring_options_ready()') is null then
 execute $migration$
-- Protege también las escrituras desde RPC y las rutas REST.
create function public.guard_interview_future() returns trigger language plpgsql set search_path='' as $$
begin
 if new.scheduled_at < now() and (tg_op='INSERT' or new.scheduled_at is distinct from old.scheduled_at or (new.status='SCHEDULED' and old.status<>'SCHEDULED')) then
  raise exception 'INTERVIEW_IN_PAST' using errcode='22023';
 end if;
 return new;
end $$;
create trigger interview_future before insert or update on public.interviews for each row execute function public.guard_interview_future();
alter function public.command(text,jsonb) rename to hiring_legacy_command;
revoke all on function public.hiring_legacy_command(text,jsonb) from public,anon,authenticated;
create function public.command(op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; pid uuid; did uuid; mid uuid; oid uuid;
begin
 if op='application.hire' and (payload ? 'position_id' or payload ? 'department_id' or payload ? 'manager_id') then
  if not public.is_hr() then raise insufficient_privilege; end if;
  pid:=(payload->>'position_id')::uuid; did:=(payload->>'department_id')::uuid; mid:=nullif(payload->>'manager_id','')::uuid;
  if pid is null or did is null or not exists(select 1 from public.positions where id=pid and department_id=did) then raise exception 'INVALID_HIRING_AREA' using errcode='22023'; end if;
  if mid is not null and not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=mid and e.status='ACTIVE' and p.active and p.role in ('JEFE','RH_ADMIN')) then raise exception 'INVALID_MANAGER' using errcode='22023'; end if;
 end if;
 result:=public.hiring_legacy_command(op,payload);
 if op='application.hire' and pid is not null then
  perform public.hiring_legacy_command('employee.save',jsonb_build_object('id',result->>'id','position_id',pid,'manager_id',coalesce(mid::text,''),'status','ACTIVE'));
  select id into oid from public.onboarding where employee_id=(result->>'id')::uuid;
  delete from public.onboarding_items where onboarding_id=oid;
  perform public.initialize_onboarding(oid);
 end if;
 return result;
end $$;
revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;
create function public.hiring_options_ready() returns boolean language sql stable as $$ select true $$;
revoke all on function public.hiring_options_ready() from public,anon;
grant execute on function public.hiring_options_ready() to authenticated;



$migration$;
 end if;
end $activation$;
commit;


begin;
do $activation$ begin
 if to_regprocedure('public.hr_hierarchy_ready()') is null then
 execute $migration$
-- El superior de RH más alto de la cadena autoriza cambios; el superusuario siempre puede.
create function public.can_modify_hr_employee(eid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.current_role()='SUPERUSER' or (
  public.current_role()='RH_ADMIN' and exists (
   with recursive ancestors(id,profile_id,manager_id,status,depth,path) as (
    select m.id,m.profile_id,m.manager_id,m.status,1,array[e.id,m.id]
    from public.employees e join public.employees m on m.id=e.manager_id where e.id=eid and e.profile_id<>auth.uid()
    union all
    select m.id,m.profile_id,m.manager_id,m.status,a.depth+1,a.path||m.id
    from ancestors a join public.employees m on m.id=a.manager_id where not m.id=any(a.path)
   ) select 1 from (
    select a.profile_id,a.status,p.active from ancestors a join public.profiles p on p.id=a.profile_id
    where p.role='RH_ADMIN' order by a.depth desc limit 1
   ) highest where highest.profile_id=auth.uid() and highest.status='ACTIVE' and highest.active
  )
 );
$$;
revoke all on function public.can_modify_hr_employee(uuid) from public,anon;
grant execute on function public.can_modify_hr_employee(uuid) to authenticated;
create function public.guard_hr_hierarchy() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if tg_op='INSERT' then
  -- Sin jerarquía previa, el alta inicial de RH corresponde al superusuario.
  if exists(select 1 from public.profiles where id=new.profile_id and role='RH_ADMIN')
   and public.current_role() is distinct from 'SUPERUSER' then
   raise exception 'HR_HIERARCHY_FORBIDDEN' using errcode='42501';
  end if;
  return new;
 end if;
 if new.position_id is not distinct from old.position_id and new.manager_id is not distinct from old.manager_id
  and new.status is not distinct from old.status and new.profile_id is not distinct from old.profile_id then return new; end if;
 perform pg_advisory_xact_lock(17092026);
 -- Mover un antecesor tampoco permite apropiarse de una rama de RH.
 for target in
  with recursive branch(id,profile_id) as (
   select old.id,old.profile_id
   union select e.id,e.profile_id from public.employees e join branch b on e.manager_id=b.id
    where new.manager_id is distinct from old.manager_id
  ) select b.id from branch b join public.profiles p on p.id=b.profile_id where p.role='RH_ADMIN'
 loop
  if not coalesce(public.can_modify_hr_employee(target),false) then
   raise exception 'HR_HIERARCHY_FORBIDDEN' using errcode='42501';
  end if;
 end loop;
 return new;
end $$;
create trigger guard_hr_hierarchy before insert or update on public.employees for each row execute function public.guard_hr_hierarchy();
create function public.hr_hierarchy_ready() returns boolean language sql stable as $$ select true $$;
revoke all on function public.hr_hierarchy_ready() from public,anon;
grant execute on function public.hr_hierarchy_ready() to authenticated;

$migration$;
 end if;
end $activation$;
commit;

begin;
do $activation$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.course_evidence'::regclass and tgname='audit') then
 execute $migration$
-- Solo se conservan valores operativos permitidos. Documentos, prompts y comentarios quedan fuera.
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb; changed jsonb; changes jsonb; actor text;
begin
 if TG_OP <> 'INSERT' then b:=to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then a:=to_jsonb(new); end if;
 if TG_OP='UPDATE' and a=b then return new; end if;
 select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into changed
 from jsonb_object_keys(coalesce(a,b)) k where (b->k) is distinct from (a->k);
 select coalesce(jsonb_object_agg(k,jsonb_build_object('before',b->k,'after',a->k)),'{}'::jsonb) into changes
 from jsonb_object_keys(coalesce(a,b)) k where (b->k) is distinct from (a->k)
 and k=any(array['name','full_name','title','status','role','active','priority','due_date','scheduled_at','progress','position_id','department_id','manager_id','employee_id','course_id','owner_role','requires_document','required','hire_date']);
 select full_name into actor from public.profiles where id=auth.uid();
 insert into public.audit_logs(user_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id),jsonb_build_object(
 'changed_fields',changed,'changes',changes,'actor_name',actor,'actor_role',public.current_role(),
 'resource_name',coalesce(a->>'title',a->>'full_name',a->>'name',b->>'title',b->>'full_name',b->>'name'),
 'previous_status',b->>'status','new_status',a->>'status'));
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
-- No auditar respuestas ni recibos de participación: se preserva el anonimato.
create trigger audit after insert or update or delete on public.course_evidence for each row execute function public.audit_change();
create trigger audit after insert or update or delete on public.climate_surveys for each row execute function public.audit_change();

$migration$;
 end if;
end $activation$;
commit;

begin;
do $activation$ begin
 if to_regprocedure('public.complete_hiring_assignment(uuid,uuid,uuid,uuid)') is null then
 execute $migration$
alter table public.employees add column assignment_pending boolean not null default false;
-- Solo las contrataciones nuevas generan pendientes; no altera expedientes anteriores.
create function public.notify_hired_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='CONTRATADO' and old.status is distinct from new.status then
  update public.employees set assignment_pending=true where profile_id=(select profile_id from public.candidates where id=new.candidate_id);
 end if;
 return new;
end $$;
create trigger hired_assignment after update on public.applications for each row execute function public.notify_hired_assignment();
create function public.complete_hiring_assignment(employee uuid, department uuid, target_position uuid, manager uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.is_hr(),false) then raise insufficient_privilege; end if;
 perform 1 from public.employees where id=employee and assignment_pending and status='ACTIVE' for update;
 if not found then raise exception 'ASSIGNMENT_NOT_PENDING' using errcode='22023'; end if;
 if not exists(select 1 from public.positions where id=target_position and department_id=department) then raise exception 'INVALID_HIRING_AREA' using errcode='22023'; end if;
 perform public.command('employee.save',jsonb_build_object('id',employee,'position_id',target_position,'manager_id',coalesce(manager::text,''),'status','ACTIVE'));
 update public.employees set assignment_pending=false where id=employee;
end $$;
revoke all on function public.complete_hiring_assignment(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.complete_hiring_assignment(uuid,uuid,uuid,uuid) to authenticated;

$migration$;
 end if;
end $activation$;
commit;
