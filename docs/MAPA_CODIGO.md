# Mapa del código de Nexo

Este índice explica los archivos propios del sistema. Complementa [la guía de funcionamiento](CODIGO.md); los comentarios junto al código describen responsabilidades y límites. Las dependencias instaladas y los archivos generados no se documentan modificándolos.

## src/app

### [src/app/[[...path]]/page.tsx](../src/app/[[...path]]/page.tsx)

Entrada de páginas públicas y espacios privados. Resuelve la ruta, obtiene identidad y datos de la sesión y entrega el contexto al componente Workspace; los recursos privados no se cargan con la clave administrativa.

Entradas exportadas: `dynamic`, `Page`.

### [src/app/api/[...segments]/route.ts](../src/app/api/[...segments]/route.ts)

Adaptador REST de recursos de negocio. Resuelve operaciones permitidas y aplica validación de origen, sesión y contrato antes de delegar las reglas transaccionales a PostgreSQL.

Entradas exportadas: `GET`, `POST`, `PATCH`, `DELETE`.

### [src/app/api/admin/users/route.ts](../src/app/api/admin/users/route.ts)

Alta administrativa de cuentas con privilegios de superusuario. La creación en Auth y la asignación de perfil no son una sola transacción; contempla compensación si falla el paso posterior.

Entradas exportadas: `POST`.

### [src/app/api/ai/[useCase]/route.ts](../src/app/api/ai/[useCase]/route.ts)

Análisis de postulaciones o evidencias desde identificadores autorizados. Reserva una ejecución, valida la salida y persiste resultados; los errores no se sustituyen por evaluaciones inventadas.

Entradas exportadas: `POST`.

### [src/app/api/ai/orchestrate/route.ts](../src/app/api/ai/orchestrate/route.ts)

Coordina resúmenes y recomendaciones por módulo con contexto autorizado y minimizado. Reutiliza resultados cuando procede y registra ejecuciones; las recomendaciones no ejecutan cambios de negocio.

Entradas exportadas: `POST`.

### [src/app/api/ai/vacancy/route.ts](../src/app/api/ai/vacancy/route.ts)

Genera propuestas estructuradas de vacantes con contexto permitido. Devuelve un borrador revisable, no una publicación automática.

Entradas exportadas: `POST`.

### [src/app/api/ai/workforce/route.ts](../src/app/api/ai/workforce/route.ts)

Análisis de desempeño, analíticas, perfiles y borradores formativos con filtros autorizados. Restringe procesos y calcula cifras en código para que las gráficas no dependan de números inventados por el modelo.

Entradas exportadas: `POST`.

### [src/app/api/assignments/route.ts](../src/app/api/assignments/route.ts)

Asignación múltiple validada de tareas y cursos. La RPC comprueba destinatarios y permisos dentro de la transacción para impedir asignaciones parciales no autorizadas.

Entradas exportadas: `POST`.

### [src/app/api/auth/[action]/route.ts](../src/app/api/auth/[action]/route.ts)

Acceso, registro y cierre de sesión mediante Supabase Auth. Traduce fallos a respuestas públicas y administra cookies a través del cliente de servidor.

Entradas exportadas: `POST`.

### [src/app/api/climate/route.ts](../src/app/api/climate/route.ts)

Encuestas y comentarios de clima con operaciones diferenciadas por rol. Los análisis respetan las condiciones de cierre y participación; la información individual no debe reconstruirse desde resultados agregados.

Entradas exportadas: `GET`, `POST`.

### [src/app/api/commands/route.ts](../src/app/api/commands/route.ts)

Entrada de comandos de negocio con contrato estricto. Comprueba los requisitos de las operaciones y conserva la sesión al invocar SQL; nunca acepta SQL arbitrario del cliente.

Entradas exportadas: `POST`.

### [src/app/api/employee-assignment/route.ts](../src/app/api/employee-assignment/route.ts)

Completa puesto, área y jefe después de la contratación. RH y superusuario envían identificadores; SQL comprueba coherencia entre puesto y área y validez del superior.

Entradas exportadas: `POST`.

### [src/app/api/files/route.ts](../src/app/api/files/route.ts)

Subida y descarga autorizada de documentos privados. Limita el multipart y valida archivos antes de Storage; la asociación SQL y el objeto no comparten una transacción de base de datos.

Entradas exportadas: `POST`, `GET`.

### [src/app/api/onboarding-learning/route.ts](../src/app/api/onboarding-learning/route.ts)

Materiales, evaluación e intentos de incorporación. Solo responsables autorizados configuran contenido; las respuestas se califican en SQL y el colaborador no recibe la clave de respuestas correctas.

Entradas exportadas: `GET`, `POST`.

### [src/app/api/onboarding-plans/route.ts](../src/app/api/onboarding-plans/route.ts)

Consulta de plantillas y comandos de incorporación, incluido el borrador de IA. Distingue operaciones de colaborador y gestión; SQL protege avances existentes y requisitos de revisión.

Entradas exportadas: `GET`, `POST`.

### [src/app/api/task-messages/route.ts](../src/app/api/task-messages/route.ts)

Lectura, envío y confirmación de lectura de conversaciones de tareas. Usa secuencias para paginar y recibos propios; las RPC comprueban acceso y límites de publicación.

Entradas exportadas: `GET`, `POST`, `PATCH`.

### [src/app/api/teams/route.ts](../src/app/api/teams/route.ts)

Asignación de jefe directo mediante una RPC que comprueba jerarquía y ciclos. Exige el esquema actualizado de protección de RH antes de aceptar cambios.

Entradas exportadas: `POST`.

### [src/app/api/training/route.ts](../src/app/api/training/route.ts)

Consulta de evidencias y generación de recursos u opinión de capacitación. La IA no modifica porcentajes ni aprueba cursos; la revisión de una evidencia exige acceso al colaborador.

Entradas exportadas: `GET`, `POST`, `PATCH`.

### [src/app/api/vacancy-documents/route.ts](../src/app/api/vacancy-documents/route.ts)

Operaciones de adjuntos de vacantes con sesión, rol y validación de archivo. Devuelve acceso temporal de descarga sin hacer público el depósito de documentos.

Entradas exportadas: `GET`, `POST`.

### [src/app/error.tsx](../src/app/error.tsx)

Límite de errores de la interfaz con opción de reintentar. Evita exponer al usuario detalles internos de excepciones del servidor.

Entradas exportadas: `ErrorPage`.

### [src/app/globals.css](../src/app/globals.css)

Estilos compartidos del sistema: navegación, formularios, tarjetas, calendarios, organigrama y paneles adaptables. Las clases de estado y prioridad acompañan etiquetas textuales para que el color no sea la única señal.

### [src/app/layout.tsx](../src/app/layout.tsx)

Estructura HTML compartida, metadatos y estilos globales. Mantiene el marco común de todas las rutas sin concentrar aquí las reglas de autorización de cada módulo.

Entradas exportadas: `metadata`, `RootLayout`.

### [src/app/loading.tsx](../src/app/loading.tsx)

Estado visual transitorio durante la carga de rutas. No representa ausencia de datos ni un error de autenticación.

Entradas exportadas: `Loading`.

## src/components

### [src/components/application-summary.tsx](../src/components/application-summary.tsx)

Presentación resumida de postulaciones y sus estados. Usa las etiquetas y los registros disponibles para facilitar el seguimiento de reclutamiento.

Entradas exportadas: `rankApplications`, `recommendedApplications`, `ApplicationSummary`.

### [src/components/auth-form.tsx](../src/components/auth-form.tsx)

Formulario de acceso y registro que envía credenciales a las rutas de autenticación. Gestiona el estado de envío y los errores sin incorporar claves administrativas al navegador.

Entradas exportadas: `AuthForm`.

### [src/components/bulk-assignment.tsx](../src/components/bulk-assignment.tsx)

Diálogo de asignación múltiple de tareas o cursos. Muestra personas seleccionadas, controla el envío y comunica el resultado; la función SQL valida el conjunto antes de escribir.

Entradas exportadas: `BulkAssignment`.

### [src/components/climate-results.tsx](../src/components/climate-results.tsx)

Muestra participación, resultados agregados y análisis de gráficas de encuestas. Mantiene separados los datos de participación y el contenido anónimo de respuestas.

Entradas exportadas: `ClimateResults`, `AnonymousComment`.

### [src/components/employee-picker.tsx](../src/components/employee-picker.tsx)

Selección múltiple de personas con búsqueda y filtro de área. Conserva la selección al cambiar filtros y permite retirar integrantes; recibe únicamente los destinatarios autorizados.

Entradas exportadas: `EmployeePicker`.

### [src/components/employee-profile.tsx](../src/components/employee-profile.tsx)

Ficha individual con información y seguimiento visibles según el perfil del solicitante. Reutiliza datos previamente restringidos y ofrece consultas de IA sin conceder permisos de edición adicionales.

Entradas exportadas: `EmployeeProfile`.

### [src/components/forms.tsx](../src/components/forms.tsx)

Renderiza formularios descritos por el módulo de negocio y normaliza sus valores. Centraliza peticiones y errores visibles; el servidor vuelve a validar todo contenido enviado.

Entradas exportadas: `Field`, `FormSpec`, `request`, `EditForm`, `Upload`.

### [src/components/hire-candidate.tsx](../src/components/hire-candidate.tsx)

Diálogo de contratación y elección de puesto, área y jefe. Envía la operación de negocio al servidor para que los registros asociados se creen con las validaciones de la base.

Entradas exportadas: `HireCandidate`, `HiringAssignmentNotices`.

### [src/components/interview-calendar.tsx](../src/components/interview-calendar.tsx)

Calendario de entrevistas con indicación de días ocupados y selección de fecha. Las comprobaciones visuales se complementan con validaciones de fechas y conflictos en servidor y SQL.

Entradas exportadas: `InterviewCalendar`.

### [src/components/module-badge.tsx](../src/components/module-badge.tsx)

Indicadores de pendientes o registros recientes en la navegación. El significado depende del módulo; no todos son mensajes sin leer ni se descartan automáticamente al visitar la pantalla.

Entradas exportadas: `ModuleBadge`.

### [src/components/module-filter-bar.tsx](../src/components/module-filter-bar.tsx)

Controles visuales de búsqueda, estado y fechas de los listados. Comunica cambios al contenedor sin cambiar por sí mismo los permisos ni los datos almacenados.

Entradas exportadas: `ModuleFilterBar`.

### [src/components/onboarding-learning.tsx](../src/components/onboarding-learning.tsx)

Material de lectura y evaluación opcional de una actividad. Envía respuestas para calificación en servidor y muestra intentos; completar la lectura no sustituye aprobar una evaluación cuando está exigida.

Entradas exportadas: `OnboardingLearning`.

### [src/components/onboarding-panel.tsx](../src/components/onboarding-panel.tsx)

Gestión de planes, plantillas y actividades de incorporación con entrega y revisión. Separa acciones del colaborador y del responsable y mantiene visibles avances e historial.

Entradas exportadas: `OnboardingPanel`.

### [src/components/operations-panels.tsx](../src/components/operations-panels.tsx)

Paneles de novedades, equipo, desempeño, analíticas y auditoría. Reúne filtros y vistas especializadas; las acciones de IA siguen pasando por las rutas autorizadas del servidor.

Entradas exportadas: `OperationsPanel`, `TeamTree`, `AnalyticsCharts`, `AuditPanel`.

### [src/components/person-select.tsx](../src/components/person-select.tsx)

Selector de persona con búsqueda textual y opciones desplegables. Reutiliza identificadores de las opciones recibidas sin crear personas ni resolver permisos de jerarquía.

Entradas exportadas: `PersonSelect`.

### [src/components/recruitment-recommendations.tsx](../src/components/recruitment-recommendations.tsx)

Comparación de postulaciones activas por vacante y puntuación de IA. Permite revisar a cada candidato; una recomendación no contrata ni descarta automáticamente.

Entradas exportadas: `RecruitmentRecommendations`.

### [src/components/task-calendar.tsx](../src/components/task-calendar.tsx)

Calendario de tareas por vencimiento con cantidades y colores de prioridad. Representa los registros recibidos; no amplía el alcance del equipo ni reemplaza las listas e historiales.

Entradas exportadas: `TaskCalendar`.

### [src/components/task-conversation.tsx](../src/components/task-conversation.tsx)

Conversación vinculada a una tarea, con envío, paginación y actualización periódica. Registra hasta qué mensaje se ha leído mediante la API; consultar el chat exige acceso a la tarea.

Entradas exportadas: `TaskConversation`.

### [src/components/task-message-alerts.tsx](../src/components/task-message-alerts.tsx)

Presenta novedades de conversaciones por tarea y cantidad sin leer. Evita incluir el contenido privado de mensajes en el resumen general de novedades.

Entradas exportadas: `TaskMessageAlerts`.

### [src/components/training-evidence.tsx](../src/components/training-evidence.tsx)

Entrega y consulta de evidencias formativas, recursos sugeridos y opinión de IA. Conserva observaciones de rechazo para orientar una nueva entrega; la validación final corresponde al responsable autorizado.

Entradas exportadas: `TrainingReviewMessage`, `TrainingResources`, `TrainingEvidence`.

### [src/components/vacancy-assistant.tsx](../src/components/vacancy-assistant.tsx)

Solicita un borrador de vacante a la IA para revisión humana. El contenido propuesto debe pasar por el formulario de guardado antes de convertirse en una vacante persistida.

Entradas exportadas: `VacancyAssistant`.

### [src/components/vacancy-documents.tsx](../src/components/vacancy-documents.tsx)

Administra adjuntos privados de vacantes mediante la API. La descarga utiliza enlaces temporales y la autorización no depende de que el usuario conozca la ruta del archivo.

Entradas exportadas: `VacancyDocuments`.

### [src/components/workforce-tools.tsx](../src/components/workforce-tools.tsx)

Herramientas de gráficas, propuestas de instrucciones, capacitación y revisión del progreso. Las gráficas representan conteos recibidos, con leyendas y tipos intercambiables; el modelo no aporta código ejecutable.

Entradas exportadas: `DataGraph`, `WorkforceAI`, `StaffEnrollment`, `TrainingAssistant`, `TrainingProgress`.

### [src/components/workplace-climate.tsx](../src/components/workplace-climate.tsx)

Creación, asignación y respuesta de encuestas, comentarios anónimos y análisis de clima. Separa la administración de encuestas de las pendientes del usuario y respeta los requisitos de agregación.

Entradas exportadas: `WorkplaceClimate`.

### [src/components/workspace.tsx](../src/components/workspace.tsx)

Contenedor principal de navegación y vistas por rol. Conecta datos autorizados, formularios y paneles especializados; coordina las actualizaciones de pantalla tras las operaciones del servidor.

Entradas exportadas: `Workspace`.

## src/lib

### [src/lib/ai/module-scope.ts](../src/lib/ai/module-scope.ts)

Controla el ámbito temático de los resúmenes. Rechaza consultas explícitas de otros dominios antes de consumir IA y genera instrucciones de alcance por módulo. La vista general es transversal; la autorización por rol sigue aplicándose independientemente.

Entradas exportadas: `requireModuleTopic`, `moduleTopicInstruction`, `AnalysisModule`.

### [src/lib/ai/attachments.ts](../src/lib/ai/attachments.ts)

Obtiene imágenes y PDF mediante el cliente autorizado y los prepara en base64 para el proveedor. Comprueba formato, tamaño y configuración visual; la descarga conserva las políticas de Storage.

Entradas exportadas: `authorizedAttachment`.

### [src/lib/ai/pdf-vision.ts](../src/lib/ai/pdf-vision.ts)

Convierte páginas de PDF en imágenes para Ollama cuando se necesita visión. Acota páginas y resolución para evitar documentos excesivos; un PDF rechazado por límites no debe interpretarse como evidencia inválida del empleado.

Entradas exportadas: `maxVisionPdfPages`, `pdfImages`.

### [src/lib/ai/provider.ts](../src/lib/ai/provider.ts)

Adaptadores de Gemini y Ollama con salidas JSON validadas por esquema. Selecciona modelo de texto o visión, aplica tiempos de espera y permite respaldo únicamente cuando está configurado; no ejecuta instrucciones operativas del modelo.

Entradas exportadas: `Attachment`, `AIProvider`, `GeminiProvider`, `OllamaProvider`, `generate`.

### [src/lib/ai/schemas.ts](../src/lib/ai/schemas.ts)

Contratos de resultados de IA y saneamiento del texto de entrada. Los esquemas limitan forma y valores, pero no garantizan veracidad ni eliminan por sí solos toda inyección de instrucciones.

Entradas exportadas: `recommendation`, `verification`, `systemPrompt`, `sanitize`.

### [src/lib/ai/training-opinion.ts](../src/lib/ai/training-opinion.ts)

Valida y prepara la opinión de IA sobre evidencias de capacitación. Separa hallazgos, faltantes y próximos pasos; el resultado orienta la revisión humana y no aprueba progreso.

Entradas exportadas: `trainingOpinion`, `reviewTrainingOpinion`.

### [src/lib/api.ts](../src/lib/api.ts)

Controles HTTP reutilizables: origen, tamaño real del cuerpo, requisitos de esquema y errores públicos. La validación del transporte se complementa con Zod y las reglas de autorización de cada operación SQL.

Entradas exportadas: `requireHrHierarchySchema`, `requireWorkforceSchema`, `requireCourseEvidenceSchema`, `validateInterviewSchedule`, `requireHiringSchema`, `checkOrigin`, `databaseError`, `failure`, `readFormData`, `readJson`.

### [src/lib/auth/index.ts](../src/lib/auth/index.ts)

Autenticación de servidor y exigencia de roles sobre perfiles activos. El superusuario hereda las operaciones autorizadas a RH; las comprobaciones de pertenencia a un equipo se realizan además en cada recurso.

Entradas exportadas: `ApiError`, `authenticate`, `requireRole`.

### [src/lib/permissions/index.ts](../src/lib/permissions/index.ts)

Catálogo de roles, destinos y permisos de navegación. Compartido por interfaz y servidor; ocultar una ruta o botón no sustituye las políticas RLS.

Entradas exportadas: `roles`, `Role`, `home`, `mayEnter`, `applicationTransitions`, `isHR`.

### [src/lib/storage/files.ts](../src/lib/storage/files.ts)

Inspección de tamaño, formato y contenido de archivos y extracción de texto para análisis. Los límites de lectura acotan el trabajo; verificar cabeceras no equivale a un análisis antivirus.

Entradas exportadas: `maxFileSize`, `inspectFile`.

### [src/lib/supabase/config.ts](../src/lib/supabase/config.ts)

Selecciona la clave pública de Supabase y conserva compatibilidad con la variable anon anterior. No debe usarse para exponer ni sustituir la clave service role.

Entradas exportadas: `publicSupabaseKey`.

### [src/lib/supabase/server.ts](../src/lib/supabase/server.ts)

Construye clientes exclusivos del servidor. db conserva cookies y RLS; adminDb usa privilegios administrativos y exige que el llamador haya autorizado previamente al usuario y al recurso.

Entradas exportadas: `configured`, `db`, `adminDb`.

### [src/lib/working-days.ts](../src/lib/working-days.ts)

Calendario laboral implementado: fines de semana y descansos nacionales codificados. mexicoDate interpreta instantes en Ciudad de México; no incluye automáticamente descansos empresariales o electorales extraordinarios.

Entradas exportadas: `nonWorkingDay`, `mexicoDate`.

## src/modules

### [src/modules/workspace/activity-context.ts](../src/modules/workspace/activity-context.ts)

Calcula personas únicas, actividades, estados y atrasos por área con datos ya autorizados. En incorporación estos hechos respaldan la redacción libre de la IA según la pregunta. El servidor calcula las cifras; el modelo produce el comentario y se valida la estructura de salida. También proporciona contexto agregado a los análisis operativos relacionados. Los registros sin relaciones y las tablas ausentes se distinguen de valores cero.

Entradas exportadas: `activityContext`, `factSelection`, `selectedFactSummary`.

### [src/modules/commands/schemas.ts](../src/modules/commands/schemas.ts)

Contratos de entrada de los comandos de negocio. Restringe operaciones, campos y estados antes de invocar SQL; la validación de estructura no sustituye la autorización de filas.

Entradas exportadas: `schemas`, `Operation`.

### [src/modules/onboarding/schemas.ts](../src/modules/onboarding/schemas.ts)

Contratos de planes, actividades y operaciones de incorporación. Distingue responsables del empleado, jefe y RH, requisitos de documentos y revisión; una propuesta de IA debe cumplir el mismo contrato.

Entradas exportadas: `stepSchema`, `planSchema`, `Plan`, `onboardingInput`.

### [src/modules/performance/service.ts](../src/modules/performance/service.ts)

Indicador operativo ponderado de tareas aprobadas y cursos completados. Una categoría sin registros aporta cero: el indicador necesita contexto y no es una decisión laboral ni una evaluación de atributos personales.

Entradas exportadas: `performance`.

### [src/modules/workspace/analytics-summary.ts](../src/modules/workspace/analytics-summary.ts)

Construye afirmaciones y conteos verificables de analíticas a partir del conjunto filtrado. El modelo selecciona temas permitidos, mientras el código conserva el control de las cifras y sus límites.

Entradas exportadas: `analyticsSelection`, `analyticsSummary`.

### [src/modules/workspace/application-sections.ts](../src/modules/workspace/application-sections.ts)

Define la agrupación visual de postulaciones por estado. Separa el seguimiento activo de los historiales sin alterar las transiciones permitidas por la base.

Entradas exportadas: `applicationSections`.

### [src/modules/workspace/filters.ts](../src/modules/workspace/filters.ts)

Filtra el conjunto de trabajo por área, persona, proceso y periodo relacionando empleados, puestos y registros. Debe recibir datos previamente autorizados; un filtro visual no concede acceso.

Entradas exportadas: `WorkspaceFilters`, `filterWorkspace`.

### [src/modules/workspace/forms.ts](../src/modules/workspace/forms.ts)

Describe formularios por operación, opciones y valores iniciales. La interfaz consume estas definiciones; los contratos Zod y SQL siguen siendo la autoridad para aceptar una escritura.

Entradas exportadas: `formFor`.

### [src/modules/workspace/insights.ts](../src/modules/workspace/insights.ts)

Calcula alcance por rol, destinatarios y señales operativas sin IA. El jefe trabaja sobre la jerarquía subordinada autorizada; una tarea entregada para revisión no cuenta como atraso del empleado.

Entradas exportadas: `InsightArea`, `canReviewTeamPerformance`, `overdue`, `scopeData`, `taskRecipients`, `notifications`, `insightContext`.

### [src/modules/workspace/labels.ts](../src/modules/workspace/labels.ts)

Traduce códigos internos a textos de interfaz en español. Conserva los identificadores originales en almacenamiento y peticiones para mantener los contratos del sistema.

Entradas exportadas: `labels`, `stateLabel`.

### [src/modules/workspace/module-filters.ts](../src/modules/workspace/module-filters.ts)

Aplica los criterios de búsqueda propios de cada listado. Opera sobre las filas ya cargadas y no consulta páginas adicionales de la base de datos.

Entradas exportadas: `ModuleFilters`, `moduleTables`, `filterModule`.

### [src/modules/workspace/organization.ts](../src/modules/workspace/organization.ts)

Construye el organigrama, conserva ancestros autorizados y protege recorridos contra ciclos. También refleja en la interfaz quién puede editar a integrantes de RH; PostgreSQL vuelve a exigir esa regla.

Entradas exportadas: `canEditStaff`, `organization`.

### [src/modules/workspace/overview.ts](../src/modules/workspace/overview.ts)

Construye el contexto minimizado de novedades y convierte referencias técnicas en nombres legibles. Describe el estado disponible y registros recientes, no un historial completo de cambios desde la última visita.

Entradas exportadas: `readableOverview`, `overviewContext`.

### [src/modules/workspace/queries.ts](../src/modules/workspace/queries.ts)

Carga tablas con la sesión y un máximo de 1000 filas por tabla. Auditoría se obtiene solo para superusuario; un fallo de consulta se informa como error y no se transforma en un conjunto vacío.

Entradas exportadas: `tables`, `snapshot`.

### [src/modules/workspace/tasks.ts](../src/modules/workspace/tasks.ts)

Ordena una copia de las tareas por prioridad, vencimiento e identificador. No modifica el arreglo recibido y mantiene un desempate estable para evitar saltos entre renderizados.

Entradas exportadas: `sortTasks`.

### [src/modules/workspace/types.ts](../src/modules/workspace/types.ts)

Tipos del perfil y de las filas agrupadas por tabla. value convierte campos para su presentación; estos tipos flexibles no sustituyen los esquemas de validación de entradas.

Entradas exportadas: `Row`, `Snapshot`, `Profile`, `value`.

### [src/modules/workspace/workforce-ai.ts](../src/modules/workspace/workforce-ai.ts)

Contratos de gráficas, borradores formativos y resúmenes. La IA propone una representación; las cifras se calculan con datos autorizados y los nombres de procesos y agrupaciones están restringidos.

Entradas exportadas: `chartSchema`, `chartAdvice`, `summaryAdvice`, `trainingDraft`, `Chart`, `requestedCharts`, `chartValues`, `workforceMetrics`.

## scripts

### [scripts/check-real-flows.mjs](../scripts/check-real-flows.mjs)

Recorridos integrados con cuentas y registros identificados como pruebas. Usa servicios reales y puede modificar datos; sus resultados corresponden al entorno y a los casos efectivamente ejecutados.

### [scripts/check-supabase.mjs](../scripts/check-supabase.mjs)

Comprueba conexión, autenticación y acceso a recursos configurados. Permite distinguir fallos de servicio o migraciones de errores de interfaz; requiere las variables del entorno de prueba.

### [scripts/seed.mjs](../scripts/seed.mjs)

Crea cuentas y registros de demostración. Requiere configuración administrativa y autorización explícita para destinos remotos; no es un reinicio seguro ni una operación idempotente de producción.

### [scripts/setup-local.mjs](../scripts/setup-local.mjs)

Prepara configuración local sin sobrescribir el archivo de entorno existente. Los valores privados se completan localmente y no deben añadirse al repositorio.

### [scripts/test-uploads.mjs](../scripts/test-uploads.mjs)

Pruebas de integración de documentos con servicios reales. Puede crear registros y archivos; ejecutar únicamente contra un entorno destinado a pruebas con credenciales apropiadas.

## Entrada transversal

Renueva la sesión y aplica el acceso por rol antes de navegar. Las operaciones privadas vuelven a autorizarse en la API y en PostgreSQL; este control de navegación no reemplaza esas comprobaciones. Véase [src/proxy.ts](../src/proxy.ts).

