# Ideas para el sistema de Recursos Humanos con IA

**Actualizado:** 21 de septiembre de 2026.

Este documento reúne la visión inicial del PRD y las ideas, ampliaciones y correcciones solicitadas durante el desarrollo. Describe lo que se quiere lograr; no certifica que cada función esté terminada o activada en Supabase. Las solicitudes posteriores aquí registradas actualizan las prioridades históricas del PRD y del MVP.

## 1. Visión general

Crear una plataforma integral que conecte reclutamiento, contratación, empleados, equipos, onboarding, capacitación, tareas, evidencias, desempeño, ambiente laboral, analíticas y auditoría. La IA debe ayudar a comprender datos y proponer acciones, respetando siempre los permisos de quien solicita el análisis.

El recorrido principal debe poder demostrarse con información ficticia: candidato → postulación y CV → recomendación → entrevista → contratación → empleado → onboarding → capacitación y tareas → evidencias → seguimiento de desempeño.

## 2. Usuarios y acceso

- **Superadministrador:** gestionar cuentas, dar de alta encargados de RH, administrar roles, áreas y puestos, consultar la auditoría global y realizar todas las acciones de RH conservando su identidad y rol.
- **RH:** gestionar reclutamiento, personas, equipos, incorporación, cursos, encuestas y seguimiento de todas las áreas autorizadas.
- **Jefe:** gestionar y consultar su equipo, incluidos los niveles subordinados cuando haya otros jefes debajo; no acceder a equipos ajenos.
- **Empleado:** consultar su información, tareas, evidencias, cursos, onboarding y encuestas asignadas.
- **Candidato:** gestionar su perfil y CV, consultar vacantes, postularse y dar seguimiento a sus entrevistas y postulaciones.
- Cada rol debe tener su propia vista general y recomendaciones adecuadas a sus funciones.
- Probar el acceso de todos los roles, la confirmación de correos, la desactivación de cuentas y el rechazo de credenciales incorrectas.

## 3. Vista general, novedades y orquestación

- Mostrar novedades y pendientes relevantes al entrar al sistema: entrevistas, cambios de postulación, tareas atrasadas, entregas por revisar, capacitación e incorporación pendientes.
- Presentar recomendaciones de IA sobre distintos procesos, con alcance determinado por el rol y los registros autorizados.
- Incorporar aquí la parte de orquestación: reunir el contexto permitido, elegir el análisis, solicitarlo al proveedor, validar el resultado y mostrar próximos pasos con enlaces a los recursos.
- Mantener visibles las alertas calculadas por el sistema aunque el proveedor de IA esté caído.
- Separar las sugerencias de las acciones: una recomendación no debe contratar, rechazar, aprobar una evidencia, asignar cursos ni modificar permisos automáticamente.
- Conservar los flujos de negocio de contratación que crean empleado, checklist, cursos y tareas iniciales de manera consistente.

## 4. Vacantes y postulaciones

- Crear, editar, publicar y cerrar vacantes con puesto, área, descripción, requisitos, habilidades y experiencia.
- Permitir que el candidato complete su perfil, cargue su CV privado y se postule.
- Recomendar al candidato varias vacantes publicadas compatibles con su perfil mediante IA, explicando la afinidad y permitiendo abrir la vacante para decidir si desea postularse.
- Buscar o filtrar postulaciones por vacante.
- Mostrar cuántos postulados tiene cada vacante, incluyendo las vacantes sin postulaciones.
- Explicar si los conteos incluyen todos los estados o únicamente postulaciones activas, y mantenerlos coherentes con los filtros.
- Gestionar los estados: postulado, en revisión, preseleccionado, entrevista, contratado y rechazado.
- Mostrar varias personas recomendadas, no solamente un CV.
- Permitir elegir una puntuación mínima deseada y ordenar los resultados por afinidad con la vacante.
- Colocar las recomendaciones en la parte superior del listado, con nombre, puntuación, resumen, fortalezas y brechas.
- Vincular cada recomendación con la tarjeta de esa persona y con el acceso autorizado a su CV.
- Distinguir resultados reales de IA de postulaciones pendientes de analizar. No asignar puntuaciones inventadas cuando el proveedor falle.
- Mantener la revisión humana de la preselección y contratación; la puntuación no es una probabilidad de éxito ni una decisión laboral automática.
- Crear postulaciones ficticias con distintos niveles de experiencia para comparar resultados durante las pruebas.

## 5. Entrevistas y contratación

- Agendar entrevistas con fecha, hora, responsable, notas y postulación asociada.
- Permitir editar y cancelar entrevistas, detectando conflictos de horario.
- Mostrar al candidato sus propias entrevistas y evitar acceso a información de otras personas.
- Probar creación, edición, cancelación, liberación de horarios y permisos.
- Al contratar, crear el empleado y sus registros iniciales de incorporación, cursos y tareas sin dejar una contratación incompleta si ocurre un error.

## 6. Equipo y jerarquía organizacional

- Mostrar los distintos jefes y permitir abrir el árbol visual de cada equipo.
- Incluir información breve por integrante: nombre, puesto, área, estado y seguimiento de tareas o progreso.
- Admitir que un jefe tenga otro jefe superior y que existan varios niveles jerárquicos.
- Permitir asignar el jefe directo o superior desde la sección Equipo.
- Aplicar esa jerarquía a la visibilidad de tareas, evidencias, capacitación, desempeño y asignación de encuestas.
- RH puede gestionar las áreas bajo su alcance; cada jefe solo puede reorganizar personas dentro de su jerarquía autorizada.
- Impedir ciclos, como asignar una persona debajo de sí misma o colocar a un jefe bajo uno de sus subordinados.
- Permitir cerrar el árbol después de abrirlo, pulsando nuevamente el jefe seleccionado.
- Mantener una salida segura si se detectan relaciones inconsistentes y mostrar personas sin jefe asignado.

## 7. Onboarding

- Crear un checklist inicial asociado a la contratación y mostrar avance por empleado.
- Permitir completar pasos y cargar documentación en almacenamiento privado.
- Mostrar documentos y cursos iniciales solo a las personas autorizadas.
- Probar la actualización del progreso, la finalización del proceso, las subidas y las restricciones entre empleados.
- Conservar como idea de la visión inicial la asignación de buddy o mentor; no considerarla terminada solo por existir en el PRD.

## 8. Capacitación y aprendizaje con IA

- Mantener un catálogo de cursos, asignaciones, progreso y estado de finalización.
- Analizar el puesto y área del empleado para recomendar capacitación pertinente.
- Considerar los cursos ya asignados o completados y las necesidades disponibles en el contexto autorizado.
- Explicar por qué se recomienda cada curso y permitir revisarlo antes de asignarlo.
- No inventar cursos o identificadores que no existan en el catálogo.
- Conservar como ampliaciones de la visión inicial un tutor de contenidos y cuestionarios generados por IA, revisables antes de usarlos.

## 9. Tareas, evidencias y seguimiento del equipo

- RH y jefes pueden crear tareas con responsable, descripción, prioridad y fecha límite.
- El empleado puede adjuntar evidencias y enviarlas a revisión.
- La IA puede analizar la relación entre evidencia y tarea; la aprobación o rechazo final requiere revisión humana.
- Mostrar claramente tareas asignadas, pendientes, entregadas, aprobadas, rechazadas y atrasadas.
- Alertar sobre tareas vencidas sin confundir una entrega pendiente de revisión con un atraso del empleado.
- Añadir análisis de IA del trabajo del equipo, pendientes y posibles acciones de seguimiento.
- RH consulta todas sus áreas; un jefe consulta únicamente su jerarquía autorizada.
- Probar subidas y descargas, permisos, archivos vacíos, formatos falsos o prohibidos y límites de tamaño.
- Disponer de documentos ficticios PDF, TXT e imágenes para comprobar el flujo.

## 10. Desempeño

- Mostrar indicadores de tareas, cursos, pendientes y cumplimiento, con explicación de sus fórmulas.
- Añadir análisis de IA y recomendaciones por persona, equipo o área, según los permisos.
- Mostrar alertas para dar seguimiento a atrasos o necesidades de capacitación.
- Diferenciar falta de información de un desempeño bajo; un indicador aislado no debe utilizarse como juicio automático sobre una persona.
- Conservar como ideas iniciales la autoevaluación y el feedback asistido, sin presentarlos como funciones ya comprobadas.

## 11. Ambiente laboral

- Crear un apartado propio accesible a RH, jefes y empleados según su función.
- Permitir a RH y jefes crear y asignar encuestas a personas de sus equipos autorizados.
- Tener en cuenta los niveles jerárquicos: un jefe superior puede asignar dentro de su estructura, sin invadir equipos ajenos.
- Permitir responder encuestas y escribir comentarios anónimos con sugerencias de mejora.
- Utilizar IA para resumir cómo está el ambiente laboral del grupo, identificar fortalezas y aspectos por atender, y proponer acciones concretas.
- Poder generar una encuesta con IA y corregir sus preguntas antes de guardarla o publicarla.
- Mantener disponible la creación y edición manual si la IA falla.
- No mostrar quién escribió un comentario ni utilizar el análisis para identificar autores o decidir sanciones.
- El buzón independiente de sugerencias permanece como idea de la visión inicial; los comentarios asociados a encuestas no equivalen a un buzón independiente ya implementado.

### Diseño de privacidad propuesto durante la implementación

Estas medidas son decisiones de implementación, no requisitos numéricos que el usuario haya fijado originalmente:

- Separar el registro de participación de las respuestas; las respuestas no deben contener identificador de empleado ni fecha individual.
- Evitar respuestas duplicadas sin exponer a los responsables quién participó.
- Publicar para un grupo mínimo de cinco personas y analizar solo encuestas cerradas con al menos cinco respuestas.
- Bloquear preguntas y destinatarios después de publicar para evitar cambios que permitan aislar respuestas.
- No exponer comentarios individuales en la interfaz de responsables; presentar resultados agregados.
- Advertir que el texto libre puede identificar a una persona si incluye nombres o detalles únicos, y que los administradores técnicos de infraestructura pueden tener capacidades de acceso distintas a las del usuario de RH.
- Informar de que los comentarios utilizados en un análisis pueden enviarse al proveedor de IA configurado.
- El resumen debe ser orientativo, sin diagnóstico de salud ni inferencias sobre atributos protegidos.

## 12. Analíticas

- Permitir diferentes gráficas y análisis sobre reclutamiento, tareas, capacitación y desempeño.
- Cambiar proceso, área y periodo; ofrecer representaciones en barras y distribución circular.
- Mostrar cantidades y porcentajes legibles, estados vacíos y el alcance de los datos cargados.
- Generar resúmenes o recomendaciones de IA a partir de información autorizada.
- Conservar como ideas iniciales métricas de tiempo de contratación, rotación y reportes ejecutivos; requieren datos suficientes y una definición verificable antes de declararse completas.

## 13. Auditoría

- La consulta de auditoría queda reservada exclusivamente al superadministrador.
- Esta petición posterior sustituye las referencias iniciales a una pantalla de auditoría para RH.
- Mostrar quién realizó la acción, fecha, tipo de recurso, identificador y metadatos útiles de lo modificado.
- Registrar cambios de estado y campos afectados sin copiar claves, documentos completos ni comentarios anónimos.
- Aplicar la restricción en navegación, API y políticas de base de datos.
- Evitar que el registro de auditoría permita vincular una respuesta anónima con su autor.

## 14. Seguridad y conexión de IA

- Conectar Supabase Auth, PostgreSQL y Storage con permisos por rol y políticas RLS.
- Mantener CV, documentos y evidencias en depósitos privados y proporcionar descargas temporales autorizadas.
- Utilizar Gemini desde el servidor, con Ollama como alternativa local configurada explícitamente.
- Guardar claves privadas en el entorno del servidor; no enviarlas al navegador, al chat ni al repositorio.
- Explicar cómo configurar las claves y probar el análisis sin mostrar sus valores.
- Filtrar el contexto antes de enviarlo a la IA; la IA no decide permisos.
- Validar el formato de las respuestas de IA y tratar documentos y comentarios como datos no confiables, no como instrucciones.
- Controlar tiempos de espera, solicitudes repetidas y errores del proveedor con mensajes comprensibles.
- Distinguir errores de credenciales, configuración, modelo no disponible, validación, base de datos y disponibilidad del proveedor.

## 15. Pruebas, documentación y guardado

- Mantener cuentas ficticias para cada rol y facilitar instrucciones de acceso, creación y ejecución local.
- Probar el recorrido completo sin depender de cambios manuales durante la demostración.
- Probar específicamente entrevistas, onboarding, documentos, tareas, evidencias y análisis de IA.
- Comprobar que un jefe no accede a otro equipo y que la jerarquía multinivel respeta los límites.
- Probar ciclos jerárquicos, respuestas duplicadas, grupos pequeños y ausencia de acceso a respuestas individuales.
- Documentar el código en español con explicaciones claras del propósito, permisos y límites de cada módulo.
- Guardar cambios en commits y preparar la subida al repositorio indicado por el usuario, sin incluir secretos. Un commit local no significa que se haya publicado en GitHub.

## 16. Evolución de prioridades

Las siguientes ideas dejaron de ser solamente extensiones opcionales al solicitarse expresamente durante el desarrollo: recomendaciones de varios postulantes con puntuación mínima, novedades y orquestación por rol, árbol de equipos, jerarquía multinivel, capacitación recomendada por puesto, análisis de tareas y desempeño, gráficas filtrables y ambiente laboral con encuestas anónimas y borradores de IA.

Se mantienen fuera del alcance inmediato, salvo una nueva solicitud: nómina, biometría, ERP, bolsas de empleo externas, videollamadas integradas, firma electrónica, aplicación móvil nativa, SSO corporativo, multiempresa completa, evaluación 360 completa y entrenamiento de modelos propios. Las menciones iniciales a predicción avanzada de rotación o burnout no autorizan diagnósticos ni decisiones automáticas sobre personas.

## 17. Estado y pendientes conocidos al actualizar este documento

- Existe implementación local de los módulos principales, recomendaciones de postulantes, filtros, alertas, orquestación por rol, árbol de equipos, gráficas y auditoría ampliada.
- La verificación local del 21 de septiembre registra 70 pruebas aprobadas, incluidas privacidad de encuestas, jerarquía multinivel, citas duplicadas, filtros y permisos. No acredita la activación remota ni la disponibilidad del proveedor de IA.
- El código de ambiente laboral y la ampliación jerárquica cuentan con pruebas locales. Su uso contra Supabase requiere aplicar las migraciones pendientes.
- La activación remota de funciones depende de aplicar las migraciones correspondientes. No se ha confirmado aquí su aplicación en Supabase.
- Las llamadas reales de IA dependen de configuración, cuota, acceso al modelo y disponibilidad del proveedor; una prueba con proveedor simulado no acredita el servicio real.
- Tutor, buddy, cuestionarios formativos y otras ideas iniciales deben verificarse o desarrollarse por separado antes de presentarlas como terminadas.
- El acceso al repositorio de GitHub indicado había fallado con “Repository not found”; no se declara resuelto en este documento.

## 18. Solicitudes recopiladas de este chat

Este registro resume las peticiones del usuario y permite encontrar dónde se desarrollan en el documento. Son requisitos e ideas, no una lista de funciones certificadas como terminadas.

- **Documentos y evidencias:** subir varios archivos ficticios para comprobar el almacenamiento y el análisis, e investigar los errores 422, 502 y 503 mostrando causas comprensibles. Véanse las secciones 9 y 14.
- **Conexión segura de IA:** explicar cómo configurar y probar el proveedor sin exponer su clave de API. Véase la sección 14.
- **Reclutamiento:** recomendar vacantes y postulantes mediante IA y crear postulaciones de prueba. Para el candidato, proponer vacantes publicadas compatibles con su perfil y explicar la afinidad; para RH, comparar candidatos a una vacante.
- **Listado de postulados:** buscar por vacante, contar postulaciones por vacante, recomendar varias personas según una puntuación mínima y mostrar arriba un resumen con enlaces a sus tarjetas y CV.
- **Vista general para todos los roles:** mostrar novedades, notificaciones, recomendaciones específicas de cada usuario y la orquestación de los análisis.
- **Entrevistas y onboarding:** realizar pruebas de sus flujos y corregir los fallos encontrados.
- **Equipos:** mostrar los jefes, abrir un árbol visual con información breve del equipo y permitir volver a cerrarlo. Contemplar jefes con superiores y asignar esas relaciones desde Equipos.
- **Capacitación:** analizar el puesto del empleado y recomendar cursos pertinentes mediante IA.
- **Tareas y desempeño:** analizar el equipo mediante IA, emitir alertas de atrasos y dar recomendaciones. RH debe poder consultar todas las áreas y cada jefe únicamente el equipo autorizado por su jerarquía.
- **Analíticas:** ofrecer diferentes gráficas y análisis de los datos de la plataforma.
- **Auditoría:** reservarla al superadministrador y ampliar la información sobre las acciones realizadas.
- **Ambiente laboral:** permitir a RH y jefes crear y asignar encuestas, recibir comentarios anónimos, obtener resúmenes y recomendaciones mediante IA y generar borradores de encuestas que los responsables puedan corregir.
- **Documentación y respaldo:** explicar el código en español, guardar los cambios con commits y usar el repositorio


## 19. Ampliaciones solicitadas el 21 de septiembre

- El superadministrador hereda las funciones operativas de RH y puede dar de alta a sus encargados.
- Preparar propuestas de vacante con IA, adjuntar datos de referencia, revisar los campos generados y conservar documentos privados en cada vacante.
- Asignar entrevistas mediante calendario con selección de candidato. Bloquear otra entrevista mientras la persona tenga una cita pendiente, incluso para otra vacante; permitir editar, completar o cancelar la cita existente.
- Filtrar por área onboarding, tareas y evidencias, desempeño y analíticas.
- En desempeño, seleccionar personas contratadas y generar mediante IA instrucciones revisables para analizar los indicadores necesarios, limitando la información enviada al proveedor.
- En analíticas, aplicar los filtros al análisis de IA y permitir generar instrucciones adecuadas al proceso y periodo seleccionados.
- Presentar encuestas manuales y recomendadas por IA con tarjetas editables, orden de preguntas, vista previa y respuestas en escala, con una experiencia similar a Google Forms dentro de la plataforma.

Estas ampliaciones cuentan con código local y una [guía de activación](docs/ACTIVAR_MEJORAS_RH.md). La existencia del código no acredita que las migraciones estén aplicadas en Supabase ni que el proveedor remoto de IA esté disponible.


## 20. Selección múltiple y organigrama visual

- Asignar cursos y tareas mediante filtros por área, búsqueda por nombre y selección múltiple. Mostrar una tarjeta de seleccionados que permita quitar personas antes de confirmar.
- Mostrar de entrada el organigrama general permitido por el rol, con tarjetas conectadas. Reducirlo por área conservando superiores necesarios como contexto y permitir contraer ramas.
- Abrir desde cada persona su ficha laboral con información autorizada por rol.
- Aplicar la misma selección por personas al listado de tareas y evidencias y sus análisis. Verificar el alcance en servidor y base de datos, no solo en la interfaz.
