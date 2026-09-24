-- Amplía RH al superadministrador sin cambiar su rol ni su identidad de auditoría.
begin;
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
commit;
