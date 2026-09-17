-- Corrige el alias SQL que impedía iniciar análisis de evidencias. Detecta la versión esperada antes de reemplazar el fragmento y admite volver a ejecutarse.
-- Corrige la colision entre la variable PL/pgSQL t y el alias de tasks.
-- Ejecutar completo en Supabase > SQL Editor. Conserva permisos y datos.
do $migration$
declare
  definition text;
  old_fragment text := 'select 1 from public.task_evidence e join public.tasks t on t.id=e.task_id where e.id=rid and public.manages_employee(e.employee_id) and t.status=''SUBMITTED''';
  new_fragment text := 'select 1 from public.task_evidence evidence_row join public.tasks task_row on task_row.id=evidence_row.task_id where evidence_row.id=rid and public.manages_employee(evidence_row.employee_id) and task_row.status=''SUBMITTED''';
begin
  select pg_get_functiondef('public.command(text,jsonb)'::regprocedure) into definition;
  if strpos(definition, old_fragment) > 0 then
    execute replace(definition, old_fragment, new_fragment);
  elsif strpos(definition, new_fragment) = 0 then
    raise exception 'La funcion command tiene otra version; no se modifico.';
  end if;
end
$migration$;
