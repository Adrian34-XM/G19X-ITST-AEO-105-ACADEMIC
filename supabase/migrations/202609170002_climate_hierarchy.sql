-- Jerarquía multinivel: todas las políticas que usan manages_employee heredan este alcance.
begin;
create or replace function public.manages_employee(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_hr() or (public.current_role()='JEFE' and exists(
 with recursive team(id) as (
 select e.id from public.employees e join public.employees m on m.id=e.manager_id where m.profile_id=auth.uid() and m.status='ACTIVE'
 union select e.id from public.employees e join team t on e.manager_id=t.id
 ) select 1 from team where id=eid));
$$;

create function public.validate_manager_tree() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(17092026);
 if new.manager_id is null then return new; end if;
 if not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=new.manager_id and e.status='ACTIVE' and p.active and p.role='JEFE') then raise exception 'INVALID_MANAGER' using errcode='22023'; end if;
 if new.manager_id=new.id or exists(
 with recursive ancestors(id,manager_id) as (
 select id,manager_id from public.employees where id=new.manager_id
 union select e.id,e.manager_id from public.employees e join ancestors a on e.id=a.manager_id
 ) select 1 from ancestors where id=new.id) then raise exception 'HIERARCHY_CYCLE' using errcode='22023'; end if;
 return new;
end $$;
create trigger validate_manager_tree before insert or update of manager_id on public.employees for each row execute function public.validate_manager_tree();
create function public.assign_team_manager(employee uuid,manager uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(17092026);
 if not coalesce(public.manages_employee(employee),false) then raise insufficient_privilege; end if;
 if not public.is_hr() and (public.owns_employee(employee) or manager is null or not(public.owns_employee(manager) or public.manages_employee(manager))) then raise insufficient_privilege; end if;
 update public.employees set manager_id=manager where id=employee;
 if not found then raise no_data_found; end if;
end $$;
revoke all on function public.validate_manager_tree(),public.assign_team_manager(uuid,uuid) from public,anon;
grant execute on function public.assign_team_manager(uuid,uuid) to authenticated;

-- Respuestas anónimas: no tienen empleado, perfil ni fecha individual. La participación
-- se registra por separado para impedir duplicados, sin vínculo con la respuesta.
create table public.climate_surveys(
 id uuid primary key default gen_random_uuid(),created_by uuid not null references public.profiles,
 title text not null check(length(title) between 1 and 160),description text not null default '' check(length(description)<=3000),
 questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 3 and 12),
 status text not null default 'DRAFT' check(status in ('DRAFT','OPEN','CLOSED')),
 summary jsonb, model text, created_at timestamptz not null default now()
);
create table public.climate_assignments(survey_id uuid references public.climate_surveys on delete cascade,employee_id uuid references public.employees,primary key(survey_id,employee_id));
create table public.climate_participation(survey_id uuid references public.climate_surveys on delete cascade,employee_id uuid references public.employees,primary key(survey_id,employee_id));
create table public.climate_answers(id uuid primary key default gen_random_uuid(),survey_id uuid not null references public.climate_surveys on delete cascade,ratings jsonb not null,comment text not null default '' check(length(comment)<=3000));
create index on public.climate_answers(survey_id);
alter table public.climate_surveys enable row level security;
alter table public.climate_assignments enable row level security;
alter table public.climate_participation enable row level security;
alter table public.climate_answers enable row level security;
revoke all on public.climate_surveys,public.climate_assignments,public.climate_participation,public.climate_answers from anon,authenticated;
grant select on public.climate_surveys,public.climate_assignments,public.climate_participation to authenticated;
grant all on public.climate_surveys,public.climate_assignments,public.climate_participation,public.climate_answers to service_role;
create function public.manages_climate(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_hr() or (public.current_role()='JEFE' and exists(select 1 from public.climate_surveys where id=sid and created_by=auth.uid()));
$$;
create policy climate_surveys_read on public.climate_surveys for select using(public.manages_climate(id) or (status<>'DRAFT' and exists(select 1 from public.climate_assignments a where a.survey_id=id and public.owns_employee(a.employee_id))));
create policy climate_assignment_read on public.climate_assignments for select using(public.manages_climate(survey_id) or public.owns_employee(employee_id));
-- Nadie puede consultar quién respondió salvo su propio recibo. No hay política para leer respuestas crudas.
create policy climate_participation_own on public.climate_participation for select using(public.owns_employee(employee_id));
revoke all on function public.manages_climate(uuid) from public,anon;
grant execute on function public.manages_climate(uuid) to authenticated;

create function public.climate_command(op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.app_role:=public.current_role(); sid uuid:=nullif(payload->>'id','')::uuid; s public.climate_surveys; eid uuid; q jsonb; recipient uuid; recipients uuid[]; vals jsonb;
begin
 if uid is null or r is null then raise insufficient_privilege; end if;
 if op='save' then
  if r not in ('RH_ADMIN','JEFE') then raise insufficient_privilege; end if;
  if sid is not null then
   select * into s from public.climate_surveys where id=sid for update;
   if not found or not public.manages_climate(sid) then raise insufficient_privilege; end if;
   if s.status<>'DRAFT' then raise exception 'CLIMATE_FROZEN' using errcode='22023'; end if;
  end if;
  if jsonb_typeof(payload->'questions') is distinct from 'array' then raise invalid_parameter_value; end if;
  if jsonb_array_length(payload->'questions') not between 3 and 12 then raise invalid_parameter_value; end if;
  for q in select value from jsonb_array_elements(payload->'questions') loop
   if jsonb_typeof(q)<>'string' or length(q#>>'{}') not between 3 and 400 then raise invalid_parameter_value; end if;
  end loop;
  if sid is null then insert into public.climate_surveys(created_by,title,description,questions) values(uid,payload->>'title',coalesce(payload->>'description',''),payload->'questions') returning id into sid;
  else update public.climate_surveys set title=payload->>'title',description=coalesce(payload->>'description',''),questions=payload->'questions' where id=sid; end if;
 elsif op='publish' then
  select * into s from public.climate_surveys where id=sid for update;
  if not found or not public.manages_climate(sid) then raise insufficient_privilege; end if;
  if s.status<>'DRAFT' then raise exception 'CLIMATE_FROZEN' using errcode='22023'; end if;
  select array_agg(distinct value::uuid) into recipients from jsonb_array_elements_text(payload->'employees');
  if coalesce(array_length(recipients,1),0)<5 then raise exception 'CLIMATE_MINIMUM' using errcode='22023'; end if;
  foreach recipient in array recipients loop
   if not public.manages_employee(recipient) or not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.id=recipient and e.status='ACTIVE' and p.active and p.role in ('JEFE','EMPLEADO')) then raise insufficient_privilege; end if;
   insert into public.climate_assignments values(sid,recipient);
  end loop;
  update public.climate_surveys set status='OPEN' where id=sid;
 elsif op='respond' then
  select * into s from public.climate_surveys where id=sid for update;
  select id into eid from public.employees where profile_id=uid and status='ACTIVE';
  if not found or r not in ('JEFE','EMPLEADO') or s.status is distinct from 'OPEN' or not exists(select 1 from public.climate_assignments where survey_id=sid and employee_id=eid) then raise insufficient_privilege; end if;
  vals=payload->'ratings';
  if jsonb_typeof(vals) is distinct from 'array' then raise invalid_parameter_value; end if;
  if jsonb_array_length(vals)<>jsonb_array_length(s.questions) then raise invalid_parameter_value; end if;
  for q in select value from jsonb_array_elements(vals) loop
   if jsonb_typeof(q)<>'number' or (q#>>'{}')::numeric not in (1,2,3,4,5) then raise invalid_parameter_value; end if;
  end loop;
  insert into public.climate_participation values(sid,eid);
  insert into public.climate_answers(survey_id,ratings,comment) values(sid,vals,coalesce(payload->>'comment',''));
  -- Sin auditoría del envío individual: no registrar autor, comentario ni marca temporal.
  return jsonb_build_object('id',sid);
 elsif op='close' then
  select * into s from public.climate_surveys where id=sid for update;
  if not found or not public.manages_climate(sid) then raise insufficient_privilege; end if;
  if s.status<>'OPEN' then raise exception 'CLIMATE_FROZEN' using errcode='22023'; end if;
  update public.climate_surveys set status='CLOSED' where id=sid;
 else raise invalid_parameter_value;
 end if;
 insert into public.audit_logs(user_id,action,resource_type,resource_id) values(uid,'climate.'||op,'climate_surveys',sid);
 return jsonb_build_object('id',sid);
end $$;
revoke all on function public.climate_command(text,jsonb) from public,anon;
grant execute on function public.climate_command(text,jsonb) to authenticated;

-- Solo el backend puede solicitar agregados. La identidad del actor se verifica de nuevo.
create function public.climate_aggregate(sid uuid,actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.climate_surveys; total int; averages jsonb; comments jsonb;
begin
 select * into s from public.climate_surveys where id=sid;
 if not found or not exists(select 1 from public.profiles where id=actor and active and (role='RH_ADMIN' or (role='JEFE' and s.created_by=actor))) then raise insufficient_privilege; end if;
 if s.status<>'CLOSED' then raise exception 'CLIMATE_CLOSE_FIRST' using errcode='22023'; end if;
 select count(*) into total from public.climate_answers where survey_id=sid;
 if total<5 then raise exception 'CLIMATE_MINIMUM' using errcode='22023'; end if;
 select jsonb_agg(jsonb_build_object('question_index',idx,'average',avg_rating) order by idx) into averages from
 (select item.ordinality as idx,round(avg((item.value#>>'{}')::numeric),2) avg_rating from public.climate_answers a cross join lateral jsonb_array_elements(a.ratings) with ordinality item where a.survey_id=sid group by item.ordinality) grouped;
 select coalesce(jsonb_agg(comment),'[]') into comments from (select comment from public.climate_answers where survey_id=sid and comment<>'' order by id limit 200) c;
 return jsonb_build_object('title',s.title,'questions',s.questions,'response_count',total,'averages',averages,'comments',comments,'summary',s.summary);
end $$;
revoke all on function public.climate_aggregate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.climate_aggregate(uuid,uuid) to service_role;
commit;
