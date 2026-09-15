insert into public.departments(id,name) values
('10000000-0000-4000-8000-000000000001','Tecnología'),('10000000-0000-4000-8000-000000000002','Personas'),('10000000-0000-4000-8000-000000000003','Operaciones');
insert into public.positions(id,name,department_id) values
('20000000-0000-4000-8000-000000000001','Desarrollador Full Stack','10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000002','Líder de ingeniería','10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000003','Analista de talento','10000000-0000-4000-8000-000000000002'),
('20000000-0000-4000-8000-000000000004','Analista de operaciones','10000000-0000-4000-8000-000000000003'),
('20000000-0000-4000-8000-000000000005','Diseñador de producto','10000000-0000-4000-8000-000000000001');
insert into public.courses(title,description,content,duration_minutes,required) values
('Bienvenida al equipo','Conoce nuestra forma de trabajar.','Trabajamos con objetivos semanales, documentación compartida y revisión entre pares. Agenda una presentación con tu equipo y revisa los objetivos de tu puesto.',20,true),
('Seguridad de la información','Protege los datos de las personas.','Usa contraseñas únicas y MFA. Comparte documentos únicamente por canales autorizados. Reporta mensajes sospechosos. Nunca incluyas secretos en documentos, tickets o herramientas de IA.',30,true),
('Comunicación efectiva','Comunica decisiones con claridad.','Explica el contexto, la decisión y los siguientes pasos. Escucha antes de responder y registra los acuerdos.',25,false),
('Gestión del tiempo','Prioriza y entrega valor.','Define resultados concretos, divide tareas y comunica bloqueos de forma temprana.',20,false),
('Calidad de entregables','Revisa y documenta tu trabajo.','Verifica criterios de aceptación. Adjunta evidencia reproducible y solicita revisión humana.',35,false);
