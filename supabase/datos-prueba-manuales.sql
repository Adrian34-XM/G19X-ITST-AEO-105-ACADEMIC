-- Completa roles y escenarios de cinco cuentas creadas previamente en Auth. Conserva registros existentes y evita convertir de nuevo en candidato a una persona contratada.
-- Ejecutar en Supabase > SQL Editor DESPUES de crear las cinco
-- cuentas indicadas abajo en Authentication > Users, con correo confirmado.
-- Requiere las migraciones y supabase/seed.sql ya instalados.
-- No crea contrasenas ni cuentas de Authentication.
begin;

do $$
begin
  if (select count(*) from public.profiles where email in (
    'admin@nexo.test','rh@nexo.test','jefe@nexo.test',
    'empleado1@nexo.test','candidato1@nexo.test'
  )) <> 5 then
    raise exception 'Primero crea y confirma las cinco cuentas en Authentication > Users.';
  end if;
  if exists (select 1 from public.employees e join public.profiles p on p.id=e.profile_id
             where p.email='candidato1@nexo.test') then
    raise exception 'El candidato ya es empleado. No se modificaran sus datos.';
  end if;
end $$;

update public.profiles p set role=v.role::public.app_role, full_name=v.name, active=true
from (values
 ('admin@nexo.test','SUPERUSER','Administración Nexo'),
 ('rh@nexo.test','RH_ADMIN','Mariana Torres'),
 ('jefe@nexo.test','JEFE','Diego Herrera'),
 ('empleado1@nexo.test','EMPLEADO','Lucía Martínez'),
 ('candidato1@nexo.test','CANDIDATO','Sofía Ramírez')
) as v(email,role,name) where p.email=v.email;

insert into public.employees(profile_id,position_id)
select id,'20000000-0000-4000-8000-000000000002'::uuid
from public.profiles where email='jefe@nexo.test'
on conflict(profile_id) do nothing;

insert into public.employees(profile_id,position_id,manager_id)
select p.id,'20000000-0000-4000-8000-000000000001'::uuid,e.id
from public.profiles p cross join public.employees e
join public.profiles boss on boss.id=e.profile_id
where p.email='empleado1@nexo.test' and boss.email='jefe@nexo.test'
on conflict(profile_id) do nothing;

insert into public.onboarding(employee_id)
select e.id from public.employees e join public.profiles p on p.id=e.profile_id
where p.email='empleado1@nexo.test' on conflict(employee_id) do nothing;

insert into public.onboarding_items(onboarding_id,title,due_date)
select o.id,'Conocer al equipo y revisar objetivos',current_date+7
from public.onboarding o join public.employees e on e.id=o.employee_id
join public.profiles p on p.id=e.profile_id
where p.email='empleado1@nexo.test' and not exists (
 select 1 from public.onboarding_items i where i.onboarding_id=o.id
 and i.title='Conocer al equipo y revisar objetivos');

insert into public.course_assignments(course_id,employee_id,due_date)
select c.id,e.id,current_date+14 from public.courses c cross join public.employees e
join public.profiles p on p.id=e.profile_id
where c.required and p.email='empleado1@nexo.test'
on conflict(course_id,employee_id) do nothing;

insert into public.tasks(title,description,employee_id,created_by,priority,due_date)
select 'Presentación de prueba','Entrega un documento con tus objetivos de la semana.',
e.id,boss.id,'MEDIUM',current_date+7
from public.employees e join public.profiles p on p.id=e.profile_id
cross join public.profiles boss
where p.email='empleado1@nexo.test' and boss.email='jefe@nexo.test'
and not exists(select 1 from public.tasks t where t.employee_id=e.id and t.title='Presentación de prueba');

insert into public.vacancies(position_id,title,description,requirements,skills,experience_required,status,created_by)
select '20000000-0000-4000-8000-000000000001'::uuid,'Desarrollador Full Stack — prueba',
'Desarrollo de aplicaciones web en el equipo de Tecnología.',
'Conocimientos de React, TypeScript y PostgreSQL.',array['React','TypeScript','PostgreSQL'],1,'PUBLISHED',p.id
from public.profiles p where p.email='rh@nexo.test' and not exists (
 select 1 from public.vacancies where title='Desarrollador Full Stack — prueba' and created_by=p.id);

commit;

select full_name,email,role,active from public.profiles where email in (
 'admin@nexo.test','rh@nexo.test','jefe@nexo.test','empleado1@nexo.test','candidato1@nexo.test'
) order by email;
