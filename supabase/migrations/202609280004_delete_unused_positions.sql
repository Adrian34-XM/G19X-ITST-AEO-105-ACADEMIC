-- El bloqueo de la fila y las claves foráneas protegen también frente a asignaciones concurrentes.
create or replace function public.delete_unused_position(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_role() is null or public.current_role() not in ('RH_ADMIN','SUPERUSER') then raise insufficient_privilege; end if;
 perform 1 from public.positions where id=target for update;
 if not found then raise no_data_found; end if;
 if exists(select 1 from public.employees where position_id=target) then raise exception 'POSITION_ASSIGNED' using errcode='23503'; end if;
 -- Sin CASCADE: conserva cualquier vacante, curso o plantilla que todavía lo utilice.
 delete from public.positions where id=target;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.delete_unused_position(uuid) from public,anon;
grant execute on function public.delete_unused_position(uuid) to authenticated;
