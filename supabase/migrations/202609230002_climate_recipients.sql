-- Permite publicar encuestas desde una persona sin alterar la jerarquía ni el anonimato.
begin;
do $$ declare definition text;
begin
 select pg_get_functiondef('public.climate_command(text,jsonb)'::regprocedure) into definition;
 definition := replace(definition,
  'coalesce(array_length(recipients,1),0)<5',
  'coalesce(array_length(recipients,1),0)<1');
 definition := replace(definition, 'CLIMATE_MINIMUM', 'CLIMATE_RECIPIENT_REQUIRED');
 execute definition;
end $$;
commit;
