-- Evidencias privadas de capacitación y validación humana obligatoria.
begin;
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
commit;
