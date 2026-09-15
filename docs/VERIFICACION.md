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
