begin;
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

commit;
