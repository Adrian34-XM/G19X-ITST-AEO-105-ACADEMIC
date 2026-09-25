begin;
alter table public.course_assignments add column progress_review_pending boolean not null default false, add column approved_progress integer not null default 0 check(approved_progress between 0 and 100);
update public.course_assignments set approved_progress=100 where status='COMPLETED';
update public.course_assignments a set progress_review_pending=true where status<>'COMPLETED' and (progress>0 or exists(select 1 from public.course_evidence e where e.assignment_id=a.id));
create function public.flag_course_progress() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='course_evidence' then
  update public.course_assignments set progress_review_pending=true where id=new.assignment_id;
 elsif new.progress is distinct from old.progress and public.owns_employee(new.employee_id) then
  new.progress_review_pending:=true;
 end if;
 return new;
end $$;
create trigger course_progress_notice before update on public.course_assignments for each row execute function public.flag_course_progress();
create trigger course_evidence_notice after insert on public.course_evidence for each row execute function public.flag_course_progress();
create function public.review_course_progress(assignment uuid,decision text,percentage integer,comments text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.course_assignments;
begin
 select * into a from public.course_assignments where id=assignment for update;
 if not found or not coalesce(public.manages_employee(a.employee_id),false) or public.owns_employee(a.employee_id) or public.current_role() not in ('RH_ADMIN','JEFE','SUPERUSER') then raise insufficient_privilege; end if;
 if not a.progress_review_pending or a.status='COMPLETED' then raise exception 'NO_PENDING_REVIEW' using errcode='22023'; end if;
 if decision is null or decision not in ('ACCEPT','REJECT') or percentage is null or percentage not between 0 and 100 or comments is null or length(trim(comments)) not between 1 and 2000 then raise invalid_parameter_value; end if;
 if decision='REJECT' and percentage>a.approved_progress then raise exception 'REJECTED_PROGRESS_INCREASE' using errcode='22023'; end if;
 if decision='ACCEPT' and percentage>0 and not exists(select 1 from public.course_evidence e where e.assignment_id=a.id and e.progress>=percentage and (a.evidence_required_after is null or e.created_at>a.evidence_required_after)) then raise exception 'COURSE_EVIDENCE_REQUIRED' using errcode='22023'; end if;
 if decision='ACCEPT' and percentage=100 and a.status<>'SUBMITTED' then
  update public.course_assignments set status='SUBMITTED' where id=a.id;
 end if;
 update public.course_assignments set progress=percentage,approved_progress=percentage,
 status=case when decision='ACCEPT' and percentage=100 then 'COMPLETED' when percentage=0 then 'ASSIGNED' else 'IN_PROGRESS' end,
 completed_at=case when decision='ACCEPT' and percentage=100 then now() else null end,
 reviewed_by=auth.uid(),reviewed_at=now(),review_comments=trim(comments),progress_review_pending=false,
 evidence_required_after=case when decision='REJECT' then now() else evidence_required_after end where id=a.id;
end $$;
revoke all on function public.review_course_progress(uuid,text,integer,text) from public,anon;
grant execute on function public.review_course_progress(uuid,text,integer,text) to authenticated;
commit;

