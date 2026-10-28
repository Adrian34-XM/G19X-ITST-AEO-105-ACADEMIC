-- Las notas de entrevista son internas de RH. El candidato lee sus entrevistas (fecha, estado),
-- pero no las notas: se guardan en una tabla privada y la columna original queda vacía y falla cerrado.
-- Las escrituras de command no cambian: un disparador traslada las notas al guardar.
begin;

-- La referencia se comprueba al confirmar: así el alta puede guardar la nota antes de insertar la entrevista.
create table public.interview_notes (
 interview_id uuid primary key references public.interviews(id) on delete cascade deferrable initially deferred,
 notes text not null check (length(notes) between 1 and 4000),
 updated_at timestamptz not null default now()
);
alter table public.interview_notes enable row level security;
revoke all on public.interview_notes from public, anon, authenticated;
grant select on public.interview_notes to authenticated;
grant all on public.interview_notes to service_role;
create policy interview_notes_read on public.interview_notes for select using (public.is_hr());

insert into public.interview_notes(interview_id,notes)
 select id,left(notes,4000) from public.interviews where btrim(notes)<>'';
update public.interviews set notes='' where notes<>'';

-- Se ejecuta en el alta y solo cuando la actualización incluye la columna notes (interview.save).
-- Cancelar o completar sin enviar notas no borra las existentes; enviar texto vacío sí las elimina.
create or replace function public.store_interview_notes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if btrim(coalesce(new.notes,''))='' then
  if tg_op='UPDATE' then delete from public.interview_notes where interview_id=new.id; end if;
 else
  insert into public.interview_notes(interview_id,notes) values(new.id,left(new.notes,4000))
   on conflict(interview_id) do update set notes=excluded.notes,updated_at=now();
 end if;
 new.notes:='';
 return new;
end $$;
revoke all on function public.store_interview_notes() from public, anon, authenticated;
create trigger interview_notes_private before insert or update of notes on public.interviews
 for each row execute function public.store_interview_notes();
alter table public.interviews add constraint interview_notes_private check (notes='');

commit;
