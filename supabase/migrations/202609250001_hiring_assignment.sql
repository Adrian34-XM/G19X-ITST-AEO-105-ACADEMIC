begin;
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
commit;
