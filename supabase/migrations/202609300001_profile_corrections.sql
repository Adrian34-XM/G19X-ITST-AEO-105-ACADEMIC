begin;
-- Las correcciones no permiten cambiar roles, jerarquía ni credenciales de acceso.
create table public.profile_corrections (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees,
 field text not null check(field in ('full_name','hire_date')), proposed_value text not null check(length(proposed_value) between 1 and 150),
 reason text not null check(length(reason) between 1 and 1000), status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),
 requested_by uuid not null references public.profiles, reviewed_by uuid references public.profiles,
 review_comment text not null default '', created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index profile_correction_pending on public.profile_corrections(employee_id,field) where status='PENDING';
alter table public.profile_corrections enable row level security;
grant select on public.profile_corrections to authenticated;
grant all on public.profile_corrections to service_role;
create policy correction_read on public.profile_corrections for select using(public.owns_employee(employee_id) or public.is_hr());
create trigger audit after insert or update or delete on public.profile_corrections for each row execute function public.audit_change();
create function public.request_profile_correction(eid uuid, field_name text, proposed text, explanation text) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if public.current_role() is null or not coalesce(public.owns_employee(eid),false) then raise insufficient_privilege; end if;
 if field_name not in ('full_name','hire_date') or field_name is null or nullif(trim(proposed),'') is null or length(proposed)>150 or nullif(trim(explanation),'') is null or length(explanation)>1000 then raise invalid_parameter_value; end if;
 if field_name='hire_date' and (proposed !~ '^\d{4}-\d{2}-\d{2}$' or proposed::date>current_date) then raise invalid_parameter_value; end if;
 insert into public.profile_corrections(employee_id,field,proposed_value,reason,requested_by) values(eid,field_name,trim(proposed),trim(explanation),auth.uid()) returning id into rid;
 return rid;
end $$;
create function public.review_profile_correction(rid uuid, approve boolean, feedback text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.profile_corrections; target public.employees; target_role public.app_role;
begin
 if not coalesce(public.is_hr(),false) then raise insufficient_privilege; end if;
 select * into r from public.profile_corrections where id=rid for update;
 if not found or r.status<>'PENDING' then raise exception 'CORRECTION_NOT_PENDING'; end if;
 select * into target from public.employees where id=r.employee_id for update;
 select role into target_role from public.profiles where id=target.profile_id;
 if target.profile_id=auth.uid() or (target_role='RH_ADMIN' and not coalesce(public.can_modify_hr_employee(target.id),false)) or (target_role='SUPERUSER' and public.current_role()<>'SUPERUSER') then raise insufficient_privilege; end if;
 if approve is null or nullif(trim(feedback),'') is null or length(feedback)>1000 then raise invalid_parameter_value; end if;
 if approve then
  if r.field='full_name' then update public.profiles set full_name=r.proposed_value where id=target.profile_id;
  elsif r.field='hire_date' then update public.employees set hire_date=r.proposed_value::date where id=target.id; end if;
 end if;
 update public.profile_corrections set status=case when approve then 'APPROVED' else 'REJECTED' end,review_comment=trim(feedback),reviewed_by=auth.uid(),reviewed_at=now() where id=rid;
end $$;
revoke all on function public.request_profile_correction(uuid,text,text,text) from public,anon;
revoke all on function public.review_profile_correction(uuid,boolean,text) from public,anon;
grant execute on function public.request_profile_correction(uuid,text,text,text),public.review_profile_correction(uuid,boolean,text) to authenticated;
commit;
