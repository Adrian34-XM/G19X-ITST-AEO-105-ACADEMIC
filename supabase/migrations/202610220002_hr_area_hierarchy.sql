begin;

-- Considera parte de RH tanto a sus responsables como al personal con puesto en el área.
create or replace function public.is_hr_employee(eid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.employees e
  join public.profiles p on p.id=e.profile_id
  left join public.positions position on position.id=e.position_id
  left join public.departments department on department.id=position.department_id
  where e.id=eid and (
   p.role='RH_ADMIN' or lower(btrim(coalesce(department.name,'')))='recursos humanos'
  )
 );
$$;
revoke all on function public.is_hr_employee(uuid) from public,anon;
grant execute on function public.is_hr_employee(uuid) to authenticated;

-- Solo la máxima jefatura RH de la cadena puede cambiar los datos de personal del área.
create or replace function public.can_modify_hr_employee(eid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_hr_employee(eid)
  and public.current_role()='RH_ADMIN'
  and exists(
   with recursive ancestors(id,profile_id,manager_id,status,depth,path) as (
    select m.id,m.profile_id,m.manager_id,m.status,1,array[e.id,m.id]
    from public.employees e join public.employees m on m.id=e.manager_id
    where e.id=eid and e.profile_id<>auth.uid()
    union all
    select m.id,m.profile_id,m.manager_id,m.status,a.depth+1,a.path||m.id
    from ancestors a join public.employees m on m.id=a.manager_id
    where not m.id=any(a.path)
   )
   select 1 from (
    select a.profile_id,a.status,p.active
    from ancestors a join public.profiles p on p.id=a.profile_id
    where p.role='RH_ADMIN'
    order by a.depth desc
    limit 1
   ) highest
   where highest.profile_id=auth.uid() and highest.status='ACTIVE' and highest.active
   union all
   -- El encargado asignado puede conectar una sola vez las filas RH históricas
   -- que todavía no tengan ningún antecesor RH.
   select 1 from public.employees target
   join public.positions position on position.id=target.position_id
   join public.departments department on department.id=position.department_id
   join public.employees area_manager on area_manager.id=department.manager_employee_id
   join public.profiles lead_profile on lead_profile.id=area_manager.profile_id
   where target.id=eid and target.profile_id<>auth.uid() and target.manager_id is null
    and lower(btrim(department.name))='recursos humanos'
    and area_manager.profile_id=auth.uid() and area_manager.status='ACTIVE'
    and lead_profile.active and lead_profile.role='RH_ADMIN'
    and not exists(
     with recursive prior_rh(id,manager_id,path) as (
      select manager.id,manager.manager_id,array[target.id,manager.id]
      from public.employees employee
      join public.employees manager on manager.id=employee.manager_id
      where employee.id=target.id
      union all
      select manager.id,manager.manager_id,prior_rh.path||manager.id
      from prior_rh join public.employees manager on manager.id=prior_rh.manager_id
      where not manager.id=any(prior_rh.path)
     ) select 1 from prior_rh
      join public.employees ancestor on ancestor.id=prior_rh.id
      join public.profiles p on p.id=ancestor.profile_id
      where p.role='RH_ADMIN'
    )
  );
$$;
revoke all on function public.can_modify_hr_employee(uuid) from public,anon;
grant execute on function public.can_modify_hr_employee(uuid) to authenticated;

create or replace function public.guard_hr_hierarchy() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if tg_op='INSERT' then
  if exists(select 1 from public.profiles where id=new.profile_id and role='RH_ADMIN')
   and public.current_role() is distinct from 'SUPERUSER' then
   raise exception 'HR_HIERARCHY_FORBIDDEN' using errcode='42501';
  end if;
  return new;
 end if;
 if new.position_id is not distinct from old.position_id
  and new.manager_id is not distinct from old.manager_id
  and new.status is not distinct from old.status
  and new.profile_id is not distinct from old.profile_id then return new; end if;
 perform pg_advisory_xact_lock(17092026);
 for target in
  with recursive branch(id) as (
   select old.id
   union select e.id from public.employees e join branch b on e.manager_id=b.id
    where new.manager_id is distinct from old.manager_id
  ) select b.id from branch b where public.is_hr_employee(b.id)
 loop
  if not coalesce(public.can_modify_hr_employee(target),false) then
   raise exception 'HR_HIERARCHY_FORBIDDEN' using errcode='42501';
  end if;
 end loop;
 return new;
end $$;

-- Los responsables RH pueden ser jefes directos, igual que los jefes de equipo.
create or replace function public.validate_manager_tree() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(17092026);
 if new.manager_id is null then return new; end if;
 if not exists(
  select 1 from public.employees e
  join public.profiles p on p.id=e.profile_id
  where e.id=new.manager_id and e.status='ACTIVE' and p.active
   and p.role in ('JEFE','RH_ADMIN')
 ) then raise exception 'INVALID_MANAGER' using errcode='22023'; end if;
 if new.manager_id=new.id or exists(
  with recursive ancestors(id,manager_id) as (
   select id,manager_id from public.employees where id=new.manager_id
   union select e.id,e.manager_id from public.employees e join ancestors a on e.id=a.manager_id
  ) select 1 from ancestors where id=new.id
 ) then raise exception 'HIERARCHY_CYCLE' using errcode='22023'; end if;
 return new;
end $$;

-- Para altas nuevas en el área canónica, PostgreSQL fija el líder vigente
-- del departamento y no acepta un superior alternativo enviado por el cliente.
alter function public.command(text,jsonb) rename to hr_area_legacy_command;
revoke all on function public.hr_area_legacy_command(text,jsonb) from public,anon,authenticated;
create function public.command(op text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 result jsonb;
 rid uuid;
 target_profile uuid;
 target_position uuid;
 target_manager uuid;
 is_hr_department boolean;
begin
 if op<>'employee.enroll' then
  return public.hr_area_legacy_command(op,payload);
 end if;
 if public.current_role() is null or not public.is_hr() then raise insufficient_privilege; end if;
 target_profile:=(payload->>'profile_id')::uuid;
 target_position:=(payload->>'position_id')::uuid;
 if not exists(
  select 1 from public.profiles where id=target_profile and active
   and role in ('RH_ADMIN','JEFE','EMPLEADO')
 ) then raise insufficient_privilege; end if;
 if not exists(select 1 from public.positions where id=target_position) then raise no_data_found; end if;
 select exists(
  select 1 from public.positions p join public.departments d on d.id=p.department_id
  where p.id=target_position and lower(btrim(d.name))='recursos humanos'
 ), d.manager_employee_id
 into is_hr_department,target_manager
 from public.departments d
 where lower(btrim(d.name))='recursos humanos'
 limit 1;
 if coalesce(is_hr_department,false) then
  if target_manager is null then
   raise exception 'HR_DEPARTMENT_MANAGER_REQUIRED' using errcode='23514';
  end if;
  if not exists(
   select 1 from public.employees e join public.profiles p on p.id=e.profile_id
   where e.id=target_manager and e.status='ACTIVE' and p.active
    and p.role in ('JEFE','RH_ADMIN')
  ) then raise exception 'INVALID_MANAGER' using errcode='22023'; end if;
  insert into public.employees(profile_id,position_id,manager_id)
  values(target_profile,target_position,target_manager)
  returning id into rid;
 else
  insert into public.employees(profile_id,position_id,manager_id)
  values(target_profile,target_position,nullif(payload->>'manager_id','')::uuid)
  returning id into rid;
 end if;
 return jsonb_build_object('id',rid);
end $$;
revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;

create or replace function public.hr_hierarchy_version() returns integer
language sql immutable as $$ select 3 $$;
revoke all on function public.hr_hierarchy_version() from public,anon;
grant execute on function public.hr_hierarchy_version() to authenticated;

commit;
