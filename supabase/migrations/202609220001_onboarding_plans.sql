-- Planes de incorporación, responsables y revisión documental con permisos en PostgreSQL.
begin;
create table public.onboarding_templates (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 160),
 position_id uuid references public.positions, department_id uuid references public.departments,
 steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 30),
 active boolean not null default true, created_at timestamptz not null default now()
);
create unique index onboarding_template_scope on public.onboarding_templates(coalesce(position_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(department_id,'00000000-0000-0000-0000-000000000000'::uuid)) where active;
alter table public.onboarding_templates enable row level security;
create policy templates_read on public.onboarding_templates for select using(public.is_hr() or public.current_role()='JEFE');
grant select on public.onboarding_templates to authenticated;
alter table public.onboarding add column template_id uuid references public.onboarding_templates;
alter table public.onboarding_items add column description text not null default '', add column owner_role text not null default 'EMPLOYEE' check(owner_role in ('EMPLOYEE','MANAGER','HR')), add column requires_document boolean not null default false;
alter table public.onboarding_documents add column status text not null default 'SUBMITTED' check(status in ('SUBMITTED','APPROVED','REJECTED')), add column comments text not null default '', add column reviewed_by uuid references public.profiles, add column reviewed_at timestamptz;

create function public.onboarding_steps_valid(steps jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 30 and not exists(
 select 1 from jsonb_array_elements(steps) s where coalesce(length(trim(s->>'title')),0) not between 1 and 160 or coalesce(s->>'owner_role','') not in ('EMPLOYEE','MANAGER','HR') or coalesce((s->>'days')::int,-1) not between 0 and 365 or coalesce(length(s->>'description'),0)>2000 or jsonb_typeof(s->'requires_document') is distinct from 'boolean');
$$;
alter table public.onboarding_templates add constraint valid_steps check(public.onboarding_steps_valid(steps));

-- Bloquea la vía antigua de completar pasos cuando falta documentación o responsabilidad.
create function public.guard_onboarding_step() returns trigger language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 select employee_id into eid from public.onboarding where id=new.onboarding_id for update;
 if new.status='COMPLETED' and old.status<>'COMPLETED' then
  if not (public.is_hr() or (new.owner_role='EMPLOYEE' and public.owns_employee(eid)) or (new.owner_role='MANAGER' and public.manages_employee(eid))) then raise insufficient_privilege; end if;
  if new.requires_document and not exists(select 1 from public.onboarding_documents where onboarding_id=new.onboarding_id and status='APPROVED') then raise exception 'DOCUMENT_REQUIRED' using errcode='22023'; end if;
 end if;
 return new;
end $$;
create trigger onboarding_step_guard before update on public.onboarding_items for each row execute function public.guard_onboarding_step();

create function public.onboarding_command(op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid; eid uuid; tid uuid; s jsonb; steps jsonb; base date; item public.onboarding_items; d public.onboarding_documents;
begin
 if public.current_role() is null then raise insufficient_privilege; end if;
 if op='template.save' then
  if not public.is_hr() then raise insufficient_privilege; end if;
  if not public.onboarding_steps_valid(payload->'steps') then raise invalid_parameter_value; end if;
  if nullif(payload->>'position_id','') is not null and nullif(payload->>'department_id','') is not null and not exists(select 1 from public.positions where id=(payload->>'position_id')::uuid and department_id=(payload->>'department_id')::uuid) then raise invalid_parameter_value; end if;
  insert into public.onboarding_templates(title,position_id,department_id,steps) values(payload->>'title',nullif(payload->>'position_id','')::uuid,nullif(payload->>'department_id','')::uuid,payload->'steps') returning id into tid;
  return jsonb_build_object('id',tid);
 elsif op='template.disable' then
  if not public.is_hr() then raise insufficient_privilege; end if;
  update public.onboarding_templates set active=false where id=(payload->>'id')::uuid;
  return '{}';
 end if;
 if op='document.review' then
  if not public.is_hr() then raise insufficient_privilege; end if;
  select * into d from public.onboarding_documents where id=(payload->>'id')::uuid for update;
  if not found then raise no_data_found; end if;
  if payload->>'status' not in ('APPROVED','REJECTED') or length(trim(coalesce(payload->>'comments','')))=0 then raise invalid_parameter_value; end if;
  if d.status<>'SUBMITTED' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  update public.onboarding_documents set status=payload->>'status',comments=payload->>'comments',reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
  return '{}';
 end if;
 if op in ('item.save','item.complete') then
  select * into item from public.onboarding_items where id=(payload->>'id')::uuid;
  oid:=item.onboarding_id;
 else oid:=(payload->>'id')::uuid; end if;
 select employee_id into eid from public.onboarding where id=oid for update;
 if eid is null then raise no_data_found; end if;
 if op='item.complete' then
  if not coalesce(public.read_employee(eid),false) then raise insufficient_privilege; end if;
  update public.onboarding_items set status='COMPLETED',completed_at=now() where id=item.id and status<>'COMPLETED';
 elsif op='item.save' then
  if not coalesce(public.manages_employee(eid),false) or item.status='COMPLETED' then raise insufficient_privilege; end if;
  if payload->>'due_date' is null then raise invalid_parameter_value; end if;
  update public.onboarding_items set due_date=(payload->>'due_date')::date,owner_role=payload->>'owner_role' where id=item.id;
 elsif op='plan.apply' then
  if not coalesce(public.manages_employee(eid),false) then raise insufficient_privilege; end if;
  -- No reemplaza un plan que ya recibió entregas o tiene progreso.
  if exists(select 1 from public.onboarding_items where onboarding_id=oid and status<>'PENDING') or exists(select 1 from public.onboarding_documents where onboarding_id=oid) then raise exception 'PLAN_STARTED' using errcode='22023'; end if;
  tid:=nullif(payload->>'template_id','')::uuid;
  if tid is not null then select t.steps into steps from public.onboarding_templates t where t.id=tid and active; else steps:=payload->'steps'; end if;
  if steps is null or not public.onboarding_steps_valid(steps) then raise invalid_parameter_value; end if;
  base:=(payload->>'start_date')::date;
  if base is null then raise invalid_parameter_value; end if;
  delete from public.onboarding_items where onboarding_id=oid;
  for s in select * from jsonb_array_elements(steps) loop
   insert into public.onboarding_items(onboarding_id,title,description,owner_role,requires_document,due_date) values(oid,s->>'title',coalesce(s->>'description',''),s->>'owner_role',(s->>'requires_document')::boolean,base+(s->>'days')::int);
  end loop;
  update public.onboarding set template_id=tid where id=oid;
 else raise invalid_parameter_value; end if;
 update public.onboarding set status=case when not exists(select 1 from public.onboarding_items where onboarding_id=oid and status<>'COMPLETED') then 'COMPLETED' when exists(select 1 from public.onboarding_items where onboarding_id=oid and status='COMPLETED') then 'IN_PROGRESS' else 'PENDING' end where id=oid;
 return jsonb_build_object('id',oid);
end $$;
revoke all on function public.onboarding_command(text,jsonb) from public,anon;
grant execute on function public.onboarding_command(text,jsonb) to authenticated;

-- La contratación elige primero el puesto y después el área; si no hay plantilla conserva el plan básico.
create function public.initialize_onboarding(oid uuid) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid; eid uuid;
begin
 select employee_id into eid from public.onboarding where id=oid;
 select t.id into tid from public.onboarding_templates t join public.employees e on e.id=eid join public.positions p on p.id=e.position_id where t.active and (t.position_id=e.position_id or (t.position_id is null and (t.department_id=p.department_id or t.department_id is null))) order by (t.position_id is not null) desc,(t.department_id is not null) desc,t.created_at desc limit 1;
 if tid is not null then perform public.onboarding_command('plan.apply',jsonb_build_object('id',oid,'template_id',tid,'start_date',current_date));
 else insert into public.onboarding_items(onboarding_id,title,due_date) select oid,title,current_date+7 from unnest(array['Entregar documentación','Conocer al equipo','Leer reglamento','Configurar herramientas']) title; end if;
end $$;
revoke all on function public.initialize_onboarding(uuid) from public,anon,authenticated;
do $patch$ declare definition text; old_fragment text := 'insert into public.onboarding_items(onboarding_id,title,due_date) select oid,title,current_date+7 from unnest(array[''Entregar documentación'',''Conocer al equipo'',''Leer reglamento'',''Configurar herramientas'']) title;';
begin
 select pg_get_functiondef('public.command(text,jsonb)'::regprocedure) into definition;
 if position(old_fragment in definition)=0 then raise exception 'No se encontró el bloque de contratación'; end if;
 definition:=replace(definition,old_fragment,'perform public.initialize_onboarding(oid);');
 execute definition;
end $patch$;
create trigger audit after insert or update or delete on public.onboarding_templates for each row execute function public.audit_change();
commit;
