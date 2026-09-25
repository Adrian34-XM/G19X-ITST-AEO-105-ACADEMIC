-- Solo consulta: no crea, modifica ni elimina datos.
select current_database() as base,
 to_regclass('public.profiles') is not null as perfiles,
 to_regclass('public.employees') is not null as empleados,
 to_regclass('public.audit_logs') is not null as auditoria,
 to_regclass('public.courses') is not null as cursos,
 to_regprocedure('public.command(text,jsonb)') is not null as comandos;

select tablename from pg_tables where schemaname='public' order by tablename;
