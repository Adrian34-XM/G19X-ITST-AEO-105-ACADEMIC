begin;
-- Los plazos generados al contratar se mueven al siguiente día hábil.
-- Las fechas elegidas manualmente continúan rechazándose, sin cambios silenciosos.
create or replace function public.next_working_day(d date) returns date
language plpgsql immutable set search_path='' as $$
begin
 if d is null then return null; end if;
 while not public.mx_working_day(d) loop d:=d+1; end loop;
 return d;
end $$;
do $patch$
declare f record; definition text; found_source boolean := false;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f' and p.proname like '%command%'
 loop
  definition:=pg_get_functiondef(f.oid);
  if position('eid,uid,current_date+7)' in definition)>0 then
   execute replace(definition,'eid,uid,current_date+7)','eid,uid,public.next_working_day(current_date+7))');
   found_source:=true;
  elsif position('eid,uid,public.next_working_day(current_date+7))' in definition)>0 then
   found_source:=true;
  end if;
 end loop;
 if not found_source then raise exception 'No se encontró la creación de la tarea de bienvenida. Revisa las migraciones anteriores.'; end if;
end $patch$;
commit;
