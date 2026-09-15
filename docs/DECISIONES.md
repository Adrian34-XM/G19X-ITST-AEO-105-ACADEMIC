# Decisiones y trazabilidad

La fuente funcional principal es `MVP_Sistema_RRHH_IA.md`; el PRD amplía contexto. Se priorizaron entrevistas y JEFE como P0, mientras que buddy, clima, organigrama y tutor quedan en P1.

- RF-01/02: Supabase Auth en `src/lib/auth`, acceso a rutas en `src/proxy.ts`, schemas de comandos y políticas SQL. Pruebas: `tests/unit.test.ts`, `tests/api.test.ts`, `tests/database.test.ts`.
- RF-03/04: usuarios y roles, áreas/puestos y vacantes mediante formularios y comandos autorizados. La service role solo se utiliza en servidor para Auth Admin y persistencia de resultados IA.
- RF-05/07/11/18: postulación y archivos privados. Extensión, MIME, firma binaria y límite de 5 MB; firma de URL por 60 segundos después de leer el registro con RLS. El texto PDF se extrae hasta 20 páginas y 14.000 caracteres.
- RF-06/19/32: AI Hub, Gemini y Ollama, schemas estrictos, contexto autorizado, timeout y fallback acotado. Tests de transporte con sustitutos solo dentro del proceso de pruebas. No hay modo IA ficticio en la aplicación.
- RF-08/09/31: agenda con exclusión de intervalos de una hora y contratación transaccional. El test inyecta una falla al asignar cursos después del alta y verifica rollback de empleado, rol y postulación.
- RF-10/13/17/20: onboarding, cursos, tareas y desempeño con datos persistentes. La aprobación requiere RH o jefe; una recomendación IA no altera el estado de la tarea.
- RF-29: dashboard y analíticas. Fórmula 60/40; denominador cero produce 0. Las consultas del workspace están limitadas a 1.000 registros por tabla: ampliar paginación y agregación antes de escalar a volúmenes superiores.

Next.js 16 denomina Proxy al antiguo Middleware; se utiliza `src/proxy.ts` conforme a la documentación incluida en la versión instalada. PostgreSQL agrupa orquestación en funciones; no hay microservicios ni broker.

Las pruebas PGlite ejecutan PostgreSQL embebido con un esquema de Auth/Storage de prueba. Verifican SQL y RLS, pero no verifican GoTrue, PostgREST, firma/expiración HTTP de Storage ni un proveedor IA real. Esos puntos necesitan la prueba E2E con Supabase completo.

Los archivos originales permanecen intactos. Las migraciones son reproducibles; no se aplicó SQL al proyecto remoto mediante la clave publicable.
