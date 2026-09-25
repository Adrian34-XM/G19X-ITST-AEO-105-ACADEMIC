begin;
-- Cada cuenta conserva su propia lectura; abrir el orquestador no marca mensajes.
create table public.task_message_reads (
 user_id uuid not null references public.profiles(id) on delete cascade,
 task_id uuid not null references public.tasks(id) on delete cascade,
 last_sequence bigint not null default 0,
 primary key(user_id,task_id)
);
alter table public.task_message_reads enable row level security;
revoke all on public.task_message_reads from anon,authenticated;
grant select on public.task_message_reads to authenticated;
create policy task_message_reads_own on public.task_message_reads for select using(user_id=auth.uid());
create function public.unread_task_messages() returns table(task_id uuid,title text,unread_count bigint,last_message_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select t.id,t.title,count(*),max(m.created_at)
 from public.task_messages m join public.tasks t on t.id=m.task_id
 left join public.task_message_reads r on r.task_id=t.id and r.user_id=auth.uid()
 where m.author_id<>auth.uid() and m.sequence>coalesce(r.last_sequence,0)
 group by t.id,t.title order by max(m.created_at) desc
$$;
create function public.mark_task_messages_read(task uuid,through_sequence bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.tasks t where t.id=task and public.read_employee(t.employee_id)) then raise insufficient_privilege; end if;
 if not exists(select 1 from public.task_messages where task_id=task and sequence=through_sequence) then raise invalid_parameter_value; end if;
 insert into public.task_message_reads(user_id,task_id,last_sequence) values(auth.uid(),task,through_sequence)
 on conflict(user_id,task_id) do update set last_sequence=greatest(task_message_reads.last_sequence,excluded.last_sequence);
end $$;
revoke all on function public.unread_task_messages() from public,anon;
revoke all on function public.mark_task_messages_read(uuid,bigint) from public,anon;
grant execute on function public.unread_task_messages(),public.mark_task_messages_read(uuid,bigint) to authenticated;
commit;
