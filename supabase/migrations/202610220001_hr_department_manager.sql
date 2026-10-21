begin;

-- El área de Recursos Humanos debe estar disponible en toda instalación.
insert into public.departments(name)
select 'Recursos Humanos'
where not exists (
  select 1 from public.departments where lower(btrim(name)) = 'recursos humanos'
);

-- El encargado pertenece al área; asignarlo o quitarlo no cambia su puesto ni su perfil.
alter table public.departments
  add column if not exists manager_employee_id uuid references public.employees(id) on delete set null;

create or replace function public.save_department(target uuid, title text)
returns jsonb language plpgsql security definer set search_path = '' as $body$
declare result_id uuid; previous_name text; normalized_title text := lower(btrim(title));
begin
  if auth.uid() is null or public.current_role() is null or public.current_role() not in ('RH_ADMIN','SUPERUSER') then
    raise insufficient_privilege;
  end if;
  if title is null or length(btrim(title)) not between 1 and 150 then raise invalid_parameter_value; end if;

  if target is not null then
    select name into previous_name from public.departments where id=target for update;
    if not found then raise no_data_found; end if;
    if lower(btrim(previous_name))='recursos humanos' and public.current_role()<>'SUPERUSER' then raise insufficient_privilege; end if;
  end if;

  if normalized_title='recursos humanos' then
    select id into result_id from public.departments
      where lower(btrim(name))='recursos humanos' and id is distinct from target limit 1;
    if target is null and result_id is not null then return jsonb_build_object('id',result_id); end if;
    if public.current_role()<>'SUPERUSER' then raise insufficient_privilege; end if;
    if result_id is not null then raise unique_violation; end if;
  end if;

  if target is null then
    insert into public.departments(name) values(btrim(title)) returning id into result_id;
  else
    update public.departments set name=btrim(title) where id=target returning id into result_id;
  end if;
  return jsonb_build_object('id',result_id);
end $body$;

create or replace function public.delete_unused_department(target uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare department_name text;
begin
  if auth.uid() is null or public.current_role() is null or public.current_role() not in ('RH_ADMIN','SUPERUSER') then
    raise insufficient_privilege;
  end if;
  select name into department_name from public.departments where id=target for update;
  if not found then raise no_data_found; end if;
  if lower(btrim(department_name))='recursos humanos' and public.current_role()<>'SUPERUSER' then raise insufficient_privilege; end if;
  if exists(select 1 from public.positions where department_id=target) then raise exception 'DEPARTMENT_IN_USE' using errcode='23503'; end if;
  delete from public.departments where id=target;
  return jsonb_build_object('ok',true);
end $$;

create function public.save_department_manager(target_department uuid, target_employee uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare department_name text;
begin
  if auth.uid() is null or public.current_role() is distinct from 'SUPERUSER' then raise insufficient_privilege; end if;
  select name into department_name from public.departments where id=target_department for update;
  if not found or lower(btrim(department_name))<>'recursos humanos' then raise no_data_found; end if;
  if target_employee is not null and not exists (
    select 1 from public.employees e join public.profiles p on p.id=e.profile_id
    where e.id=target_employee and e.status='ACTIVE' and p.active and p.role in ('RH_ADMIN','JEFE')
  ) then raise exception 'INVALID_DEPARTMENT_MANAGER' using errcode='22023'; end if;
  update public.departments set manager_employee_id=target_employee where id=target_department;
  return jsonb_build_object('ok',true,'employee_id',target_employee);
end $$;

revoke all on function public.save_department_manager(uuid,uuid) from public,anon;
grant execute on function public.save_department_manager(uuid,uuid) to authenticated;

commit;
