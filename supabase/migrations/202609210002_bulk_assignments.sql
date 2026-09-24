-- Asignaciones masivas atómicas: una persona fuera del alcance invalida el lote completo.
begin;
create function public.assign_many(kind text,people uuid[],payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare eid uuid; created_count int:=0; skipped_count int:=0; changed int; r public.app_role:=public.current_role();
begin
 if r is null or r not in ('SUPERUSER','RH_ADMIN','JEFE') then raise insufficient_privilege; end if;
 if kind not in ('course','task') or kind is null or people is null or cardinality(people) not between 1 and 100 then raise invalid_parameter_value; end if;
 if (select count(distinct id) from unnest(people) id)<>cardinality(people) then raise invalid_parameter_value; end if;
 if payload->>'due_date' is null then raise invalid_parameter_value; end if;
 perform (payload->>'due_date')::date;
 -- La interfaz no concede permisos; se valida de nuevo cada persona y su cuenta activa.
 foreach eid in array people loop
  if not coalesce(public.manages_employee(eid),false) or not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=eid and e.status='ACTIVE' and p.active and p.role in ('EMPLEADO','JEFE')) then raise insufficient_privilege; end if;
 end loop;
 if kind='course' and not exists(select 1 from public.courses where id=(payload->>'id')::uuid) then raise no_data_found; end if;
 foreach eid in array people loop
  if kind='course' then
   insert into public.course_assignments(course_id,employee_id,due_date) values((payload->>'id')::uuid,eid,(payload->>'due_date')::date) on conflict(course_id,employee_id) do nothing;
   get diagnostics changed=row_count;
   created_count:=created_count+changed; skipped_count:=skipped_count+1-changed;
  else
   -- No acepta id ni employee_id del payload: cada registro nuevo tiene destinatario validado.
   perform public.command('task.save',(payload-'id'-'employee_id')||jsonb_build_object('employee_id',eid));
   created_count:=created_count+1;
  end if;
 end loop;
 return jsonb_build_object('created',created_count,'skipped',skipped_count);
end $$;
revoke all on function public.assign_many(text,uuid[],jsonb) from public,anon;
grant execute on function public.assign_many(text,uuid[],jsonb) to authenticated;
commit;
