-- Gestión de áreas para RH y superadministrador. No depende del formato de command.
create or replace function public.save_department(target uuid, title text) returns jsonb language plpgsql security definer set search_path='' as $body$
declare result_id uuid;
begin
 if auth.uid() is null or public.current_role() is null or public.current_role() not in ('RH_ADMIN','SUPERUSER') then raise insufficient_privilege; end if;
 if title is null or length(trim(title)) not between 1 and 150 then raise invalid_parameter_value; end if;
 if target is null then
  insert into public.departments(name) values(trim(title)) returning id into result_id;
 else
  update public.departments set name=trim(title) where id=target returning id into result_id;
  if result_id is null then raise no_data_found; end if;
 end if;
 return jsonb_build_object('id',result_id);
end $body$;
revoke all on function public.save_department(uuid,text) from public,anon;
grant execute on function public.save_department(uuid,text) to authenticated;

-- El bloqueo de la fila y las claves foráneas protegen también frente a asignaciones concurrentes.
create or replace function public.delete_unused_department(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_role() is null or public.current_role() not in ('RH_ADMIN','SUPERUSER') then raise insufficient_privilege; end if;
 perform 1 from public.departments where id=target for update;
 if not found then raise no_data_found; end if;
 if exists(select 1 from public.positions where department_id=target) then raise exception 'DEPARTMENT_IN_USE' using errcode='23503'; end if;
 -- Sin CASCADE: conserva cualquier vacante, curso o plantilla que todavía lo utilice.
 delete from public.departments where id=target;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.delete_unused_department(uuid) from public,anon;
grant execute on function public.delete_unused_department(uuid) to authenticated;
