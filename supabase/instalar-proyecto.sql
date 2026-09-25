-- Instalación inicial en un proyecto vacío. Después ejecutar activar-mejoras-rh.sql.
-- No usar para reparar instalaciones parciales ni bases existentes.
begin;
do $guard$ begin
 if to_regtype('public.app_role') is not null or to_regclass('public.profiles') is not null or to_regclass('public.audit_logs') is not null then
 raise exception 'La base ya contiene parte del sistema. No reinstales: revisa el proyecto y las migraciones pendientes.';
 end if;
end $guard$;

-- 202609140001_foundation.sql
-- Esquema inicial: tablas, relaciones, roles, funciones auxiliares, políticas RLS y auditoría. Las políticas controlan las filas visibles y los disparadores registran cambios.
create type public.app_role as enum ('SUPERUSER','RH_ADMIN','JEFE','EMPLEADO','CANDIDATO');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null check(length(full_name) between 1 and 150), email text not null, role public.app_role not null default 'CANDIDATO', active boolean not null default true, created_at timestamptz not null default now());
create table public.departments (id uuid primary key default gen_random_uuid(), name text unique not null, created_at timestamptz not null default now());
create table public.positions (id uuid primary key default gen_random_uuid(), name text not null, department_id uuid not null references public.departments, created_at timestamptz not null default now());
create table public.candidates (id uuid primary key default gen_random_uuid(), profile_id uuid unique not null references public.profiles, phone text not null default '', skills text[] not null default '{}', experience_years numeric not null default 0 check(experience_years between 0 and 80), cv_path text, cv_text text not null default '', created_at timestamptz not null default now());
create table public.vacancies (id uuid primary key default gen_random_uuid(), position_id uuid not null references public.positions, title text not null check(length(title) between 1 and 150), description text not null, requirements text not null, skills text[] not null default '{}', experience_required numeric not null default 0 check(experience_required between 0 and 80), status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','CLOSED')), created_by uuid not null references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.applications (id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidates, vacancy_id uuid not null references public.vacancies, status text not null default 'POSTULADO' check(status in ('POSTULADO','EN_REVISION','PRESELECCIONADO','ENTREVISTA','CONTRATADO','RECHAZADO')), ai_result jsonb, applied_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(candidate_id,vacancy_id));
create table public.interviews (id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications, scheduled_at timestamptz not null, interviewer_id uuid not null references public.profiles, notes text not null default '', status text not null default 'SCHEDULED' check(status in ('SCHEDULED','COMPLETED','CANCELLED')), created_by uuid not null references public.profiles, created_at timestamptz not null default now());
create unique index interview_slot on public.interviews(interviewer_id,scheduled_at) where status = 'SCHEDULED';
create table public.employees (id uuid primary key default gen_random_uuid(), profile_id uuid unique not null references public.profiles, position_id uuid not null references public.positions, manager_id uuid references public.employees, hire_date date not null default current_date, status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')), created_at timestamptz not null default now(), check(manager_id is distinct from id));
create table public.onboarding (id uuid primary key default gen_random_uuid(), employee_id uuid unique not null references public.employees, status text not null default 'PENDING' check(status in ('PENDING','IN_PROGRESS','COMPLETED')), created_at timestamptz not null default now());
create table public.onboarding_items (id uuid primary key default gen_random_uuid(), onboarding_id uuid not null references public.onboarding, title text not null, status text not null default 'PENDING' check(status in ('PENDING','IN_PROGRESS','COMPLETED')), due_date date, completed_at timestamptz, created_at timestamptz not null default now());
create table public.onboarding_documents (id uuid primary key default gen_random_uuid(), onboarding_id uuid not null references public.onboarding, file_path text not null, created_at timestamptz not null default now());
create table public.courses (id uuid primary key default gen_random_uuid(), title text not null, description text not null, content text not null, duration_minutes int not null check(duration_minutes > 0), required boolean not null default false, created_at timestamptz not null default now());
create table public.course_assignments (id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses, employee_id uuid not null references public.employees, progress int not null default 0 check(progress between 0 and 100), status text not null default 'ASSIGNED' check(status in ('ASSIGNED','IN_PROGRESS','COMPLETED')), due_date date, completed_at timestamptz, created_at timestamptz not null default now(), unique(course_id,employee_id));
create table public.tasks (id uuid primary key default gen_random_uuid(), title text not null, description text not null, employee_id uuid not null references public.employees, created_by uuid not null references public.profiles, priority text not null default 'MEDIUM' check(priority in ('LOW','MEDIUM','HIGH')), due_date date not null, status text not null default 'PENDING' check(status in ('PENDING','IN_PROGRESS','SUBMITTED','APPROVED','REJECTED')), comments text not null default '', created_at timestamptz not null default now());
create table public.task_evidence (id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks, employee_id uuid not null references public.employees, file_path text not null, evidence_text text not null default '', ai_result jsonb, created_at timestamptz not null default now());
create table public.performance_reviews (id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees, period text not null, task_completion numeric not null check(task_completion between 0 and 100), course_completion numeric not null check(course_completion between 0 and 100), overall_score numeric not null check(overall_score between 0 and 100), summary text, created_at timestamptz not null default now(), unique(employee_id,period));
create table public.surveys (id uuid primary key default gen_random_uuid(), title text not null, description text not null, active boolean not null default true, created_by uuid references public.profiles, created_at timestamptz not null default now());
create table public.survey_questions (id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.surveys, question text not null, type text not null check(type in ('SCALE','CHOICE','TEXT')), options jsonb, created_at timestamptz not null default now());
create table public.survey_responses (id uuid primary key default gen_random_uuid(), question_id uuid not null references public.survey_questions, employee_id uuid not null references public.employees, answer text not null, created_at timestamptz not null default now(), unique(question_id,employee_id));
create table public.ai_requests (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, use_case text not null check(use_case in ('recruitment','evidence')), resource_id uuid not null, provider text not null, status text not null default 'PENDING' check(status in ('PENDING','COMPLETED','FAILED')), created_at timestamptz not null default now());
create table public.ai_results (id uuid primary key default gen_random_uuid(), request_id uuid unique not null references public.ai_requests, result jsonb not null, model text not null, created_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles, action text not null, resource_type text not null, resource_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now());

create function public.current_role() returns public.app_role language sql stable security definer set search_path = '' as $$ select role from public.profiles where id = auth.uid() and active $$;
create function public.is_hr() returns boolean language sql stable security definer set search_path = '' as $$ select coalesce(public.current_role() = 'RH_ADMIN',false) $$;
create function public.owns_candidate(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.candidates where id=cid and profile_id=auth.uid()) and public.current_role() is not null $$;
create function public.owns_employee(eid uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.employees where id=eid and profile_id=auth.uid() and status='ACTIVE') and public.current_role() in ('EMPLEADO','JEFE') $$;
create function public.manages_employee(eid uuid) returns boolean language sql stable security definer set search_path = '' as $$ select public.is_hr() or (public.current_role()='JEFE' and exists(select 1 from public.employees e join public.employees m on m.id=e.manager_id where e.id=eid and m.profile_id=auth.uid() and m.status='ACTIVE')) $$;
create function public.read_employee(eid uuid) returns boolean language sql stable security definer set search_path = '' as $$ select public.owns_employee(eid) or public.manages_employee(eid) $$;
create function public.read_application(aid uuid) returns boolean language sql stable security definer set search_path = '' as $$ select public.is_hr() or exists(select 1 from public.applications where id=aid and public.owns_candidate(candidate_id)) $$;

do $$ declare t text; begin
foreach t in array array['profiles','departments','positions','candidates','vacancies','applications','interviews','employees','onboarding','onboarding_items','onboarding_documents','courses','course_assignments','tasks','task_evidence','performance_reviews','surveys','survey_questions','survey_responses','ai_requests','ai_results','audit_logs'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from anon, authenticated',t);
execute format('grant select on public.%I to authenticated',t);
end loop; end $$;
grant select on public.vacancies, public.positions, public.departments to anon;
create policy profiles_read on public.profiles for select using ((id=auth.uid() and active) or public.current_role()='SUPERUSER' or public.is_hr() or exists(select 1 from public.employees e where e.profile_id=profiles.id and public.read_employee(e.id)));
create policy departments_read on public.departments for select using (true);
create policy positions_read on public.positions for select using (true);
create policy vacancies_read on public.vacancies for select using (status='PUBLISHED' or public.is_hr() or exists(select 1 from public.applications a where a.vacancy_id=vacancies.id and public.owns_candidate(a.candidate_id)));
create policy candidates_read on public.candidates for select using (public.is_hr() or public.owns_candidate(id));
create policy applications_read on public.applications for select using (public.is_hr() or public.owns_candidate(candidate_id));
create policy interviews_read on public.interviews for select using (public.read_application(application_id));
create policy employees_read on public.employees for select using (public.read_employee(id));
create policy onboarding_read on public.onboarding for select using (public.read_employee(employee_id));
create policy onboarding_items_read on public.onboarding_items for select using (exists(select 1 from public.onboarding o where o.id=onboarding_id and public.read_employee(o.employee_id)));
create policy onboarding_docs_read on public.onboarding_documents for select using (exists(select 1 from public.onboarding o where o.id=onboarding_id and (public.owns_employee(o.employee_id) or public.is_hr())));
create policy courses_read on public.courses for select using (public.is_hr() or exists(select 1 from public.course_assignments a where a.course_id=courses.id and public.read_employee(a.employee_id)));
create policy assignments_read on public.course_assignments for select using (public.read_employee(employee_id));
create policy tasks_read on public.tasks for select using (public.read_employee(employee_id));
create policy evidence_read on public.task_evidence for select using (public.read_employee(employee_id));
create policy performance_read on public.performance_reviews for select using (public.read_employee(employee_id));
create policy surveys_read on public.surveys for select using (public.is_hr() or (active and public.current_role() in ('EMPLEADO','JEFE')));
create policy questions_read on public.survey_questions for select using (exists(select 1 from public.surveys s where s.id=survey_id));
create policy responses_read on public.survey_responses for select using (public.owns_employee(employee_id));
create policy ai_requests_read on public.ai_requests for select using (user_id=auth.uid() and public.current_role() is not null);
create policy ai_results_read on public.ai_results for select using (exists(select 1 from public.ai_requests r where r.id=request_id and r.user_id=auth.uid()));
create policy audit_read on public.audit_logs for select using (public.current_role() in ('SUPERUSER','RH_ADMIN'));

create function public.new_user() returns trigger language plpgsql security definer set search_path = '' as $$ begin
insert into public.profiles(id,full_name,email) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)),150),new.email);
insert into public.candidates(profile_id) values(new.id);
return new; end $$;
create trigger auth_new_user after insert on auth.users for each row execute function public.new_user();

create function public.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$ begin
insert into public.audit_logs(user_id,action,resource_type,resource_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id));
if TG_OP='DELETE' then return old; end if; return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','departments','positions','candidates','vacancies','applications','interviews','employees','onboarding','onboarding_items','onboarding_documents','courses','course_assignments','tasks','task_evidence','performance_reviews','ai_requests','ai_results'] loop
execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
end loop; end $$;

create index on public.positions(department_id);
create index on public.applications(vacancy_id,status);
create index on public.interviews(application_id);
create index on public.employees(manager_id);
create index on public.employees(position_id);
create index on public.onboarding_items(onboarding_id);
create index on public.onboarding_documents(onboarding_id);
create index on public.course_assignments(employee_id);
create index on public.tasks(employee_id,status,due_date);
create index on public.task_evidence(task_id);
create index on public.task_evidence(employee_id);
create index on public.ai_requests(user_id,created_at desc);
create index on public.audit_logs(created_at desc);
create index on public.survey_questions(survey_id);
create index on public.survey_responses(employee_id);

-- 202609140002_commands.sql
-- Operaciones de negocio ejecutadas en PostgreSQL. command comprueba el usuario y aplica cambios en una transacción; finish_ai queda reservado al servidor administrativo.
-- Las escrituras de la aplicación pasan por esta lista de operaciones; se revocan las escrituras directas.
create function public.command(op text, payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path = '' as $$
declare
uid uuid := auth.uid(); r public.app_role := public.current_role(); rid uuid; eid uuid; cid uuid; oid uuid;
a public.applications; v public.vacancies; t public.tasks; ca public.course_assignments;
next_status text := payload->>'status'; result jsonb; current_status text;
begin
if uid is null or r is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
if octet_length(payload::text)>100000 then raise exception 'PAYLOAD_TOO_LARGE' using errcode='22023'; end if;
rid := nullif(payload->>'id','')::uuid;
case op
when 'department.save' then
 if r<>'SUPERUSER' then raise insufficient_privilege; end if;
 if rid is null then insert into public.departments(name) values(payload->>'name') returning id into rid;
 else update public.departments set name=payload->>'name' where id=rid; end if;
when 'position.save' then
 if r<>'SUPERUSER' then raise insufficient_privilege; end if;
 if rid is null then insert into public.positions(name,department_id) values(payload->>'name',(payload->>'department_id')::uuid) returning id into rid;
 else update public.positions set name=payload->>'name',department_id=(payload->>'department_id')::uuid where id=rid; end if;
when 'profile.admin' then
 if r<>'SUPERUSER' or rid=uid then raise insufficient_privilege; end if;
 update public.profiles set role=(payload->>'role')::public.app_role,active=(payload->>'active')::boolean where id=rid;
when 'candidate.save' then
 if r<>'CANDIDATO' then raise insufficient_privilege; end if;
 update public.candidates set phone=payload->>'phone',skills=array(select jsonb_array_elements_text(payload->'skills')),experience_years=(payload->>'experience_years')::numeric where profile_id=uid returning id into rid;
when 'vacancy.save' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 if rid is null then insert into public.vacancies(position_id,title,description,requirements,skills,experience_required,status,created_by)
 values((payload->>'position_id')::uuid,payload->>'title',payload->>'description',payload->>'requirements',array(select jsonb_array_elements_text(payload->'skills')),(payload->>'experience_required')::numeric,payload->>'status',uid) returning id into rid;
 else update public.vacancies set position_id=(payload->>'position_id')::uuid,title=payload->>'title',description=payload->>'description',requirements=payload->>'requirements',skills=array(select jsonb_array_elements_text(payload->'skills')),experience_required=(payload->>'experience_required')::numeric,status=payload->>'status',updated_at=now() where id=rid; end if;
when 'vacancy.delete' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 delete from public.vacancies where id=rid and status<>'PUBLISHED';
 if not found then raise exception 'CLOSE_FIRST' using errcode='22023'; end if;
when 'application.create' then
 if r<>'CANDIDATO' then raise insufficient_privilege; end if;
 select id into cid from public.candidates where profile_id=uid;
 select * into v from public.vacancies where id=(payload->>'vacancy_id')::uuid for update;
 if v.id is null or v.status<>'PUBLISHED' then raise exception 'VACANCY_CLOSED' using errcode='22023'; end if;
 insert into public.applications(candidate_id,vacancy_id) values(cid,v.id) returning id into rid;
when 'application.status' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 select * into a from public.applications where id=rid for update;
 if a.id is null then raise no_data_found; end if;
 if not ((a.status='POSTULADO' and next_status in ('EN_REVISION','RECHAZADO')) or (a.status='EN_REVISION' and next_status in ('PRESELECCIONADO','RECHAZADO')) or (a.status in ('PRESELECCIONADO','ENTREVISTA') and next_status='RECHAZADO')) then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
 update public.applications set status=next_status,updated_at=now() where id=rid;
when 'interview.save' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 select * into a from public.applications where id=(payload->>'application_id')::uuid for update;
 if a.id is null or a.status not in ('PRESELECCIONADO','ENTREVISTA') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles where id=(payload->>'interviewer_id')::uuid and role='RH_ADMIN' and active) then raise exception 'INVALID_INTERVIEWER' using errcode='22023'; end if;
 -- Serializa la agenda por entrevistador y exige un intervalo de 60 minutos.
 perform pg_advisory_xact_lock(hashtext(payload->>'interviewer_id'));
 if (payload->>'status')='SCHEDULED' and exists(select 1 from public.interviews where interviewer_id=(payload->>'interviewer_id')::uuid and status='SCHEDULED' and id is distinct from rid and abs(extract(epoch from scheduled_at-(payload->>'scheduled_at')::timestamptz))<3600) then raise exception 'SCHEDULE_CONFLICT' using errcode='23505'; end if;
 if rid is null then insert into public.interviews(application_id,scheduled_at,interviewer_id,notes,status,created_by) values(a.id,(payload->>'scheduled_at')::timestamptz,(payload->>'interviewer_id')::uuid,payload->>'notes',payload->>'status',uid) returning id into rid;
 else update public.interviews set scheduled_at=(payload->>'scheduled_at')::timestamptz,interviewer_id=(payload->>'interviewer_id')::uuid,notes=payload->>'notes',status=payload->>'status' where id=rid and application_id=a.id; if not found then raise no_data_found; end if; end if;
 update public.applications set status='ENTREVISTA',updated_at=now() where id=a.id;
when 'interview.cancel' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 update public.interviews set status='CANCELLED' where id=rid;
when 'application.hire' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 select * into a from public.applications where id=rid for update;
 if a.id is null then raise no_data_found; end if;
 if a.status<>'ENTREVISTA' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
 if not exists(select 1 from public.interviews where application_id=a.id and status<>'CANCELLED') then raise exception 'INTERVIEW_REQUIRED' using errcode='22023'; end if;
 select * into v from public.vacancies where id=a.vacancy_id;
 select profile_id into cid from public.candidates where id=a.candidate_id;
 perform 1 from public.profiles where id=cid and role='CANDIDATO' and active for update;
 if not found then raise exception 'ALREADY_EMPLOYEE' using errcode='23505'; end if;
 insert into public.employees(profile_id,position_id) values(cid,v.position_id) returning id into eid;
 update public.profiles set role='EMPLEADO' where id=cid;
 update public.applications set status='CONTRATADO',updated_at=now() where id=a.id;
 insert into public.onboarding(employee_id) values(eid) returning id into oid;
 insert into public.onboarding_items(onboarding_id,title,due_date) select oid,title,current_date+7 from unnest(array['Entregar documentación','Conocer al equipo','Leer reglamento','Configurar herramientas']) title;
 insert into public.course_assignments(course_id,employee_id,due_date) select id,eid,current_date+14 from public.courses where required;
 insert into public.tasks(title,description,employee_id,created_by,due_date) values('Mi primera entrega','Documenta tu configuración inicial y lo aprendido en la inducción.',eid,uid,current_date+7);
 insert into public.audit_logs(user_id,action,resource_type,resource_id,metadata) values(uid,'candidate.hired','applications',rid,jsonb_build_object('employee_id',eid));
 return jsonb_build_object('id',eid);
when 'employee.save' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 if nullif(payload->>'manager_id','') is not null and not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=(payload->>'manager_id')::uuid and p.role='JEFE' and p.active and e.status='ACTIVE') then raise exception 'INVALID_MANAGER' using errcode='22023'; end if;
 update public.employees set position_id=(payload->>'position_id')::uuid,manager_id=nullif(payload->>'manager_id','')::uuid,status=payload->>'status' where id=rid;
when 'onboarding.complete' then
 select o.employee_id,o.id into eid,oid from public.onboarding o join public.onboarding_items i on i.onboarding_id=o.id where i.id=rid;
 if not coalesce(public.owns_employee(eid) or public.is_hr(),false) then raise insufficient_privilege; end if;
 update public.onboarding_items set status='COMPLETED',completed_at=now() where id=rid;
 update public.onboarding set status=case when exists(select 1 from public.onboarding_items where onboarding_id=oid and status<>'COMPLETED') then 'IN_PROGRESS' else 'COMPLETED' end where id=oid;
when 'course.save' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 if rid is null then insert into public.courses(title,description,content,duration_minutes,required) values(payload->>'title',payload->>'description',payload->>'content',(payload->>'duration_minutes')::int,(payload->>'required')::boolean) returning id into rid;
 else update public.courses set title=payload->>'title',description=payload->>'description',content=payload->>'content',duration_minutes=(payload->>'duration_minutes')::int,required=(payload->>'required')::boolean where id=rid; end if;
when 'course.delete' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 delete from public.courses where id=rid;
when 'course.assign' then
 if r<>'RH_ADMIN' then raise insufficient_privilege; end if;
 insert into public.course_assignments(course_id,employee_id,due_date) values(rid,(payload->>'employee_id')::uuid,(payload->>'due_date')::date) returning id into rid;
when 'course.progress' then
 select * into ca from public.course_assignments where id=rid for update;
 if not coalesce(public.owns_employee(ca.employee_id),false) then raise insufficient_privilege; end if;
 if (payload->>'progress')::int<ca.progress then raise exception 'INVALID_PROGRESS' using errcode='22023'; end if;
 update public.course_assignments set progress=(payload->>'progress')::int,status=case when (payload->>'progress')::int=100 then 'COMPLETED' when (payload->>'progress')::int>0 then 'IN_PROGRESS' else 'ASSIGNED' end,completed_at=case when (payload->>'progress')::int=100 then now() else null end where id=rid;
when 'task.save' then
 eid:=(payload->>'employee_id')::uuid;
 if not coalesce(public.manages_employee(eid),false) then raise insufficient_privilege; end if;
 if rid is null then insert into public.tasks(title,description,employee_id,created_by,priority,due_date) values(payload->>'title',payload->>'description',eid,uid,payload->>'priority',(payload->>'due_date')::date) returning id into rid;
 else select * into t from public.tasks where id=rid for update; if not coalesce(public.manages_employee(t.employee_id),false) or t.status in ('SUBMITTED','APPROVED') then raise insufficient_privilege; end if;
 update public.tasks set title=payload->>'title',description=payload->>'description',employee_id=eid,priority=payload->>'priority',due_date=(payload->>'due_date')::date where id=rid; end if;
when 'task.status' then
 select * into t from public.tasks where id=rid for update;
 if t.id is null then raise no_data_found; end if;
 if next_status='IN_PROGRESS' and t.status in ('PENDING','REJECTED') and public.owns_employee(t.employee_id) then
 update public.tasks set status=next_status where id=rid;
 elsif next_status in ('APPROVED','REJECTED') and t.status='SUBMITTED' and public.manages_employee(t.employee_id) then
 update public.tasks set status=next_status,comments=coalesce(payload->>'comments','') where id=rid;
 else raise exception 'INVALID_TRANSITION' using errcode='42501'; end if;
when 'file.attach' then
 if split_part(payload->>'path','/',1)<>uid::text or not exists(select 1 from storage.objects where bucket_id=payload->>'bucket' and name=payload->>'path') then raise insufficient_privilege; end if;
 if payload->>'bucket'='cvs' then
 if r<>'CANDIDATO' then raise insufficient_privilege; end if;
 update public.candidates set cv_path=payload->>'path',cv_text=left(coalesce(payload->>'text',''),14000) where profile_id=uid returning id into rid;
 elsif payload->>'bucket'='task-evidence' then
 select * into t from public.tasks where id=rid for update;
 if not coalesce(public.owns_employee(t.employee_id),false) or t.status not in ('IN_PROGRESS','REJECTED') then raise insufficient_privilege; end if;
 insert into public.task_evidence(task_id,employee_id,file_path,evidence_text) values(t.id,t.employee_id,payload->>'path',left(coalesce(payload->>'text',''),14000)) returning id into rid;
 update public.tasks set status='SUBMITTED' where id=t.id;
 elsif payload->>'bucket'='onboarding-documents' then
 select employee_id into eid from public.onboarding where id=rid;
 if not coalesce(public.owns_employee(eid),false) then raise insufficient_privilege; end if;
 insert into public.onboarding_documents(onboarding_id,file_path) values(rid,payload->>'path') returning id into rid;
 else raise insufficient_privilege; end if;
when 'ai.begin' then
 if payload->>'use_case'='recruitment' then
 if r<>'RH_ADMIN' or not exists(select 1 from public.applications where id=rid) then raise insufficient_privilege; end if;
 elsif payload->>'use_case'='evidence' then
 if not exists(select 1 from public.task_evidence e join public.tasks t on t.id=e.task_id where e.id=rid and public.manages_employee(e.employee_id) and t.status='SUBMITTED') then raise insufficient_privilege; end if;
 else raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 if (select count(*) from public.ai_requests where user_id=uid and created_at>now()-interval '1 minute')>=5 then raise exception 'RATE_LIMIT' using errcode='P0001'; end if;
 if exists(select 1 from public.ai_requests where resource_id=rid and status='PENDING' and created_at>now()-interval '2 minutes') then raise exception 'AI_IN_PROGRESS' using errcode='23505'; end if;
 insert into public.ai_requests(user_id,use_case,resource_id,provider) values(uid,payload->>'use_case',rid,payload->>'provider') returning id into rid;
when 'audit.access' then
 if payload->>'resource'='candidates' and not (public.is_hr() or public.owns_candidate(rid)) then raise insufficient_privilege; end if;
 insert into public.audit_logs(user_id,action,resource_type,resource_id) values(uid,'access',left(payload->>'resource',80),rid);
else raise exception 'UNKNOWN_COMMAND' using errcode='22023';
end case;
return jsonb_build_object('id',rid);
end $$;
revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;

-- Solo el servidor de IA puede guardar un resultado validado del proveedor.
create function public.finish_ai(request uuid, output jsonb, model_name text, succeeded boolean) returns void language plpgsql security definer set search_path = '' as $$
declare req public.ai_requests; begin
select * into req from public.ai_requests where id=request and status='PENDING' for update;
if req.id is null then raise no_data_found; end if;
update public.ai_requests set status=case when succeeded then 'COMPLETED' else 'FAILED' end where id=request;
if not succeeded then return; end if;
insert into public.ai_results(request_id,result,model) values(request,output,model_name);
if req.use_case='recruitment' then update public.applications set ai_result=output where id=req.resource_id;
else update public.task_evidence set ai_result=output where id=req.resource_id; end if;
end $$;
revoke all on function public.finish_ai(uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_ai(uuid,jsonb,text,boolean) to service_role;
revoke all on function public.new_user(),public.audit_change() from public,anon,authenticated;

-- 202609140003_storage.sql
-- Crea depósitos privados y políticas de acceso a objetos. Relaciona rutas de archivos con propietarios y recursos autorizados.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('cvs','cvs',false,5242880,array['application/pdf','text/plain']),
('task-evidence','task-evidence',false,5242880,array['application/pdf','text/plain','image/png','image/jpeg']),
('onboarding-documents','onboarding-documents',false,5242880,array['application/pdf','text/plain','image/png','image/jpeg']);
create policy files_insert on storage.objects for insert to authenticated with check (
(storage.foldername(name))[1]=auth.uid()::text and
((bucket_id='cvs' and public.current_role()='CANDIDATO') or (bucket_id in ('task-evidence','onboarding-documents') and public.current_role() in ('EMPLEADO','JEFE'))));
create policy files_read on storage.objects for select to authenticated using (
public.current_role() is not null and (
((storage.foldername(name))[1]=auth.uid()::text and bucket_id in ('cvs','task-evidence','onboarding-documents')) or
(bucket_id='cvs' and public.is_hr() and exists(select 1 from public.candidates c where c.cv_path=name)) or
(bucket_id='task-evidence' and exists(select 1 from public.task_evidence e where e.file_path=name and public.manages_employee(e.employee_id))) or
(bucket_id='onboarding-documents' and public.is_hr() and exists(select 1 from public.onboarding_documents d where d.file_path=name))));
-- Sin políticas de sobrescritura ni eliminación: el usuario no modifica evidencias ya enviadas.

-- 202609140004_hardening.sql
-- Endurece permisos y reglas del esquema existente. Se aplica después de las migraciones iniciales; no sustituye la instalación completa.
-- Invalida recomendaciones al actualizar los campos de entrada vigilados por los disparadores.
create function public.invalidate_recommendations() returns trigger language plpgsql security definer set search_path='' as $$ begin
if TG_TABLE_NAME='candidates' then
 update public.applications set ai_result=null where candidate_id=new.id and ai_result is not null;
else
 update public.applications set ai_result=null where vacancy_id=new.id and ai_result is not null;
end if;return new;end $$;
create trigger candidate_ai_stale after update of skills,experience_years,cv_text on public.candidates for each row execute function public.invalidate_recommendations();
create trigger vacancy_ai_stale after update of requirements,skills,experience_required,description,title on public.vacancies for each row execute function public.invalidate_recommendations();
revoke all on function public.invalidate_recommendations() from public,anon,authenticated;
-- Limita los textos ingresados incluso si se llama directamente a la RPC REST.
alter table public.candidates drop constraint candidates_profile_id_fkey;
alter table public.candidates add constraint candidates_profile_id_fkey foreign key(profile_id) references public.profiles(id) on delete cascade;
alter table public.departments add constraint department_name_length check(length(name) between 1 and 150);
alter table public.positions add constraint position_name_length check(length(name) between 1 and 150);
alter table public.vacancies add constraint vacancy_text_length check(length(description) between 1 and 14000 and length(requirements) between 1 and 14000 and cardinality(skills)<=40);
alter table public.candidates add constraint candidate_text_length check(length(phone)<=40 and cardinality(skills)<=40 and length(cv_text)<=14000);
alter table public.courses add constraint course_text_length check(length(title) between 1 and 150 and length(content) between 1 and 14000 and length(description) between 1 and 14000 and duration_minutes<=10000);
alter table public.tasks add constraint task_text_length check(length(title) between 1 and 150 and length(description) between 1 and 14000 and length(comments)<=4000);
alter table public.interviews add constraint interview_notes_length check(length(notes)<=4000);
-- Restringe la ejecución de funciones auxiliares a los roles necesarios para las políticas.
revoke all on function public.owns_candidate(uuid),public.owns_employee(uuid),public.manages_employee(uuid),public.read_employee(uuid),public.read_application(uuid) from public;
grant execute on function public.owns_candidate(uuid),public.owns_employee(uuid),public.manages_employee(uuid),public.read_employee(uuid),public.read_application(uuid) to authenticated,anon;
grant all on all tables in schema public to service_role;

-- 202609140005_public_vacancies.sql
-- Ajusta la lectura pública de vacantes y sus relaciones para permitir consultar oportunidades sin iniciar sesión.
-- Separa la visibilidad anónima de las políticas que consultan tablas privadas.
-- No concede acceso anónimo a postulaciones ni datos de candidatos.
alter policy vacancies_read on public.vacancies to authenticated;
drop policy if exists vacancies_public_read on public.vacancies;
create policy vacancies_public_read on public.vacancies
for select to anon using (status = 'PUBLISHED');

-- 202609150001_fix_ai_evidence_alias.sql
-- Corrige el alias SQL que impedía iniciar análisis de evidencias. Detecta la versión esperada antes de reemplazar el fragmento y admite volver a ejecutarse.
-- Corrige la colision entre la variable PL/pgSQL t y el alias de tasks.
-- Ejecutar completo en Supabase > SQL Editor. Conserva permisos y datos.
do $migration$
declare
  definition text;
  old_fragment text := 'select 1 from public.task_evidence e join public.tasks t on t.id=e.task_id where e.id=rid and public.manages_employee(e.employee_id) and t.status=''SUBMITTED''';
  new_fragment text := 'select 1 from public.task_evidence evidence_row join public.tasks task_row on task_row.id=evidence_row.task_id where evidence_row.id=rid and public.manages_employee(evidence_row.employee_id) and task_row.status=''SUBMITTED''';
begin
  select pg_get_functiondef('public.command(text,jsonb)'::regprocedure) into definition;
  if strpos(definition, old_fragment) > 0 then
    execute replace(definition, old_fragment, new_fragment);
  elsif strpos(definition, new_fragment) = 0 then
    raise exception 'La funcion command tiene otra version; no se modifico.';
  end if;
end
$migration$;

-- Datos base de áreas, puestos y cursos. No crea cuentas de acceso; sus inserciones no están diseñadas para ejecutarse repetidamente sobre la misma base.
insert into public.departments(id,name) values
('10000000-0000-4000-8000-000000000001','Tecnología'),('10000000-0000-4000-8000-000000000002','Personas'),('10000000-0000-4000-8000-000000000003','Operaciones');
insert into public.positions(id,name,department_id) values
('20000000-0000-4000-8000-000000000001','Desarrollador Full Stack','10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000002','Líder de ingeniería','10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000003','Analista de talento','10000000-0000-4000-8000-000000000002'),
('20000000-0000-4000-8000-000000000004','Analista de operaciones','10000000-0000-4000-8000-000000000003'),
('20000000-0000-4000-8000-000000000005','Diseñador de producto','10000000-0000-4000-8000-000000000001');
insert into public.courses(title,description,content,duration_minutes,required) values
('Bienvenida al equipo','Conoce nuestra forma de trabajar.','Trabajamos con objetivos semanales, documentación compartida y revisión entre pares. Agenda una presentación con tu equipo y revisa los objetivos de tu puesto.',20,true),
('Seguridad de la información','Protege los datos de las personas.','Usa contraseñas únicas y MFA. Comparte documentos únicamente por canales autorizados. Reporta mensajes sospechosos. Nunca incluyas secretos en documentos, tickets o herramientas de IA.',30,true),
('Comunicación efectiva','Comunica decisiones con claridad.','Explica el contexto, la decisión y los siguientes pasos. Escucha antes de responder y registra los acuerdos.',25,false),
('Gestión del tiempo','Prioriza y entrega valor.','Define resultados concretos, divide tareas y comunica bloqueos de forma temprana.',20,false),
('Calidad de entregables','Revisa y documenta tu trabajo.','Verifica criterios de aceptación. Adjunta evidencia reproducible y solicita revisión humana.',35,false);

commit;
