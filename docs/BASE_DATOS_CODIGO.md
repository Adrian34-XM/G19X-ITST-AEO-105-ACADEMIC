# Base de datos y migraciones de Nexo

## Responsabilidad de PostgreSQL

Las rutas de Next.js validan identidad, origen y estructura de la solicitud. PostgreSQL vuelve a comprobar quién puede ejecutar cada operación y qué registros puede modificar. Las funciones RPC concentran escrituras relacionadas para que una excepción revierta la transacción. RLS significa seguridad por fila: filtra filas según la sesión y las políticas de cada tabla.

El cliente de sesión conserva estas políticas. El cliente administrativo puede saltarlas, por lo que solo debe utilizarse después de autorizar la operación. Las funciones `security definer` ejecutan con privilegios de su propietario: deben mantener comprobaciones explícitas de identidad, rol y pertenencia, además de referencias de esquema seguras.

## Relaciones principales

- `auth.users` identifica la cuenta; `profiles` conserva el rol y acceso activo. Un perfil no equivale automáticamente a un empleado.
- `departments` agrupa `positions`; `employees` relaciona perfil, puesto y jefe mediante `manager_id`. El jefe también es un empleado, permitiendo varios niveles.
- `candidates` y `vacancies` se vinculan mediante `applications`. La pareja candidato/vacante no se duplica. Las entrevistas pertenecen a postulaciones.
- `onboarding` pertenece a un empleado; `onboarding_items` contiene actividades. Documentos, materiales e intentos de evaluación tienen permisos derivados de esa actividad.
- `courses` es el catálogo; `course_assignments` registra asignación y progreso de una persona; `course_evidence` respalda avances.
- `tasks` contiene tareas asignadas; evidencias, mensajes y recibos de lectura dependen de la tarea y de sus permisos.
- `climate_surveys` y sus asignaciones definen destinatarios. Participación y respuestas anónimas se registran por separado. Los comentarios usan un mecanismo separado de recibos.
- `ai_requests`, `ai_results` y `orchestration_runs` registran ejecuciones de IA. Su resultado no es una instrucción ejecutable de negocio.
- `audit_logs` registra cambios permitidos para consulta exclusiva de superadministración. No debe convertirse en una copia de CV, contraseñas o comentarios privados.

Las tablas iniciales `surveys`, `survey_questions` y `survey_responses` no deben confundirse con el flujo posterior de ambiente laboral basado en `climate_*`. Consultar las rutas actuales antes de integrar una nueva pantalla.

## Orden y propósito de las migraciones

Los nombres ordenan las dependencias. Una migración posterior presupone tablas y funciones anteriores; ejecutarla aisladamente sobre una base vacía puede producir errores de relación inexistente. No editar una migración ya aplicada para introducir cambios funcionales: añadir otra que transforme el esquema existente.

1. **202609140001_foundation.sql**: esquema inicial, roles, tablas, relaciones, funciones de acceso, RLS y auditoría.
2. **202609140002_commands.sql**: comandos transaccionales de negocio y operaciones iniciales de IA.
3. **202609140003_storage.sql**: depósitos privados y políticas para documentos.
4. **202609140004_hardening.sql**: endurecimiento de operaciones, privilegios y reglas de consistencia.
5. **202609140005_public_vacancies.sql**: consulta pública limitada a vacantes publicadas.
6. **202609150001_fix_ai_evidence_alias.sql**: elimina una ambigüedad de alias en el análisis de evidencias.
7. **202609170001_orchestration_audit.sql**: ejecuciones del orquestador, límites de solicitudes y acceso exclusivo a auditoría.
8. **202609170002_climate_hierarchy.sql**: encuestas, comentarios y jerarquía de equipos con permisos asociados.
9. **202609210001_hr_operations.sql**: amplía operaciones de RH y restricciones de entrevistas.
10. **202609210002_bulk_assignments.sql**: asignación múltiple mediante `assign_many`, con validación del conjunto.
11. **202609220001_onboarding_plans.sql**: plantillas y planes de incorporación con responsables y plazos.
12. **202609230001_workforce_reviews.sql**: revisión humana e historiales de procesos laborales.
13. **202609230002_climate_recipients.sql**: destinatarios de encuestas y control de participación.
14. **202609230003_course_evidence.sql**: evidencias privadas para respaldar avances de capacitación.
15. **202609230004_interviews_hiring.sql**: agenda, conflictos y opciones de puesto y jefe al contratar.
16. **202609240001_hr_hierarchy.sql**: protección de la jerarquía de RH frente a ediciones no autorizadas.
17. **202609240002_audit_details.sql**: amplía datos útiles de auditoría conservando exclusiones de información sensible.
18. **202609250001_hiring_assignment.sql**: asignación pendiente de puesto, área y jefe después de contratar.
19. **202609250002_task_conversations.sql**: conversaciones de tareas con control de acceso y envío.
20. **202609250003_task_message_notifications.sql**: recibos de lectura y conteos de mensajes pendientes.
21. **202609250004_training_progress_reviews.sql**: aceptación, rechazo y porcentaje validado de capacitación.
22. **202609280001_onboarding_learning.sql**: materiales y evaluación de actividades con intentos y calificación mínima.
23. **202609280002_optional_onboarding_quiz.sql**: evaluación opcional para permitir actividades de solo lectura.
24. **202609280003_hr_positions.sql**: gestión de puestos por RH además del superusuario.
25. **202609280004_delete_unused_positions.sql**: eliminación de puestos sin referencias que la impidan.
26. **202609280005_hr_departments.sql**: gestión de áreas con operaciones específicas y comprobaciones de dependencias.
27. **202609280006_working_days.sql**: valida días hábiles en tareas y entrevistas según el calendario codificado.
28. **202609280007_hiring_working_day.sql**: mueve el vencimiento generado al contratar al siguiente día hábil. Las fechas manuales inválidas siguen rechazándose.

Algunas migraciones actualizan funciones anteriores mediante `pg_get_functiondef` y sustituciones de fragmentos. Dependen de la definición previa: un error de “operación no encontrada” debe diagnosticarse revisando la cadena aplicada, no eliminando la comprobación. La migración 28 detecta tanto el fragmento original como el ya actualizado.

## Escrituras que requieren especial cuidado

**Contratación.** Cambia la situación del candidato y crea registros de empleado e incorporación en una transacción. No simular contratación cambiando directamente la etiqueta de una postulación.

**Jerarquía.** Asignar superior exige impedir ciclos y respetar las restricciones sobre integrantes de RH. Una comprobación visual no evita que alguien llame directamente a una RPC.

**Capacitación.** El porcentaje declarado y el validado tienen significados distintos. El rechazo conserva observaciones y exige nueva evidencia posterior cuando corresponde. Solo el responsable autorizado confirma la finalización.

**Incorporación.** Una evaluación requerida debe estar aprobada antes de enviar o completar la actividad. Los intentos se califican en servidor; no enviar soluciones correctas al colaborador. Los documentos se revisan por separado.

**Archivos.** Storage y SQL no forman una única transacción. Ante un fallo puede requerirse compensación o limpieza del objeto; conservar esta distinción al ampliar cargas múltiples.

**Anonimato.** Separar recibos y respuestas evita una relación directa desde la aplicación, pero no garantiza anonimato absoluto frente a operadores de infraestructura o textos donde la persona se identifica. No añadir autores a las respuestas para facilitar un reporte.

## Archivos SQL auxiliares

- `supabase/seed.sql`: catálogo inicial de demostración; revisar duplicados antes de repetirlo.
- `supabase/datos-prueba-manuales.sql`: preparación de datos para cuentas previamente creadas.
- `supabase/instalar-proyecto.sql`: instalación consolidada inicial; no sustituye todas las migraciones posteriores.
- `supabase/activar-mejoras-rh.sql`: agrupador de mejoras con comprobaciones de dependencias; revisar qué incluye antes de ejecutarlo.
- `supabase/diagnosticar-instalacion.sql`: apoyo para identificar piezas del esquema instalado.
- `supabase/config.toml`: configuración del entorno local de Supabase.

No ejecutar un instalador inicial o `supabase db reset` sobre datos que deban conservarse. La existencia del archivo en Git no demuestra que se haya aplicado al proyecto de Supabase utilizado por `.env.local`.

## Comprobación y mantenimiento

`tests/database.test.ts` ejecuta migraciones con PGlite y un entorno simulado de Auth/Storage. Las pruebas especializadas comprueban eliminación de catálogos, calendario, activación y evaluaciones. PGlite permite verificar SQL y permisos de esos casos, pero no certifica servicios remotos, correo, Storage real ni todos los recorridos de navegador.

Al añadir una operación: definir contrato Zod, comprobar permisos de fila en SQL, limitar privilegios de la función, actualizar auditoría cuando corresponda y probar un caso autorizado y otro denegado. Documentar estados y relaciones nuevas en este archivo y enlazar la ruta en [MAPA_CODIGO.md](MAPA_CODIGO.md).
