begin;
create table public.task_messages (
 id uuid primary key, sequence bigint generated always as identity unique,
 task_id uuid not null references public.tasks(id) on delete cascade,
 author_id uuid not null references public.profiles(id), author_name text not null,
 author_role public.app_role not null, body text not null check(length(trim(body)) between 1 and 3000),
 created_at timestamptz not null default now()
);
create index task_messages_history on public.task_messages(task_id,sequence desc);
alter table public.task_messages enable row level security;
revoke all on public.task_messages from anon,authenticated;
grant select on public.task_messages to authenticated;
grant all on public.task_messages to service_role;
create policy task_messages_read on public.task_messages for select using (
 exists(select 1 from public.tasks t where t.id=task_id and public.read_employee(t.employee_id))
);
-- Autor y permisos se obtienen de la sesión; los mensajes no se editan ni eliminan desde el cliente.
create function public.send_task_message(task uuid,message text,message_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.tasks; p public.profiles; existing public.task_messages;
begin
 select * into p from public.profiles where id=auth.uid() and active;
 if not found or p.role not in ('SUPERUSER','RH_ADMIN','JEFE','EMPLEADO') then raise insufficient_privilege; end if;
 select * into t from public.tasks where id=task for update;
 if not found or not coalesce(public.read_employee(t.employee_id),false) then raise insufficient_privilege; end if;
 if message is null or length(trim(message)) not between 1 and 3000 then raise invalid_parameter_value; end if;
 select * into existing from public.task_messages where id=message_id;
 if found then
  if existing.task_id=task and existing.author_id=p.id and existing.body=trim(message) then return existing.id; end if;
  raise exception 'MESSAGE_CONFLICT' using errcode='22023';
 end if;
 if t.status='APPROVED' then raise exception 'TASK_CHAT_CLOSED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext(p.id::text));
 if (select count(*) from public.task_messages where author_id=p.id and created_at>now()-interval '1 minute')>=30 then raise exception 'RATE_LIMIT'; end if;
 insert into public.task_messages(id,task_id,author_id,author_name,author_role,body) values(message_id,task,p.id,p.full_name,p.role,trim(message));
 return message_id;
end $$;
revoke all on function public.send_task_message(uuid,text,uuid) from public,anon;
grant execute on function public.send_task_message(uuid,text,uuid) to authenticated;
commit;
