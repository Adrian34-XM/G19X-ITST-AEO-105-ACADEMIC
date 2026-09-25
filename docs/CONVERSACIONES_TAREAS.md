# Conversaciones por tarea

Cada tarjeta de tarea incluye **Conversación de la tarea**. El botón abre el historial y el campo para escribir aclaraciones. Los mensajes muestran autor, rol al enviar, fecha y texto. No son respuestas de IA y no cambian el estado de la tarea.

El historial se actualiza cada 15 segundos mientras la conversación está abierta y la pestaña visible. También se puede actualizar manualmente. Se cargan 50 mensajes recientes y el botón **Ver mensajes anteriores** permite consultar páginas anteriores.

El empleado responsable, los jefes con alcance autorizado sobre su jerarquía, RH y el superusuario pueden participar. Los permisos se comprueban en servidor y base de datos. No se acepta que el navegador elija el autor. Los mensajes son texto plano, no HTML, y no admiten edición o eliminación desde la aplicación. Máximo 3000 caracteres y 30 mensajes por minuto por usuario. Los reintentos conservan un identificador para evitar duplicados.

Una tarea aprobada conserva su conversación en modo de consulta. El historial también se consulta entrando desde el historial de tareas. Si cambia el responsable o la jerarquía, el acceso se rige por los permisos actuales de la tarea.

## Activación

Sobre la instalación existente, ejecutar `supabase/activar-mejoras-rh.sql` en el SQL Editor de Supabase. Alternativamente, si las migraciones anteriores están aplicadas, ejecutar `supabase/migrations/202609250002_task_conversations.sql` una vez. No es necesario reinstalar la base ni modificar sus datos anteriores.

Sin la migración, la interfaz indica que falta habilitar las conversaciones. Esta versión no envía correo, notificaciones push ni adjuntos: las evidencias siguen en el flujo de entrega de la tarea.

## Verificación

Las pruebas locales comprueban envío del responsable, jefe y RH, aislamiento frente a usuarios ajenos, autor real, rechazo de mensajes vacíos, ausencia de edición, reintentos sin duplicación y lectura del historial de tareas aprobadas. La activación también se prueba ejecutando el archivo acumulativo dos veces.

## Avisos en el orquestador
La vista general muestra mensajes sin leer por tarea y enlaces a la conversación. Los avisos se actualizan cada 15 segundos y respetan los permisos actuales. Los mensajes propios no cuentan. Abrir la conversación marca como leído el lote recibido solo para esa cuenta; las tareas aprobadas conservan sus avisos hasta consultarlas.

El resumen IA incluye cantidades y títulos al generarlo o actualizarlo; no recibe el contenido de los mensajes. Los avisos funcionan aunque el proveedor de IA no esté disponible. Aplica `supabase/activar-mejoras-rh.sql` (incluye la migración `202609250003_task_message_notifications.sql`) para activar la lectura por cuenta. Los mensajes anteriores todavía no consultados también aparecerán como sin leer.
