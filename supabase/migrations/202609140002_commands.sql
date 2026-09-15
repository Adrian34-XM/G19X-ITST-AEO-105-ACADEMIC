-- All application writes cross this allowlist. Direct table writes are revoked.
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
 -- Serialize scheduling per interviewer, then enforce a 60-minute interval.
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

-- Only the server AI Hub may persist a validated provider result.
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
