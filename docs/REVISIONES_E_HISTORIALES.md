# Revisiones, organigrama y análisis (23 de septiembre de 2026)

## Activar en Supabase

Ejecuta el contenido de `supabase/activar-mejoras-rh.sql` en **SQL Editor → New query → Run**. Es repetible: omite los bloques ya instalados. El resultado `revisiones_historiales` debe ser `true`. Si todas las migraciones anteriores están aplicadas, puedes ejecutar una sola vez `supabase/migrations/202609230001_workforce_reviews.sql`.

La migración fue probada en PostgreSQL embebido, incluyendo el activador ejecutado dos veces. No se aplicó a la base remota desde este entorno. Hasta activarla, los comandos de revisión muestran una indicación de actualización y evitan usar el flujo anterior de autoaprobación.

## Organigrama y perfiles

En **Equipo → Incorporar personal y RH al organigrama**, selecciona una cuenta activa y su puesto. Las cuentas de RH necesitan este registro laboral para formar parte del árbol; no se inventa un puesto al crear su cuenta. En el árbol asigna el superior: puede ser un jefe o un responsable de RH activo. Se admiten varios niveles y se rechazan ciclos.

Una persona no puede cambiar su propio puesto, aunque tenga rol RH. Otro RH autorizado o el superadministrador puede administrarlo. Los jefes conservan el alcance de sus subordinados. RH y superadministración conservan su alcance global. El perfil muestra historial de tareas aprobadas, tareas activas, capacitación y un resumen de IA basado en conteos de progreso, sin enviar nombres, correos, expedientes ni evidencias.

## Postulaciones y tareas

La evaluación de IA sigue contrastando el perfil profesional y CV con los requisitos de la vacante. Las tarjetas se ordenan por puntuación descendente; los registros sin una evaluación válida van al final. Se conservan secciones por estado, filtro por vacante y enlaces a los CV. La puntuación es apoyo a la revisión humana, no una decisión automática. El menú separado de recomendaciones se retiró; sus enlaces antiguos redirigen a Postulaciones.

En **Tareas y evidencias** hay pendientes, entregadas por revisar e historial de aprobadas. El responsable revisa la entrega y sus evidencias antes de aprobar. El historial de la persona enlaza a la tarea original y sus comentarios, sin duplicar registros. Se mantienen prioridad, filtros y permisos de jerarquía.

## Onboarding

- RH puede iniciar la incorporación de un colaborador activo que todavía no tenga proceso. Se utiliza la plantilla de su puesto/área o el plan básico, y luego se puede ajustar el plan sin avances.
- La persona responsable marca una actividad como realizada y la envía a revisión (`SUBMITTED`). Para las actividades de tipo persona incorporada, esta entrega corresponde al colaborador; las actividades de jefatura o RH mantienen sus responsables.
- El colaborador puede adjuntar varios archivos por actividad: hasta diez por envío, máximo 5 MB cada uno, PDF, TXT, PNG o JPEG. La interfaz informa los archivos ya guardados si un envío falla parcialmente. Los documentos son privados y los jefes no pueden descargarlos.
- RH revisa los documentos y confirma la actividad o solicita correcciones. Una actividad documental necesita al menos un documento aprobado de esa actividad y no puede tener archivos pendientes de revisión. Las entregas rechazadas se conservan; las correcciones son nuevos archivos.
- Solo cuando RH confirma todas las actividades el proceso pasa a completado. Hay historial de actividades dentro del proceso e historial de procesos completados. Los registros completados antes de esta migración se conservan.
- El resumen de novedades muestra atrasos, entregas pendientes y una opción de resumen IA para los procesos visibles.

Los documentos anteriores sin actividad asociada siguen accesibles como expediente anterior. No se consideran prueba automática de una actividad nueva; debe adjuntarse su documentación específica.

## Capacitación

**Crear capacitación gratuita con IA** recibe puesto, área y descripción. Produce un borrador editable con lecciones, ejercicios y criterios para impartir dentro de la plataforma. Son materiales autocontenidos, sin compras, suscripciones ni enlaces externos inventados; no implica que el proveedor de IA sea gratuito.

Las plantillas guardadas tienen área/puesto opcionales, son buscables y se pueden reutilizar con la asignación múltiple existente. La asignación automática al contratar respeta el área y puesto de la plantilla. El seguimiento separa asignadas, en progreso, entregadas para revisión y completadas. Al declarar 100%, el colaborador entrega el curso; RH o el jefe autorizado confirma o devuelve a 75% con observaciones para realizar correcciones. Se impide la autoaprobación, salvo la excepción administrativa del superusuario. Los cursos completados antes de esta migración conservan su estado.

## Gráficas y privacidad

Desempeño y Analíticas admiten instrucciones como «Incorporaciones por estado en barras» o «Capacitaciones por área en una gráfica circular». Se admiten conteos de tareas, cursos asignados e incorporaciones por estado o área, con hasta tres gráficas. No se genera ni ejecuta JavaScript o SQL de la IA. El servidor comprueba los permisos, vuelve a cargar datos con RLS y calcula los valores; las instrucciones explícitas de formato y agrupación prevalecen sobre la sugerencia del modelo.

Desempeño sustituye los indicadores de contratación por personas en seguimiento e incorporaciones completadas. La búsqueda acepta nombre o área y los nombres enlazan al perfil autorizado. Los resúmenes no representan una evaluación integral del desempeño. La vista está limitada a 1000 registros por tabla; los gráficos reflejan ese conjunto cargado, no totales garantizados para bases mayores. No incluyas datos personales en las instrucciones libres de IA.

## Ambiente laboral

La sección presenta una introducción, encuestas abiertas/cerradas, participación sobre el total invitado, distribución de participación y promedios por pregunta. RH ve sus encuestas autorizadas y los jefes las que administran. Los promedios y comentarios de respuestas solo se publican al cerrar con al menos cinco respuestas.

El buzón permite un comentario independiente por persona y encuesta abierta asignada. Los comentarios y los recibos de participación se guardan en tablas separadas, sin identificador del autor ni hora en el comentario. Nadie puede consultar esas tablas directamente con el rol de sesión. Solo se publican comentarios juntos al cierre con cinco participantes del buzón; no se envían a auditoría sus contenidos. Evitar nombres y datos identificables sigue siendo necesario: el texto libre puede revelar voluntariamente una identidad. Los administradores de infraestructura mantienen acceso técnico; esto no proporciona anonimato criptográfico.

El resumen de IA puede analizar cinco respuestas o cinco comentarios del buzón de una encuesta cerrada, y recibe únicamente el agregado autorizado.

## Verificación

La suite prueba transacciones, aislamiento de equipos, ciclos, restricción de puesto propio, archivos múltiples por actividad, revisión obligatoria, bloqueo de funciones antiguas, estados de cursos, anonimato y respuestas de IA validadas con proveedores simulados. También se realizó una petición real al proveedor configurado desde la pantalla Desempeño: «Incorporaciones por estado en barras», con valores calculados por el servidor. La verificación remota de escrituras nuevas requiere activar el SQL anterior.
