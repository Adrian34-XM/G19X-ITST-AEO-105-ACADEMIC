-- Habilita únicamente el catálogo de puestos para RH. No cambia asignaciones ni jerarquías.
do $$
declare f record; source text; needle text := E'when ''position.save'' then\n if r<>''SUPERUSER'' then raise insufficient_privilege; end if;'; changed integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' loop
  source:=pg_get_functiondef(f.oid);
  if position(needle in source)>0 then
   execute replace(source,needle,E'when ''position.save'' then\n if r not in (''SUPERUSER'',''RH_ADMIN'') then raise insufficient_privilege; end if;');
   changed:=changed+1;
  end if;
 end loop;
 if changed=0 and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prosrc like '%when ''position.save'' then%if r not in (''SUPERUSER'',''RH_ADMIN'')%') then
  raise exception 'No se encontró la operación position.save. Aplica primero las migraciones base.';
 end if;
end $$;
