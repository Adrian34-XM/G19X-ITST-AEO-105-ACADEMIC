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
