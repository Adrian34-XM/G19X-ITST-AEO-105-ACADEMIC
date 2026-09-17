-- Ajusta la lectura pública de vacantes y sus relaciones para permitir consultar oportunidades sin iniciar sesión.
-- Separa la visibilidad anónima de las políticas que consultan tablas privadas.
-- No concede acceso anónimo a postulaciones ni datos de candidatos.
alter policy vacancies_read on public.vacancies to authenticated;
drop policy if exists vacancies_public_read on public.vacancies;
create policy vacancies_public_read on public.vacancies
for select to anon using (status = 'PUBLISHED');
