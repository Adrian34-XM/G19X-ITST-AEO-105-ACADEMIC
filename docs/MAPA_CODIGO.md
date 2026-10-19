# Mapa del código de Nexo

Este índice explica los archivos propios del sistema. Complementa [la guía de funcionamiento](CODIGO.md); los comentarios junto al código describen responsabilidades y límites. Las dependencias instaladas y los archivos generados no se documentan modificándolos.

## Motor de gráficas

- [src/components/data-chart.tsx](../src/components/data-chart.tsx): `DataChart`, carga diferida sin SSR, tabla accesible y recuperación ante errores del canvas.
- [src/components/am-chart.tsx](../src/components/am-chart.tsx): representación con amCharts 5, cinco tipos, temas claro/oscuro, movimiento reducido y liberación de cada instancia.
- [src/lib/charts/data.ts](../src/lib/charts/data.ts): tipos `ChartKind`, `ChartValue`, `DataChartProps`, validación de valores mediante `chartRows` y compatibilidad de tipos mediante `chartKind`. No calcula métricas de negocio.

- [src/lib/charts/module-loader.ts](../src/lib/charts/module-loader.ts): `createChartModuleLoader`, descarga compartida con estados, límite de espera y reintento sin recargar la página.

Guía de uso y mantenimiento: [Gráficas con amCharts 5](GRAFICAS.md).

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

### [src/app/[[...path]]/loading.tsx](../src/app/[[...path]]/loading.tsx)

Selecciona la espera de cada ruta: muestra la estructura del espacio privado o una carga sencilla en las páginas públicas.

Entradas exportadas: `ModuleLoading`.

### [src/app/api/application-updates/route.ts](../src/app/api/application-updates/route.ts)

Consulta avances auditados de las postulaciones propias. Resuelve primero la pertenencia mediante la sesión y RLS antes de recuperar novedades.

Entradas exportadas: `GET`.

### [src/app/api/auth/destination/route.ts](../src/app/api/auth/destination/route.ts)

Devuelve el destino del usuario según su rol vigente en servidor, sin confiar en el rol enviado por el navegador.

Entradas exportadas: `GET`.

### [src/app/api/climate/overview/route.ts](../src/app/api/climate/overview/route.ts)

Obtiene novedades de encuestas para RH y superadministración mediante datos autorizados y agregación protegida.

Entradas exportadas: `GET`.

### [src/app/api/profile-corrections/route.ts](../src/app/api/profile-corrections/route.ts)

Consulta y tramita solicitudes de corrección del expediente. La sesión y las funciones SQL autorizan la lectura y revisión.

Entradas exportadas: `GET`, `POST`.

### [src/app/api/profile-photo/route.ts](../src/app/api/profile-photo/route.ts)

Carga, consulta y elimina fotos privadas según el perfil autenticado. No acepta una URL externa ni un propietario arbitrario desde el formulario.

Entradas exportadas: `POST`, `DELETE`, `GET`.

### [src/app/auth/[flow]/page.tsx](../src/app/auth/[flow]/page.tsx)

Resuelve las páginas de recuperación, confirmación y contraseña. Entrega al componente de acceso los parámetros del flujo y excluye estas páginas de la indexación.

Entradas exportadas: `dynamic`, `metadata`, `Page`.

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

### [src/components/card-slats-background.tsx](../src/components/card-slats-background.tsx)

Fondo decorativo verde MicroSlats con preset signal para la tarjeta de bienvenida y la foto de perfil. Ajusta su paleta al tema claro u oscuro. Conserva los parámetros de densidad e interacción de cada tarjeta, carga diferida y control para pausar; no recibe datos del usuario ni captura las acciones de los formularios.

Entradas exportadas: `CardSlatsBackground`.

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

### [src/components/account-access.tsx](../src/components/account-access.tsx)

Presenta los flujos de confirmación y recuperación. Los enlaces de un solo uso requieren una acción explícita antes de consumir su código.

Entradas exportadas: `AccountAccess`.

### [src/components/ai-requests.ts](../src/components/ai-requests.ts)

Ordena las solicitudes de análisis por cuenta en la sesión del navegador y gestiona las sustituidas. La reserva SQL conserva la autoridad entre pestañas.

Entradas exportadas: `SupersededAnalysis`, `queueAnalysis`, `requestAnalysis`.

### [src/components/application-access.tsx](../src/components/application-access.tsx)

Muestra un diálogo de acceso para postularse, con foco contenido y cierre mediante Escape.

Entradas exportadas: `ApplicationAccess`.

### [src/components/candidate-progress.tsx](../src/components/candidate-progress.tsx)

Comparte las novedades del candidato y muestra notificaciones y tarjetas con las etapas de sus postulaciones.

Entradas exportadas: `CandidateUpdatesProvider`, `CandidateApplicationNotifications`, `CandidateProgressNotice`, `CandidateApplicationProgress`.

### [src/components/candidate-session.tsx](../src/components/candidate-session.tsx)

Comprueba el destino vigente mientras permanece abierta la sesión de candidato, para detectar cambios como la contratación.

Entradas exportadas: `CandidateSession`.

### [src/components/climate-analysis.tsx](../src/components/climate-analysis.tsx)

Solicita y presenta el análisis grupal de una encuesta en una ventana con gráficas por pregunta y posibilidad de volver a consultar el resultado.

Entradas exportadas: `ClimateAnalysisResult`, `ClimateAnalysis`.

### [src/components/climate-overview.tsx](../src/components/climate-overview.tsx)

Presenta novedades de ambiente laboral en la vista general, con acceso a las encuestas y sus análisis disponibles.

Entradas exportadas: `ClimateOverviewPanel`.

### [src/components/climate-question-chart.tsx](../src/components/climate-question-chart.tsx)

Representa los promedios de las preguntas en columnas o barras. No transforma promedios en frecuencias de respuestas.

Entradas exportadas: `ClimateQuestionChart`.

### [src/components/loading-skeleton.tsx](../src/components/loading-skeleton.tsx)

Ofrece estructuras de espera y estados accesibles compartidos por rutas y consultas, sin representar datos ficticios como resultados.

Entradas exportadas: `Skeleton`, `LoadingStatus`, `ContentSkeleton`, `WorkspaceSkeleton`.

### [src/components/login-backdrop.tsx](../src/components/login-backdrop.tsx)

Carga de forma diferida el fondo MicroSlats del login, adapta sus colores al tema y mantiene el control para pausar o reanudar la animación.

Entradas exportadas: `LoginBackdrop`.

### [src/components/micro-slats.tsx](../src/components/micro-slats.tsx)

Adapta el componente MicroSlats de React Bits a TypeScript. Renderiza el fondo con OGL, gestiona tamaño y recursos y respeta movimiento reducido; la licencia está en THIRD_PARTY_NOTICES.md.

Entradas exportadas: `MicroSlatsProps`, `MicroSlats`.

### [src/components/overview-dashboard.tsx](../src/components/overview-dashboard.tsx)

Organiza indicadores, accesos y paneles de la vista general a partir del contexto autorizado del usuario.

Entradas exportadas: `OverviewDashboard`.

### [src/components/profile-corrections.tsx](../src/components/profile-corrections.tsx)

Permite solicitar y revisar correcciones del expediente y consultar la respuesta, con validación adicional en API y SQL.

Entradas exportadas: `ProfileCorrections`.

### [src/components/profile-photo.tsx](../src/components/profile-photo.tsx)

Muestra y administra la foto mediante la API privada de perfiles, comunicando carga y errores en la interfaz.

Entradas exportadas: `ProfileAvatar`, `ProfilePhotoEditor`.

### [src/components/profile-summary.tsx](../src/components/profile-summary.tsx)

Solicita el resumen del expediente autorizado y comparte únicamente solicitudes en curso de la misma sesión y persona.

Entradas exportadas: `ProfileSummary`.

### [src/components/status-text.tsx](../src/components/status-text.tsx)

Presenta los códigos de estado reconocidos como etiquetas en español, sin modificar cifras ni el resto de la respuesta.

Entradas exportadas: `StatusText`.

### [src/components/summary-requests.ts](../src/components/summary-requests.ts)

Comparte solicitudes de resumen en curso cuando coinciden usuario, rol y contenido; retira la entrada al finalizar.

Entradas exportadas: `summaryRequestKey`, `shareSummaryRequest`.

### [src/components/theme-toggle.tsx](../src/components/theme-toggle.tsx)

Alterna el tema claro u oscuro y sincroniza la preferencia del navegador entre módulos y pestañas. Comparte el tema activo mediante `useDarkTheme` con los fondos dibujados en canvas.

Entradas exportadas: `ThemeToggle`, `useDarkTheme`.

### [src/components/workspace-navigation.tsx](../src/components/workspace-navigation.tsx)

Compone los accesos de navegación con iconos e indicadores según los módulos recibidos para el usuario.

Entradas exportadas: `WorkspaceNavigation`, `WorkspaceShortcuts`.

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

### [src/lib/ai/chart-narrative.ts](../src/lib/ai/chart-narrative.ts)

Define el contrato y las instrucciones de la explicación de gráficas y su revisión factual, conservando las fuentes de cada afirmación.

Entradas exportadas: `chartNarrativeSchema`, `chartNarrativeSystemPrompt`, `chartFactualReview`, `chartFactualSystemPrompt`, `chartReviewContext`, `readableChartNarrative`.

### [src/lib/ai/grounding.ts](../src/lib/ai/grounding.ts)

Define contratos, instrucciones y preparación de contexto para contrastar análisis y borradores con sus fuentes. Esta revisión no sustituye la validación humana.

Entradas exportadas: `groundingReview`, `trainingFactualReview`, `trainingFactualSystemPrompt`, `professionalFactualReview`, `analyticsFactualReview`, `analyticsFactualSystemPrompt`, `professionalFactualSystemPrompt`, `groundingSystemPrompt`, `onboardingDraftReview`, `onboardingDraftSystemPrompt`, `GenerationPurpose`, `unsupportedEvidenceClaim`, `groundingContext`.

### [src/lib/ai/overview-summary.ts](../src/lib/ai/overview-summary.ts)

Prepara hechos verificados y contratos del resumen semanal, su revisión factual y el control de afirmaciones fuera del alcance disponible.

Entradas exportadas: `overviewNarrativeSchema`, `overviewFactualReview`, `overviewNarrativeSystemPrompt`, `overviewFactualSystemPrompt`, `overviewReviewContext`, `overviewScopeViolation`, `compactOverview`, `overviewSummaryInput`.

### [src/lib/ai/recruitment-context.ts](../src/lib/ai/recruitment-context.ts)

Separa datos declarados del candidato y requisitos de la vacante; no atribuye los años de experiencia general a una habilidad concreta.

Entradas exportadas: `recruitmentContext`.

### [src/lib/auth/email-links.ts](../src/lib/auth/email-links.ts)

Construye el destino de los correos desde APP_URL validada y define mensajes públicos de registro y recuperación, sin confiar en el Host del visitante.

Entradas exportadas: `authEmailRedirect`, `recoveryMessage`, `registrationMessage`.

### [src/lib/private-analyses.ts](../src/lib/private-analyses.ts)

Incorpora evaluaciones de postulaciones y encuestas mediante la sesión; las políticas RLS de las tablas privadas deciden qué filas pueden leerse.

Entradas exportadas: `applicationAnalyses`, `climateAnalyses`.

### [src/lib/storage/profile-photo.ts](../src/lib/storage/profile-photo.ts)

Comprueba tamaño y dimensiones y normaliza las fotos antes de almacenarlas; limita imágenes cuyo procesamiento consumiría demasiada memoria.

Entradas exportadas: `maxPhotoSize`, `normalizeProfilePhoto`.

### [src/lib/ai/orchestration/analytics.ts](../src/lib/ai/orchestration/analytics.ts)

Separa las instrucciones de selección de procesos y la explicación de agregados calculados. La selección no redacta cifras ni conclusiones.

Entradas exportadas: `analyticsSelectionInput`, `analyticsNarrativeInput`.

### [src/lib/ai/orchestration/contracts.ts](../src/lib/ai/orchestration/contracts.ts)

Contratos Zod del módulo solicitado y de la respuesta con recomendaciones. Mantiene los tipos de recurso, prioridades y límites admitidos.

Entradas exportadas: `areaSchema`, `outputSchema`.

### [src/lib/ai/orchestration/courses.ts](../src/lib/ai/orchestration/courses.ts)

Construye la entrada de capacitación según corresponda un análisis del contexto autorizado o un resumen automático de agregados filtrados.

Entradas exportadas: `coursesInput`.

### [src/lib/ai/orchestration/draft.ts](../src/lib/ai/orchestration/draft.ts)

Prepara propuestas revisables de instrucciones para un análisis posterior, conservando el alcance personal o colectivo permitido.

Entradas exportadas: `promptSchema`, `draftInput`.

### [src/lib/ai/orchestration/overview.ts](../src/lib/ai/orchestration/overview.ts)

Separa el resumen personal de la vista general organizacional. El primero omite actividades finalizadas y agrupa solo registros personales; el segundo usa los hechos verificados del resumen semanal.

Entradas exportadas: `personalSummarySchema`, `overviewInput`.

### [src/lib/ai/orchestration/performance.ts](../src/lib/ai/orchestration/performance.ts)

Prepara señales operativas de desempeño y un catálogo de siguientes pasos sugeridos. El contrato rechaza cifras en la narrativa y valoraciones de bajo desempeño sin respaldo.

Entradas exportadas: `performanceSteps`, `performanceAdvice`, `performanceInput`.

### [src/lib/ai/orchestration/request.ts](../src/lib/ai/orchestration/request.ts)

Selecciona las instrucciones y el contrato de generación por módulo y modalidad. Añade metadatos de alcance del servidor y conserva el propósito y la reparación, sin consultar servicios ni ampliar permisos.

Entradas exportadas: `OrchestrationGeneration`, `buildOrchestrationRequest`.

### [src/lib/ai/orchestration/shared.ts](../src/lib/ai/orchestration/shared.ts)

Construye entradas comunes de análisis operativo y resúmenes automáticos. Los resúmenes automáticos reciben agregados; el análisis conserva el contexto ya filtrado y retira la búsqueda libre de los filtros enviados.

Entradas exportadas: `operationalAnalysisInput`, `automaticSummaryInput`.

### [src/lib/ai/orchestration/tasks.ts](../src/lib/ai/orchestration/tasks.ts)

Define el estilo de tareas y elige entre el análisis del módulo y el resumen automático. Distingue entrega de aprobación y no atribuye lectura del contenido de evidencias al contexto de metadatos.

Entradas exportadas: `taskWritingStyle`, `tasksInput`.

### [src/lib/ai/orchestration/types.ts](../src/lib/ai/orchestration/types.ts)

Tipos de contexto, agregados y opciones de las entradas del orquestador; no sustituyen las comprobaciones de autorización realizadas por la ruta.

Entradas exportadas: `OrchestrationContext`, `OperationalMetrics`, `AnalysisInput`, `OrchestrationRequest`.

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

### [src/modules/workspace/application-progress.ts](../src/modules/workspace/application-progress.ts)

Define etapas y mensajes del seguimiento y filtra las novedades auditadas para las postulaciones permitidas.

Entradas exportadas: `applicationStages`, `applicationProgressCopy`, `ApplicationUpdate`, `TrackedApplication`, `ownApplicationUpdates`, `progressStages`.

### [src/modules/workspace/chart-report.ts](../src/modules/workspace/chart-report.ts)

Valida opciones de periodo y prepara informes de gráficas con datos calculados y contexto para su explicación narrativa.

Entradas exportadas: `chartOptionsSchema`, `ChartOptions`, `reportingDay`, `ChartReport`, `buildChartReports`, `chartNarrativeContext`, `buildChartReport`.

### [src/modules/workspace/climate-charts.ts](../src/modules/workspace/climate-charts.ts)

Construye gráficas con los agregados autorizados de la encuesta y sus preguntas, sin encargar al modelo la invención de cifras.

Entradas exportadas: `ClimateChart`, `climateCharts`.

### [src/modules/workspace/climate-overview.ts](../src/modules/workspace/climate-overview.ts)

Define el contrato del análisis grupal y calcula novedades de encuestas, fechas y alcance de la semana.

Entradas exportadas: `ClimateGroupAnalysis`, `climateSummarySchema`, `ClimateSurveyRecord`, `ClimateNews`, `ClimateOverview`, `withinClimateWeek`, `climateAnalysisDate`, `climateNews`.

### [src/modules/workspace/current-week.ts](../src/modules/workspace/current-week.ts)

Calcula la semana de lunes a lunes en Ciudad de México, con inicio inclusivo y final exclusivo.

Entradas exportadas: `currentWeek`.

### [src/modules/workspace/interface-copy.ts](../src/modules/workspace/interface-copy.ts)

Centraliza las descripciones breves que orientan al usuario en cada módulo.

Entradas exportadas: `moduleDescriptions`.

### [src/modules/workspace/own-manager.ts](../src/modules/workspace/own-manager.ts)

Obtiene únicamente el nombre del jefe del usuario autenticado después de comprobar su registro propio; no abre el expediente completo del superior.

Entradas exportadas: `ownManagerName`.

### [src/modules/workspace/profile-records.ts](../src/modules/workspace/profile-records.ts)

Relaciona actividades y archivos de una persona en su expediente, manteniendo separados los datos anónimos de ambiente laboral.

Entradas exportadas: `ProfileRecord`, `profileRecords`.

### [src/modules/workspace/training-review.ts](../src/modules/workspace/training-review.ts)

Determina si una asignación requiere revisión; una finalización validada prevalece sobre una bandera anterior de pendiente.

Entradas exportadas: `pendingTrainingReview`.

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
