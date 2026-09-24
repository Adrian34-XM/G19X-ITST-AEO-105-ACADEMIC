# Verificación — 14 de septiembre de 2026

## Comprobación posterior a instalar el SQL remoto

**Última comprobación:** `npm run test:supabase` terminó con código 0 después de aplicar la corrección. Auth, vacantes, puestos y áreas responden HTTP 200; perfiles, postulaciones, empleados, tareas y cursos rechazan el acceso anónimo con HTTP 401 / 42501. Esto confirma disponibilidad pública y denegación anónima, no el recorrido autenticado completo ni la IA.

Las tablas ya están disponibles. Auth, áreas y puestos responden HTTP 200. Las tablas privadas rechazan correctamente el acceso anónimo con HTTP 401 / 42501. Se detectó un error en `vacancies_read`: su consulta de postulaciones privadas también se evaluaba como anon. La migración `202609140005_public_vacancies.sql` separa la política pública de la autenticada sin conceder acceso a postulaciones. Está probada localmente (30 pruebas aprobadas), pero pendiente de aplicar en el proyecto remoto. Los resultados previos siguientes describen el estado anterior a la instalación.

- `npm test`: 29 pruebas aprobadas, 4 archivos. Incluye permisos, cálculos, schemas, archivos, contratos API/IA y migraciones/RLS/transacciones sobre PostgreSQL embebido.
- `npm run typecheck`: aprobado con la configuración actual.
- `npm run lint`: aprobado, sin errores ni advertencias.
- `npm run build`: aprobado con `.env.local` y la clave publicable del proyecto remoto.
- Navegador: acceso y navegación al registro revisados; sin desbordamiento horizontal en viewport móvil. No se ha ejecutado un login real ni el dashboard con datos remotos.
- `npm run test:supabase`: Auth HTTP 200. `profiles`, `vacancies`, `applications`, `employees`, `tasks` y `courses`: HTTP 404 / PGRST205. Las tablas no están disponibles en el esquema expuesto al momento de la prueba.
- E2E integral: bloqueado por migraciones, cuentas demo y configuración de IA pendientes en el proyecto remoto. No se cuenta una prueba omitida como aprobada.
- Docker/Supabase local: no fue posible iniciar el motor Docker; no se verificó el build del contenedor.

Se configuraron exclusivamente la URL y la clave publicable facilitadas por el usuario en `.env.local`, archivo excluido del control de versiones. La dependencia Supabase ya estaba instalada. El servidor y Proxy aceptan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y mantienen compatibilidad con `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Para completar: aplicar migraciones en orden, cargar datos demo en el proyecto de pruebas y configurar el proveedor de IA. La clave publicable no permite migraciones ni operaciones Auth Admin. El MVP no cumple todavía la definición de terminado hasta verificar ese recorrido.
# Actualización del 17 de septiembre de 2026

- 53 pruebas locales aprobadas: incluyen cancelación y edición de entrevistas, liberación de horarios, onboarding y evidencias con aislamiento, auditoría exclusiva, orquestación y filtrado de contexto por rol.
- Se comprobó en el navegador la vista general de RH, el árbol de Diego Herrera con su integrante, las gráficas circular y de barras, el cambio de proceso y el filtro de área sin resultados.
- Peticiones reales al servidor local: RH y jefe reciben 403 en `/api/audit`; las páginas de entrevistas, onboarding, tareas y desempeño responden 200 para los roles probados.
- Las pruebas de orquestación simulan el proveedor: comprueban guardado, fallo controlado y eliminación de referencias no autorizadas. No demuestran disponibilidad de Gemini.
- La base remota todavía no tiene `orchestration_runs` (PGRST205 al comprobar). Aplicar `supabase/migrations/202609170001_orchestration_audit.sql` para activar persistencia, cuotas, catálogo y restricción RLS de auditoría. Mientras tanto, la aplicación bloquea la auditoría de RH en rutas y carga de datos, pero la política remota previa solo cambia al aplicar la migración.


## 21 de septiembre: operaciones RH y formularios

- 70 pruebas aprobadas en 11 archivos. Incluyen PostgreSQL embebido con todas las migraciones, el archivo de activación ejecutado dos veces, permisos del superadministrador, alta del rol RH, doble entrevista del mismo candidato entre vacantes, documentos privados, anonimato y umbral de encuestas, jerarquía multinivel y rechazo de ciclos.
- Pruebas de IA con proveedor simulado: borrador de vacante revisable, documento de referencia, rechazo de PDF falso, permisos, filtrado de contexto, instrucciones generadas y manejo de errores sin revelar detalles internos.
- TypeScript y ESLint sin errores. Compilación de producción comprobada.
- Navegador local: edición y vista previa de encuestas por tarjetas; selección de fecha de calendario que completa el formulario de entrevista; filtros por área vacía y persona contratada; visualización de gráficas por proceso.
- Supabase remoto muestra que falta la migración de ambiente laboral. No se aplicaron migraciones remotas desde esta sesión. El archivo supabase/activar-mejoras-rh.sql queda listo para SQL Editor; véase ACTIVAR_MEJORAS_RH.md.
- No se hicieron llamadas reales al proveedor de IA para certificar su disponibilidad ni se modificaron credenciales de usuarios.


## Asignaciones múltiples y organigrama visual

74 pruebas aprobadas en 11 archivos; TypeScript, ESLint y compilación correctos. PostgreSQL verifica lotes por jerarquía, rechazo sin cambios parciales, duplicados e inactivos. Las pruebas del árbol cubren ancestros de otra área, aislamiento, vistas vacías y ciclos. En navegador se comprobó selección de varias personas, quitar una, búsqueda sin acentos conservando seleccionados, organigrama inicial y área sin integrantes.

La migración nueva es 202609210002_bulk_assignments.sql y está incluida en activar-mejoras-rh.sql. No se aplicó a Supabase remoto desde esta sesión.

## 22 de septiembre: planes de onboarding

- Plantillas por puesto y área, selección automática al contratar, borrador manual o de IA revisable, responsables por función y fechas ajustables.
- Documentos privados con revisión RH y correcciones; bloqueos de completar actividades ajenas, requisitos documentales y protección de planes iniciados comprobados en PostgreSQL.
- 81 pruebas locales aprobadas en 13 archivos. IA probada con proveedor simulado, no se afirma una ejecución real del proveedor.
- Nueva migración `202609220001_onboarding_plans.sql`, incluida también en el activador repetible. Pendiente de aplicación/verificación en Supabase remoto.
- Uso y límites en `docs/ONBOARDING.md`.
