# Guía del código en español

## Paneles operativos y orquestación por rol

`src/modules/workspace/insights.ts` calcula alertas sin usar IA y recorta los datos por empleado o equipo directo. Las tareas ya entregadas para revisión no cuentan como atrasos del empleado; se muestran como revisiones pendientes. Las fechas límite se comparan con la fecha UTC del día. Los datos se actualizan al navegar o recargar la página; no son notificaciones por correo ni un servicio de mensajería.

`src/components/operations-panels.tsx` muestra novedades, recomendaciones, jerarquías, gráficas y auditoría. RH ve todas sus áreas; un jefe ve su jerarquía subordinada y sus propios registros. El árbol también controla ciclos para no bloquear la pantalla si existen relaciones incorrectas. Las gráficas permiten cambiar proceso, área, periodo y representación en barras o circular.

`/api/ai/orchestrate` coordina las recomendaciones de vista general, capacitación, tareas, desempeño y analíticas. Obtiene datos con la sesión, minimiza los campos enviados y reserva una ejecución en PostgreSQL. Las recomendaciones de cursos relacionan el puesto y área con el catálogo y las asignaciones. El resultado se valida, se eliminan identificadores no autorizados y se guarda en `orchestration_runs`. Solo la cuenta que inició la solicitud puede leerla; no se asignan cursos ni se modifican estados automáticamente. La pantalla muestra la respuesta de la ejecución actual; el histórico permanece en la base.

La migración `202609170001_orchestration_audit.sql` es necesaria para activar este flujo. Limita a tres ejecuciones por minuto y una pendiente reciente por usuario. Abre la lectura del catálogo formativo a cuentas internas activas, conservando los permisos de asignación y progreso. Restringe `audit_logs` a SUPERUSER y añade metadatos de campos modificados, estados anterior/nuevo y rol del actor sin copiar documentos ni claves. Las rutas y la navegación también rechazan la auditoría para RH.

Las recomendaciones de IA requieren un proveedor disponible. Si falla, se conserva el funcionamiento de alertas y gráficas, se registra el fracaso y se informa al usuario. Los análisis se limitan a 200 registros por tabla y los paneles a 1000; no representan una auditoría exhaustiva de volúmenes superiores.

## Cómo recorrer el proyecto

Empieza por `src/app/[[...path]]/page.tsx`: decide qué página mostrar, exige sesión en las áreas privadas y carga datos mediante `src/modules/workspace/queries.ts`. Después pasa a `src/components/workspace.tsx`, que organiza la navegación y las acciones de cada rol.

Los componentes del navegador muestran información y envían peticiones. No tienen claves privadas. Las rutas en `src/app/api` validan las peticiones y llaman a Supabase o al proveedor de IA desde el servidor.

## Autenticación y permisos

`src/proxy.ts` renueva cookies y protege la navegación. `src/lib/auth/index.ts` vuelve a verificar la identidad en las operaciones de servidor y comprueba que el perfil esté activo. No basta con esconder un botón: la API valida roles y PostgreSQL valida permisos sobre los registros.

`src/lib/permissions/index.ts` contiene los roles y destinos:

- `SUPERUSER`: administración de cuentas, áreas, puestos, auditoría y todas las operaciones de RH.
- `RH_ADMIN`: reclutamiento y gestión de personas.
- `JEFE`: seguimiento del equipo, tareas y evidencias autorizadas.
- `EMPLEADO`: tareas, cursos y onboarding propios.
- `CANDIDATO`: perfil, oportunidades y postulaciones propias.

`db()` conserva la sesión del usuario y sus políticas RLS. `adminDb()` utiliza la clave privada y puede superar esas políticas: por eso se reserva para operaciones administrativas previamente autorizadas. Las claves van en `.env.local`, excluido de Git; quien tenga acceso a ese archivo puede leerlas.

## Formularios y operaciones

`src/modules/workspace/forms.ts` describe campos y opciones. `src/components/forms.tsx` dibuja los formularios y transforma números, listas, fechas y casillas antes de enviar datos. `src/modules/commands/schemas.ts` los valida de nuevo con Zod en el servidor.

Una escritura habitual sigue este recorrido:

1. El usuario envía un formulario.
2. `/api/commands` valida origen, sesión, nombre de operación y estructura del contenido.
3. La función SQL `command` comprueba rol, pertenencia y estado del registro.
4. PostgreSQL guarda los cambios de esa llamada en una transacción.
5. La interfaz actualiza los datos con `router.refresh()`.

`src/app/api/[...segments]/route.ts` ofrece rutas REST por recurso reutilizando esos controles. La creación administrativa de usuarios es especial: primero crea la cuenta en Auth y después asigna el rol; si falla la asignación, intenta compensarla eliminando la cuenta recién creada. No es una transacción conjunta entre Auth y PostgreSQL.

## Vacantes, postulaciones y recomendaciones

Una vacante describe requisitos, habilidades y experiencia. Cada postulación conecta un candidato con una vacante; la restricción única impide duplicar esa pareja. Las transiciones permitidas se controlan también en SQL. Contratar es una operación específica que genera los registros de incorporación; no basta con cambiar una etiqueta en la interfaz.

`src/components/recruitment-recommendations.tsx` permite seleccionar una vacante y comparar postulaciones activas. Valida cada resultado guardado con el esquema de recomendación, ordena por puntuación y deja las pendientes al final. Excluye contratados y rechazados. Una puntuación no representa una probabilidad de éxito y no provoca decisiones automáticas.

## Análisis de IA

`/api/ai/recruitment` compara una postulación con su vacante; `/api/ai/evidence` compara la evidencia con la tarea. Ambos reciben el identificador del registro, no un documento arbitrario ni una clave del proveedor.

La ruta autoriza el recurso y carga el contexto desde la base. Si ya hay un resultado, lo devuelve sin consumir nuevamente el proveedor. Si no, registra `ai.begin`, genera el análisis y lo guarda con `finish_ai`. Este último solo admite el cliente administrativo. La migración de endurecimiento invalida las recomendaciones de postulaciones al actualizar habilidades, experiencia o texto del CV del candidato, y requisitos, habilidades, experiencia, descripción o título de la vacante. Las evidencias tienen su propio resultado guardado; estos disparadores no invalidan sus análisis.

`src/lib/ai/provider.ts` implementa Gemini y Ollama. Tiene un límite de 45 segundos por llamada, solicita JSON y comprueba la respuesta con los esquemas de `src/lib/ai/schemas.ts`. El respaldo a Ollama requiere `AI_FALLBACK=true` y un servicio local operativo. Los nombres de modelos pueden cambiar: configurar un nombre no garantiza que la cuenta pueda utilizarlo.

La base limita solicitudes y evita análisis simultáneos recientes del mismo recurso. Si falla el proveedor o la persistencia, la ruta intenta marcar la solicitud como fallida. No sustituye un error por un resultado ficticio. El texto extraído y, cuando corresponde, el archivo se envían al proveedor configurado; para pruebas se deben usar datos ficticios.

## Documentos privados

`src/lib/storage/files.ts` acepta archivos de 1 byte a 5 MB. Los CV admiten PDF y TXT; otros documentos admiten también PNG y JPEG. Comprueba extensión, MIME y cabeceras. Extrae hasta 20 páginas de PDF y limita el texto a 14000 caracteres. Un archivo con cabecera válida no queda certificado como seguro por un antivirus.

`/api/files` comprueba la propiedad, sube el archivo a Storage y registra su relación con el recurso. Las dos escrituras no son atómicas: si falla la asociación SQL puede quedar un objeto sin referencia. Las descargas pasan por autorización y generan enlaces firmados de 60 segundos. Quien tenga un enlace válido puede utilizarlo durante ese periodo.

PDF.js se mantiene fuera del empaquetado de Next.js mediante `serverExternalPackages`, para que pueda resolver su trabajador correctamente.

## Base de datos y migraciones

Aplicar los archivos de `supabase/migrations` en orden de nombre:

1. `202609140001_foundation.sql`: tablas, relaciones, funciones auxiliares, RLS y auditoría.
2. `202609140002_commands.sql`: operaciones de negocio y persistencia de IA.
3. `202609140003_storage.sql`: depósitos y políticas de documentos privados.
4. `202609140004_hardening.sql`: ajustes de permisos y restricciones.
5. `202609140005_public_vacancies.sql`: lectura pública de vacantes.
6. `202609150001_fix_ai_evidence_alias.sql`: corrige una colisión entre variable y alias SQL.

`seed.sql` añade áreas, puestos y cursos; no es una actualización idempotente. `datos-prueba-manuales.sql` prepara cinco cuentas creadas previamente en Auth. `instalar-proyecto.sql` es un instalador consolidado inicial, no el sustituto de todas las migraciones posteriores. No ejecutar un instalador o un reinicio de base sobre datos que deban conservarse.

## Indicadores y límites

`src/modules/performance/service.ts` combina un 60 % de tareas aprobadas con un 40 % de cursos completados. Si una categoría está vacía, su porcentaje vale cero. Es una fórmula de seguimiento, no un juicio automatizado sobre una persona.

La carga de pantalla limita cada tabla a 1000 filas. Listados, contadores y recomendaciones dependen de ese conjunto; antes de aumentar el volumen, implementar paginación y agregaciones en servidor.

## Scripts y comprobaciones

- `scripts/setup-local.mjs`: crea configuración desde Supabase local sin sobrescribir `.env.local`.
- `scripts/seed.mjs`: crea datos de demostración con permisos administrativos; requiere habilitar explícitamente el uso remoto.
- `scripts/check-supabase.mjs`: verifica conectividad y restricciones anónimas, sin escribir datos.
- `scripts/test-uploads.mjs`: crea documentos y una tarea de prueba; conserva esos registros para inspección.
- `tests/`: reglas, API simulada, proveedores simulados, recomendaciones renderizadas y PostgreSQL embebido con PGlite.
- `e2e/core.spec.ts`: recorrido de navegador; los casos con servicios reales requieren sus variables y pueden omitirse cuando faltan.

Ejecutar desde la raíz:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

Estas comprobaciones no consumen Gemini ni demuestran que el servicio remoto esté disponible. `npm.cmd run test:supabase` comprueba la conexión configurada. Las pruebas de subida y de navegador con cuentas reales sí pueden crear datos.

## Configuración y archivos generados

`package.json` define dependencias y comandos; `package-lock.json` fija las versiones resueltas. `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts` y `playwright.config.ts` configuran compilación, estilos y pruebas. Dockerfile y compose.yaml describen los servicios para contenedores.

No modificar manualmente `node_modules`, `.next`, `next-env.d.ts` ni los archivos de bloqueo para añadir explicaciones: son dependencias, salidas o archivos administrados por herramientas. Los nombres de API, tablas y variables permanecen en su forma original para no romper contratos; las explicaciones están en español.


## Mejoras de operaciones RH del 21 de septiembre

El superadministrador hereda los permisos de RH a través de isHR, requireRole y public.is_hr(), conservando su rol para auditoría. La migración 202609210001_hr_operations.sql amplía los controles de las funciones SQL existentes y añade el bloqueo de una segunda entrevista pendiente por candidato. El bloqueo usa una transacción y se aplica también entre distintas vacantes.

InterviewCalendar abre el formulario con la fecha local elegida. VacancyAssistant solicita un borrador validado a /api/ai/vacancy; no escribe vacantes automáticamente. VacancyDocuments administra documentos privados mediante /api/vacancy-documents, con políticas de Storage y comprobación de rol en el servidor.

filterWorkspace relaciona áreas, puestos, empleados, tareas y onboarding. Se aplica tras scopeData tanto en la interfaz como en el contexto del servidor. En analíticas también limita proceso y fecha de creación. OperationsPanel envía los filtros y permite generar instrucciones revisables. El servidor vuelve a comprobar identificadores y reduce desempeño y analíticas a campos estructurados antes de invocar al proveedor.

WorkplaceClimate separa edición, vista previa, publicación y respuesta. Las tarjetas se reordenan antes de publicar; después quedan congeladas. Las respuestas anónimas y los recibos de participación se guardan por separado. El resumen solo se permite con encuesta cerrada y cinco respuestas. La jerarquía multinivel se aplica desde la migración 202609170002_climate_hierarchy.sql.

La [guía de activación](ACTIVAR_MEJORAS_RH.md) explica el archivo SQL agrupado y los límites del proveedor remoto.


## Asignación múltiple y organigrama

EmployeePicker conserva la selección entre filtros de búsqueda y área; BulkAssignment sirve tanto para cursos como para nuevas tareas. /api/assignments valida un contrato estricto y llama a assign_many, que comprueba todos los destinatarios antes de escribir en una sola transacción. Los cursos existentes se omiten y las tareas se crean individualmente mediante command.

organization construye raíces y conserva ancestros autorizados al filtrar por área. TeamTree representa tarjetas conectadas y ramas plegables; EmployeeProfile utiliza el conjunto ya restringido por scopeData/RLS. El filtro employees se valida también en /api/ai/orchestrate antes de generar recomendaciones.

## Orquestador de la vista general (22 de septiembre)

La vista general solicita automáticamente un resumen por usuario y rol. El servidor reúne estados, fechas, totales, señales de atraso y registros recientes de los módulos visibles: reclutamiento, entrevistas, equipo, incorporación, tareas, evidencias (sin contenido), capacitación y encuestas (solo estado y fecha). La auditoría se incorpora únicamente para superadministración y excluye los registros del propio orquestador.

El resumen y sus recomendaciones aparecen antes de las notificaciones. El botón Actualizar resumen vuelve a consultar datos del servidor. Las sugerencias no ejecutan acciones ni decisiones laborales.

Se guarda una huella del contexto autorizado junto al resultado en orchestration_runs. Si usuario, rol, datos y fecha siguen iguales, se reutiliza el resumen sin llamar al proveedor. No se guarda en localStorage. La respuesta no afirma conocer cambios anteriores: usa el estado actual y registros con fecha reciente (siete días), con límites de 200 filas por módulo y 100 señales. Sin datos de ambiente laboral disponibles, declara esa limitación al modelo.

Requiere la migración existente de orquestación y el proveedor configurado en el servidor. Los fallos se muestran sin impedir consultar las alertas normales. Las pruebas de IA usan proveedor simulado; no certifican la disponibilidad del proveedor remoto.

## Filtros por módulo

- Vista general: tipo de notificación (filtra las tarjetas, no el resumen general del orquestador).
- Vacantes: estado, puesto, área para RH, búsqueda y fecha de registro.
- Postulaciones: secciones por estado, vacante, búsqueda, área para RH y fechas de postulación.
- Entrevistas: estado, área para RH, búsqueda por candidato y rango de fechas de agenda.
- Equipo: estado, puesto, nombre y área para RH; el organigrama conserva ancestros autorizados como contexto.
- Onboarding: estado, persona, búsqueda, área para RH y fecha de registro.
- Tareas: estado, prioridad, atraso, fechas límite y selección de personas. Los aprobados conservan su historial.
- Capacitación: curso obligatorio/opcional, estado de asignación, persona, área para RH y fecha de registro.
- Desempeño y analíticas: mantienen los filtros de persona, área autorizada, proceso y periodo existentes.
- Usuarios: rol, acceso activo/inactivo, búsqueda y fechas.
- Puestos y áreas: búsqueda; puestos admite área para RH.
- Auditoría: búsqueda por acción o recurso y rango de fechas; acceso exclusivo de superadministración.
- Ambiente laboral: búsqueda por título y estado de encuesta.

Los filtros trabajan sobre las filas autorizadas cargadas; no sustituyen RLS ni amplían acceso. Las vistas individuales y el perfil personal no necesitan los filtros de listado. Se reinician al cambiar de ruta; Limpiar filtros restaura el listado del módulo. Las fechas usan los valores guardados por el sistema. El límite existente de carga es 1.000 registros por tabla; no se añadió paginación remota en este cambio.
