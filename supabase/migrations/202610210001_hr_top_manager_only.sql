begin;

-- Solo la persona RH ubicada más arriba en la cadena puede editar datos laborales de otro RH.
-- La administración general conserva la capacidad de crear inicialmente cuentas RH,
-- pero no puede modificar su puesto, estado o relación jerárquica una vez incorporadas.
create or replace function public.can_modify_hr_employee(eid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.current_role()='RH_ADMIN' and exists (
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
  where highest.profile_id=auth.uid()
    and highest.status='ACTIVE'
    and highest.active
 );
$$;

revoke all on function public.can_modify_hr_employee(uuid) from public,anon;
grant execute on function public.can_modify_hr_employee(uuid) to authenticated;

create or replace function public.hr_hierarchy_version() returns integer
language sql immutable as $$ select 2 $$;
revoke all on function public.hr_hierarchy_version() from public,anon;
grant execute on function public.hr_hierarchy_version() to authenticated;

commit;
