-- El alta inicial de una cuenta RH en el organigrama sigue reservada al superusuario cuando
-- existe una sesión de usuario. Sin sesión (SQL Editor, seed o clave de servicio) no hay rol
-- que comprobar y el guardia bloqueaba los scripts de instalación y datos de prueba.
create or replace function public.guard_hr_hierarchy() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if tg_op='INSERT' then
  if auth.uid() is not null
   and exists(select 1 from public.profiles where id=new.profile_id and role='RH_ADMIN')
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
