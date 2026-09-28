-- Semana laboral definida por la plataforma: lunes a viernes, zona Ciudad de México.
create or replace function public.mx_working_day(d date) returns boolean language sql immutable set search_path='' as $$
 select d is null or (extract(isodow from d)<6
 and to_char(d,'MM-DD') not in ('01-01','05-01','09-16','12-25')
 and not (extract(isodow from d)=1 and ((extract(month from d)=2 and extract(day from d)<=7) or (extract(month from d) in (3,11) and extract(day from d) between 15 and 21)))
 and not (extract(year from d)>=2024 and mod(extract(year from d)::int-2024,6)=0 and to_char(d,'MM-DD')='10-01'));
$$;
create or replace function public.guard_working_day() returns trigger language plpgsql set search_path='' as $$
declare d date;
begin
 if TG_TABLE_NAME='interviews' then
  if new.status<>'SCHEDULED' then return new; end if;
  if TG_OP='UPDATE' then if old.scheduled_at=new.scheduled_at and old.status=new.status then return new; end if; end if;
  d:=(new.scheduled_at at time zone 'America/Mexico_City')::date;
 else
  if TG_OP='UPDATE' then if old.due_date is not distinct from new.due_date then return new; end if; end if;
  d:=new.due_date;
 end if;
 if not public.mx_working_day(d) then raise exception 'Selecciona un día hábil: lunes a viernes sin descanso obligatorio de México.' using errcode='22023'; end if;
 return new;
end $$;
drop trigger if exists working_day_guard on public.tasks;
create trigger working_day_guard before insert or update on public.tasks for each row execute function public.guard_working_day();
drop trigger if exists working_day_guard on public.interviews;
create trigger working_day_guard before insert or update on public.interviews for each row execute function public.guard_working_day();
