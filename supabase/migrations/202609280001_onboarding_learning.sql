-- Lecturas y evaluación de incorporación: claves privadas, intentos sin límite y bloqueo de entrega.
create table public.onboarding_learning (
 item_id uuid primary key references public.onboarding_items on delete cascade,
 material_path text not null, instructions text not null, minimum integer not null check(minimum between 1 and 100),
 questions jsonb not null, created_at timestamptz not null default now()
);
create table public.onboarding_attempts (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references public.onboarding_items on delete cascade,
 user_id uuid not null references public.profiles, score integer not null, passed boolean not null, created_at timestamptz not null default now()
);
alter table public.onboarding_learning enable row level security;
alter table public.onboarding_attempts enable row level security;
revoke all on public.onboarding_learning,public.onboarding_attempts from anon,authenticated;
grant all on public.onboarding_learning,public.onboarding_attempts to service_role;
create function public.onboarding_learning_command(op text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.onboarding_items; eid uuid; config public.onboarding_learning; q jsonb; public_questions jsonb; n integer:=0; hits integer:=0; score integer; passed boolean;
begin
 if auth.uid() is null or public.current_role() is null then raise insufficient_privilege; end if;
 select * into item from public.onboarding_items where id=(payload->>'id')::uuid for update;
 if not found then raise no_data_found; end if;
 select employee_id into eid from public.onboarding where id=item.onboarding_id;
 if not (public.owns_employee(eid) or public.is_hr() or (public.current_role()='JEFE' and public.manages_employee(eid))) then raise insufficient_privilege; end if;
 select * into config from public.onboarding_learning where item_id=item.id;
 if op='read' then
  if config.item_id is null then return '{}'::jsonb; end if;
  select jsonb_agg(value-'correct' order by ord) into public_questions from jsonb_array_elements(config.questions) with ordinality t(value,ord);
  return jsonb_build_object('material_path',config.material_path,'instructions',config.instructions,'minimum',config.minimum,'questions',public_questions,'attempts',coalesce((select jsonb_agg(jsonb_build_object('score',a.score,'passed',a.passed,'created_at',a.created_at) order by a.created_at desc) from public.onboarding_attempts a where a.item_id=item.id),'[]'::jsonb));
 elsif op='save' then
  if split_part(payload->>'material_path','/',1) is distinct from auth.uid()::text or length(trim(coalesce(payload->>'instructions',''))) not between 1 and 2000 then raise invalid_parameter_value; end if;
  if not (public.is_hr() or (public.current_role()='JEFE' and public.manages_employee(eid) and not public.owns_employee(eid))) then raise insufficient_privilege; end if;
  if item.owner_role<>'EMPLOYEE' or item.status not in ('PENDING','IN_PROGRESS') or exists(select 1 from public.onboarding_attempts where item_id=item.id) then raise exception 'LEARNING_LOCKED'; end if;
  if jsonb_typeof(payload->'questions')<>'array' or jsonb_array_length(payload->'questions') not between 1 and 20 then raise invalid_parameter_value; end if;
  for q in select value from jsonb_array_elements(payload->'questions') loop
   if length(trim(q->>'question')) not between 3 and 400 or jsonb_array_length(q->'options') not between 2 and 6 or (q->>'correct')::integer not between 0 and jsonb_array_length(q->'options')-1 then raise invalid_parameter_value; end if;
  end loop;
  insert into public.onboarding_learning(item_id,material_path,instructions,minimum,questions) values(item.id,payload->>'material_path',payload->>'instructions',(payload->>'minimum')::integer,payload->'questions') on conflict(item_id) do update set material_path=excluded.material_path,instructions=excluded.instructions,minimum=excluded.minimum,questions=excluded.questions;
  return jsonb_build_object('ok',true);
 elsif op='attempt' then
  if not public.owns_employee(eid) or item.owner_role<>'EMPLOYEE' or item.status not in ('PENDING','IN_PROGRESS') or config.item_id is null then raise insufficient_privilege; end if;
  if jsonb_typeof(payload->'answers')<>'array' or jsonb_array_length(payload->'answers')<>jsonb_array_length(config.questions) then raise invalid_parameter_value; end if;
  for q in select value from jsonb_array_elements(config.questions) loop
   if (payload->'answers'->>n)::integer not between 0 and jsonb_array_length(q->'options')-1 then raise invalid_parameter_value; end if;
   if (payload->'answers'->>n)::integer=(q->>'correct')::integer then hits:=hits+1; end if; n:=n+1;
  end loop;
  score:=floor(hits*100.0/n); passed:=score>=config.minimum;
  insert into public.onboarding_attempts(item_id,user_id,score,passed) values(item.id,auth.uid(),score,passed);
  return jsonb_build_object('score',score,'passed',passed);
 end if;
 raise invalid_parameter_value;
end $$;
revoke all on function public.onboarding_learning_command(text,jsonb) from public,anon;
grant execute on function public.onboarding_learning_command(text,jsonb) to authenticated;
create function public.guard_onboarding_learning() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('SUBMITTED','COMPLETED') and old.status is distinct from new.status and exists(select 1 from public.onboarding_learning where item_id=new.id) and not exists(select 1 from public.onboarding_attempts where item_id=new.id and passed) then raise exception 'LEARNING_REQUIRED' using errcode='22023'; end if;
 return new;
end $$;
create trigger onboarding_learning_guard before update on public.onboarding_items for each row execute function public.guard_onboarding_learning();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('onboarding-learning','onboarding-learning',false,5242880,array['application/pdf','image/png','image/jpeg','text/plain']) on conflict(id) do nothing;
