begin;
-- El superior de RH más alto de la cadena autoriza cambios; el superusuario siempre puede.
create function public.can_modify_hr_employee(eid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.current_role()='SUPERUSER' or (
  public.current_role()='RH_ADMIN' and exists (
   with recursive ancestors(id,profile_id,manager_id,status,depth,path) as (
    select m.id,m.profile_id,m.manager_id,m.status,1,array[e.id,m.id]
    from public.employees e join public.employees m on m.id=e.manager_id where e.id=eid and e.profile_id<>auth.uid()
    union all
    select m.id,m.profile_id,m.manager_id,m.status,a.depth+1,a.path||m.id
    from ancestors a join public.employees m on m.id=a.manager_id where not m.id=any(a.path)
   ) select 1 from (
    select a.profile_id,a.status,p.active from ancestors a join public.profiles p on p.id=a.profile_id
    where p.role='RH_ADMIN' order by a.depth desc limit 1
   ) highest where highest.profile_id=auth.uid() and highest.status='ACTIVE' and highest.active
  )
 );
$$;
revoke all on function public.can_modify_hr_employee(uuid) from public,anon;
grant execute on function public.can_modify_hr_employee(uuid) to authenticated;
create function public.guard_hr_hierarchy() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if tg_op='INSERT' then
  -- Sin jerarquía previa, el alta inicial de RH corresponde al superusuario.
  if exists(select 1 from public.profiles where id=new.profile_id and role='RH_ADMIN')
   and public.current_role() is distinct from 'SUPERUSER' then
   raise exception 'HR_HIERARCHY_FORBIDDEN' using errcode='42501';
  end if;
  return new;
 end if;
 if new.position_id is not distinct from old.position_id and new.manager_id is not distinct from old.manager_id
  and new.status is not distinct from old.status and new.profile_id is not distinct from old.profile_id then return new; end if;
 perform pg_advisory_xact_lock(17092026);
 -- Mover un antecesor tampoco permite apropiarse de una rama de RH.
 for target in
  with recursive branch(id,profile_id) as (
   select old.id,old.profile_id
   union select e.id,e.profile_id from public.employees e join branch b on e.manager_id=b.id
    where new.manager_id is distinct from old.manager_id
  ) select b.id from branch b join public.profiles p on p.id=b.profile_id where p.role='RH_ADMIN'
 loop
  if not coalesce(public.can_modify_hr_employee(target),false) then
   raise exception 'HR_HIERARCHY_FORBIDDEN' using errcode='42501';
  end if;
 end loop;
 return new;
end $$;
create trigger guard_hr_hierarchy before insert or update on public.employees for each row execute function public.guard_hr_hierarchy();
create function public.hr_hierarchy_ready() returns boolean language sql stable as $$ select true $$;
revoke all on function public.hr_hierarchy_ready() from public,anon;
grant execute on function public.hr_hierarchy_ready() to authenticated;
commit;
