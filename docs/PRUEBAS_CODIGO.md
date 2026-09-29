# Pruebas y configuración del código

## Cómo interpretar las comprobaciones

`npm.cmd run typecheck` comprueba tipos; `npm.cmd run lint` comprueba reglas estáticas; `npm.cmd test` ejecuta Vitest; `npm.cmd run build` verifica el empaquetado de producción. Ninguna de estas comprobaciones aislada certifica todos los recorridos reales.

Vitest sustituye determinados servicios por dobles de prueba. PGlite ejecuta SQL en un PostgreSQL embebido con Auth/Storage simulados. La prueba visual real es optativa y requiere `RUN_LOCAL_VISION=true`, modelo instalado y archivos de evidencia. No habilitarla como si fuera una prueba puramente local sin servicios.

`npm.cmd run test:supabase` comprueba el servicio configurado. Los scripts de subidas, datos de demostración y recorridos reales pueden crear registros: utilizar un entorno de pruebas. No incluir credenciales reales en fixtures o documentación.

## Índice de casos

Los nombres siguientes proceden de las declaraciones de las pruebas; describen intenciones, no resultados de ejecución. Los casos parametrizados pueden generar más ejecuciones que nombres.

### [activation.test.ts](../tests/activation.test.ts)

- activa las tres mejoras pendientes y permite repetir el script
- rechaza una base vacía antes de intentar activar mejoras

### [ai.test.ts](../tests/ai.test.ts)

- Gemini envía solo contexto explícito y separa instrucciones de documento
- salida inválida del proveedor nunca se acepta
- fallback acotado a un proveedor secundario
- proveedor caído produce error, no resultado ficticio
- Ollama selecciona visión solo para adjuntos y envía imágenes
- sin modelo visual no intenta fingir un análisis de imagen
- Ollama transforma PDF en páginas PNG, nunca envía el PDF binario como imagen

### [analytics-summary.test.ts](../tests/analytics-summary.test.ts)

- separa totales de estados sin exponer identificadores ni texto de registros
- distingue ausencia de registros y elimina procesos repetidos

### [api.test.ts](../tests/api.test.ts)

- API sin autenticación devuelve 401 antes de ejecutar la operación
- CSRF se rechaza antes de consultar identidad
- rechaza JSON roto y payload excesivo
- no expone detalles técnicos en errores
- permite lectura y same origin, rechaza cross-site
- acepta el host del navegador cuando Next reconstruye localhost
- rechaza origen distinto incluso con cabeceras manipuladas: %j
- limita bytes UTF-8 aunque no haya Content-Length
- cancela el flujo antes de consumir un cuerpo excesivo
- limita multipart y mantiene archivos válidos
- permite cerrar entrevistas antiguas en festivo pero impide reprogramarlas a otro festivo

### [application-summary.test.ts](../tests/application-summary.test.ts)

- incluye varios candidatos desde el mínimo y excluye descartados y pendientes
- muestra conteos por vacante y enlaces a cada tarjeta recomendada
- el historial de rechazados cuenta solo ese estado y oculta recomendaciones
- ordena tarjetas por puntuación válida y deja pendientes al final sin modificar datos

### [attachments.test.ts](../tests/attachments.test.ts)

- adjunto visual usa la descarga de la sesión autorizada
- rechaza formatos sin lector visual antes de descargar

### [climate-graphs.test.ts](../tests/climate-graphs.test.ts)

- analiza solo agregados sin comentarios ni identidades
- impide análisis con menos de cinco respuestas
- impide analizar encuestas abiertas
- impide que colaboradores invoquen el análisis

### [database.test.ts](../tests/database.test.ts)

- PostgreSQL real: transacciones, RLS y aislamiento
- registro ignora el rol del metadata
- rechaza acceso sin auth, roles erróneos y escritura directa
- RH publica y candidato se postula; evita duplicados y aísla candidatos
- no permite saltar a contratado ni contratar sin entrevista
- visitantes ven solo vacantes publicadas sin acceso a postulaciones
- agenda entrevista, detecta conflictos y contrata atómicamente
- onboarding, cursos, evidencia y revisión humana actualizan datos reales
- bloquea IDOR en lectura, acciones, Storage y AI
- jefe solo puede ver y asignar a su equipo
- datos manuales asignan roles y equipo sin duplicar al repetir
- jefe inicia análisis de evidencia sin ambigüedad de alias SQL
- entrevistas: editar, cancelar, liberar horario y rechazar cambios ajenos
- onboarding y evidencias: impide operar fuera del equipo
- auditoría solo superadmin y orquestación privada con bloqueo de concurrencia
- superadmin da de alta RH y opera vacantes, tareas, encuestas y analíticas
- no permite otra entrevista pendiente del candidato en una segunda vacante
- documentos de vacantes son privados y exigen ruta propia y objeto existente
- encuesta anónima: mínimo, duplicados, bloqueo y agregado sin autores
- jerarquía multinivel permite subordinados y rechaza ciclos de jefaturas
- asignaciones múltiples respetan jerarquía, omiten cursos existentes y son atómicas
- desactivación revoca permisos y auditoría es inmutable
- planes de onboarding: plantillas automáticas, responsabilidades, documentos y aislamiento
- RH aparece en jerarquía, admite superior y no cambia su propio puesto ni usa funciones antiguas
- onboarding nuevo: varios adjuntos, revisión obligatoria y bloqueo de entregas ajenas
- buzón anónimo: no expone identidades, limita envíos y agrupa comentarios al cierre
- agenda rechaza el pasado y contratación asigna área, jefe y plantilla en una transacción
- solo el superior de RH más alto o superusuario modifica la jerarquía de RH
- auditoría detalla cambios operativos solo para superusuario
- la contratación genera un aviso persistente y RH confirma la asignación
- conversaciones de tarea: acceso, autor, reintentos e historial cerrado
- revisión parcial de capacitación: avisos, permisos, corrección y aprobación
- desplaza la tarea automática de bienvenida sin perder la contratación

### [delete-department.test.ts](../tests/delete-department.test.ts)

- bloquea áreas con puestos o referencias y restringe la eliminación a RH

### [delete-position.test.ts](../tests/delete-position.test.ts)

- solo elimina puestos sin empleados ni referencias y exige RH

### [hr-positions.test.ts](../tests/hr-positions.test.ts)

- permite guardar puestos a RH y superusuario, sin ampliar otros roles

### [insights.test.ts](../tests/insights.test.ts)

- jefe ve su equipo, RH todas las áreas y empleado solo lo suyo
- contexto de cursos contiene puesto y catálogo sin correos ni equipos ajenos
- alertas de atraso excluyen entregadas, aprobadas y vencimientos de hoy
- la ruta de auditoría exige superadministrador
- asignar tareas excluye al propio jefe, superiores y otras ramas, conservando descendientes

### [module-filters.test.ts](../tests/module-filters.test.ts)

- combina prioridad, fecha, búsqueda sin acentos y atraso sin modificar el origen
- filtra usuarios por rol y acceso sin alterar perfiles de otros módulos
- filtra capacitación por estado de asignación y obligatoriedad

### [onboarding-ai.test.ts](../tests/onboarding-ai.test.ts)

- IA devuelve propuesta validada sin asignar, enviar expedientes ni guardar un plan
- empleado y candidato no generan planes IA
- salida inválida o fallo del proveedor no revela secretos ni asigna pasos
- rechaza pasos de IA sin responsable y sin fechas

### [onboarding-learning-api.test.ts](../tests/onboarding-learning-api.test.ts)

- empleado no sube material de evaluación usando privilegios administrativos
- empleado sí puede enviar sus respuestas con autorización SQL
- JSON roto responde 400 sin ejecutar funciones

### [onboarding-learning.test.ts](../tests/onboarding-learning.test.ts)

- bloquea entrega sin aprobar y permite reprobar y repetir sin revelar claves

### [orchestration.test.ts](../tests/orchestration.test.ts)

- impide analíticas a jefe antes de invocar IA
- persiste resultado y elimina enlaces a recursos no autorizados
- marca fracaso del proveedor sin inventar recomendaciones
- rechaza solicitud desconocida sin crear registros
- superadministrador puede analizar y no envía texto privado de tareas
- rechaza persona ajena antes de reservar o invocar el proveedor
- genera un prompt revisable y no guarda el texto de instrucciones en el historial
- el resumen de vista general funciona para los cinco roles
- reutiliza el mismo contexto y vuelve a generar tras cambiar el rol
- los mensajes nuevos invalidan el resumen guardado

### [overview.test.ts](../tests/overview.test.ts)

- sustituye UUID por títulos autorizados y oculta referencias desconocidas
- agrupa indicadores por área sin incluir tareas de otros equipos
- resume señales autorizadas sin textos privados ni expedientes de otra jerarquía
- el resumen no expone tablas ni estados técnicos incluso si la IA los devuelve
- traduce etiquetas escapadas sin confundir incorporación y capacitación

### [pdf-vision.test.ts](../tests/pdf-vision.test.ts)

- extrae texto de PDF y distingue un escaneado
- convierte PDF escaneado completo en imagen PNG
- rechaza PDF visual de más de seis páginas y PDF corrupto

### [recommendations.test.ts](../tests/recommendations.test.ts)

- Recomendaciones por vacante
- ordena resultados válidos, deja pendientes y excluye otras vacantes y descartados

### [task-order.test.ts](../tests/task-order.test.ts)

- ordena por prioridad y vencimiento sin modificar los registros originales

### [training-api.test.ts](../tests/training-api.test.ts)

- colaborador no analiza evidencias para validarlas
- jefe no analiza evidencias fuera de su equipo
- jefe no revisa su propia evidencia
- RH obtiene una opinión sin cambiar estados
- recurso no visible nunca se envía a IA
- recursos se expresan como búsquedas, sin URL arbitraria
- salida inválida de IA no se acepta
- no presenta evidencia suficiente cuando la IA enumera faltantes

### [training-opinion.test.ts](../tests/training-opinion.test.ts)

- ofrece un resumen breve y elimina la frase final inconclusa
- usa una conclusión coherente cuando no hay ninguna frase completa

### [training-review-message.test.ts](../tests/training-review-message.test.ts)

- muestra el rechazo con las instrucciones literales y el responsable
- no confunde una aprobación posterior con el rechazo anterior

### [unit.test.ts](../tests/unit.test.ts)

- permisos y validaciones
- aislamiento de rutas para %s
- contratación solo por operación transaccional
- rechaza mass assignment y UUID manipulados
- calcula porcentajes y umbrales sin dividir entre cero
- valida resultados IA de forma estricta
- limita contexto y establece frontera de datos no confiables
- valida contenido real del archivo y CV

### [vacancy-ai.test.ts](../tests/vacancy-ai.test.ts)

- superadmin obtiene un borrador editable sin publicar ni guardar una vacante
- candidato no puede generar vacantes
- rechaza un falso PDF antes de llamar a IA
- fallo del proveedor se informa sin devolver datos ni secretos

### [vision-live.test.ts](../tests/vision-live.test.ts)



### [workforce-ai.test.ts](../tests/workforce-ai.test.ts)

- gráficas calculadas en servidor solo cuentan filas del alcance y no exponen textos privados a IA
- IDOR de perfil y acceso a analíticas/capacitación no autorizados no invocan IA
- rechaza datos y código no previstos enviados por cliente o modelo
- RH genera capacitación revisable sin guardar ni asignar el borrador
- agrupación sin datos devuelve colección vacía
- la instrucción explícita prevalece sobre una gráfica incorrecta sugerida por el modelo
- el prompt de tareas por fechas produce una sola gráfica cronológica
- elimina gráficas repetidas por configuración y distingue títulos
- ordena las fechas cronológicamente y excluye fechas ausentes o futuras
- analíticas permite gráficas de reclutamiento a RH y mantiene desempeño separado
- analíticas rechaza colaboradores y jefes antes de consultar IA
- agrupa entrevistas por el área de la vacante sin mezclar áreas

### [working-days-sql.test.ts](../tests/working-days-sql.test.ts)

- protege tareas y entrevistas incluso con escrituras directas y conserva fechas históricas

### [working-days.test.ts](../tests/working-days.test.ts)

- bloquea fines de semana y descansos mexicanos y no inventa festivos

### [workspace-filters.test.ts](../tests/workspace-filters.test.ts)

- filtra tareas y evidencias de varias personas sin incluir el resto
- organigrama conserva superiores de otra área y no agrega personas ajenas
- organigrama vacío y ciclos históricos no bloquean el recorrido
- filtra onboarding, tareas, evidencias y postulaciones de forma coherente por área
- el análisis de un subordinado conserva su contexto sin ampliar al resto del equipo
- filtra analíticas por periodo y proceso
- agenda excluye al candidato ocupado en cualquier vacante y permite editar su cita

## Configuración y utilidades de soporte

- `package.json` declara comandos y dependencias; `package-lock.json` fija las resoluciones para instalaciones reproducibles con npm ci.
- `tsconfig.json` configura TypeScript y alias. No añadir comentarios a archivos generados como next-env.d.ts o tsconfig.tsbuildinfo.
- `next.config.ts` activa salida standalone, cabeceras y paquetes nativos externos. La CSP actual conserva concesiones inline; no describirla como protección absoluta.
- `eslint.config.mjs` configura análisis estático; `postcss.config.mjs` configura el procesamiento de estilos.
- `vitest.config.ts` define alias, límites y descubrimiento de tests/**/*.test.ts. `tests/server-only.ts` es un sustituto exclusivo de pruebas para módulos del servidor.
- `playwright.config.ts` configura servidor y navegador E2E. `e2e/core.spec.ts` conserva expectativas antiguas y necesita contrastarse con permisos y revisiones actuales antes de usarlo como aceptación completa.
- `Dockerfile` y `compose.yaml` describen ejecución en contenedores; no demuestran que el motor Docker esté disponible ni que el despliegue haya sido probado.
- `.env.example` documenta nombres de variables sin secretos. `.env.local` contiene valores privados y debe permanecer excluido de Git.

## Mantener documentación y pruebas

Al modificar una regla, actualizar su explicación y el caso que prueba el comportamiento. Separar comprobaciones con dobles de prueba de verificaciones reales. No afirmar cobertura total por el número de pruebas ni registrar como aprobado un caso omitido.
