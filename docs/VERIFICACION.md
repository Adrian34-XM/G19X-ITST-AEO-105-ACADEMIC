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
