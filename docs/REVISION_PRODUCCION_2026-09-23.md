# Revisión de preparación para producción

Fecha: 23 de septiembre de 2026. Dictamen: **todavía no aprobar la salida a producción con datos reales**. Hay una base funcional y pruebas automatizadas satisfactorias, pero falta cerrar la verificación operativa y de los flujos completos.

## Alcance y resultados

Revisión del código de autenticación, permisos, consultas, archivos, IA, migraciones, configuración de despliegue y pruebas. No es una auditoría exhaustiva de cada línea ni una prueba de penetración. No se desplegó ni se cambiaron datos remotos. No se ejecutó el recorrido E2E que crea cuentas y registros en el Supabase conectado.

- `npm test`: 98 pruebas aprobadas en 16 archivos. Incluye permisos y migraciones en PostgreSQL embebido; no sustituye Supabase real.
- `npm run build`: compilación de producción correcta, incluida comprobación TypeScript.
- `npm run lint`: correcto.
- `npm run test:supabase`: 9 comprobaciones correctas. Auth y recursos públicos responden; cinco tablas privadas rechazan acceso anónimo. No verifica todas las políticas ni migraciones remotas.
- `npm audit` y `npm audit --omit=dev`: cero vulnerabilidades conocidas reportadas en esta ejecución. No demuestra ausencia de fallos en el código propio.
- `.env.local` está ignorado y no figura entre los archivos versionados actuales. No se revisó todo el historial Git en busca de secretos.

## Bloqueos y prioridades

### 1. Alta: validar migraciones remotas y cerrar una diferencia entre rutas

`src/app/api/commands/route.ts` exige `requireWorkforceSchema` para operaciones de progreso e incorporación. `src/app/api/[...segments]/route.ts` llama directamente al RPC para `course.progress` y `onboarding.complete` sin esa comprobación. Si la base remota conserva las funciones antiguas, esta ruta puede ejecutar el comportamiento anterior pese al bloqueo de la API principal. Con las migraciones correctas, PostgreSQL aplica las nuevas reglas.

Acción: unificar el control y probar ambas rutas contra una base actualizada y una desactualizada. Verificar en staging las migraciones hasta `202609230002_climate_recipients.sql`. Criterio de cierre: una actividad entregada requiere revisión por RH, independientemente de la ruta usada; ninguna ruta continúa con el esquema antiguo.

### 2. Alta: configurar y probar el despliegue real

`compose.yaml` fuerza `SUPABASE_INTERNAL_URL=http://host.docker.internal:54321`, apropiado para Supabase local, pero incompatible con usar directamente el proyecto remoto sin modificar esa configuración. También fuerza `OLLAMA_URL=http://ollama:11434`, mientras Ollama solo se inicia con el perfil `ai`. El proveedor predeterminado es Ollama.

Acción: separar configuración de desarrollo y producción, elegir proveedor IA accesible desde el servidor, gestionar secretos en el alojamiento, configurar dominio/HTTPS y probar registro, sesión, descarga privada y una solicitud IA desde el contenedor desplegado. Verificar el tiempo máximo del alojamiento frente al timeout IA de 45 segundos. Docker y el alojamiento final no se probaron en esta revisión.

### 3. Alta: completar las pruebas de aceptación con servicios reales

`e2e/core.spec.ts` tiene un recorrido central condicionado a credenciales y conserva expectativas de la interfaz anterior, como localizar al contratado dentro de la misma tarjeta. No cubre todos los cambios recientes de revisión, jerarquía, asignación múltiple, clima e historiales. `playwright.config.ts` prueba un servidor de desarrollo.

Acción: actualizar y ejecutar los recorridos contra una instalación de staging con build de producción. Cubrir los cinco roles, acceso ajeno por API, jefes con subordinados indirectos, contratación, agenda duplicada, documentos múltiples, revisión de onboarding/cursos/tareas y privacidad de clima. Criterio: ninguna prueba crítica omitida y evidencia del resultado. Usar datos sintéticos y un proyecto separado.

### 4. Alta antes de operar: recuperación de cuentas y protección del acceso

`src/app/api/auth/[action]/route.ts` implementa registro, login y logout; no hay flujo de recuperación de contraseña en esa ruta. No se encontró integración MFA ni CAPTCHA en la aplicación. Esto no permite concluir que Supabase carezca de límites: su configuración remota no se auditó.

Acción: implementar recuperación y probar correo real, confirmación y enlaces de retorno; verificar SMTP, límites de Auth y protección ante abuso. Exigir una medida adicional para cuentas privilegiadas según el modelo de riesgo. Comprobar el acceso con cuentas demo deshabilitadas en producción.

### 5. Alta antes de operar: recuperación ante fallos y observabilidad

No se encontró evidencia en el repositorio de restauraciones ensayadas, alertas operativas o un procedimiento completo de incidentes. `failure` evita divulgar errores internos, pero registra principalmente su tipo, insuficiente para diagnosticar muchos fallos. Pueden existir controles en el proveedor que no se han verificado.

Acción: comprobar respaldo y restauración de PostgreSQL y archivos de Storage, definir responsables y objetivos de recuperación, alertar ante indisponibilidad y errores IA/Storage/Auth, añadir identificación de solicitudes y logs sin documentos ni secretos. Ensayar rollback de aplicación y migraciones antes de lanzar.

### 6. Alta para cargas grandes: reportes y búsquedas truncados

`src/modules/workspace/queries.ts` descarga hasta 1,000 filas por tabla, generalmente sin orden explícito, y carga múltiples tablas aunque la pantalla solo necesite una parte. Los filtros posteriores y los totales no representan necesariamente todos los registros. El contexto IA reduce aún más los datos a 200 registros por módulo.

Acción: paginación y filtrado en servidor, conteos agregados en base de datos y consultas específicas por módulo. Mientras exista truncamiento, mostrar claramente el alcance. Probar con más de 1,000 filas y comparar indicadores con consultas SQL de referencia.

### 7. Media-alta: endurecer la recepción de archivos

`src/app/api/files/route.ts` usa Content-Length antes de `formData`; sin esa cabecera, el cuerpo se procesa antes de comprobar el tamaño real del archivo. `src/lib/storage/files.ts` valida tamaño, extensión, MIME y firmas, pero no analiza malware ni limita explícitamente el tiempo de procesamiento PDF. Tampoco se comprobó un límite de cuerpo en el alojamiento.

Acción: imponer límite real de solicitudes en el servidor/proxy, definir cuotas y política de cuarentena/análisis de archivos, limitar recursos de extracción PDF y limpiar archivos huérfanos. Probar archivos malformados y fallos entre Storage y SQL. Los enlaces privados de 60 segundos y la autorización previa son controles positivos ya presentes.

### 8. Media-alta: verificar calidad y disponibilidad de IA

Hay esquemas de salida, timeouts y revisión humana, pero las pruebas automatizadas usan respuestas simuladas; no certifican calidad del modelo configurado, ausencia de sesgos ni fidelidad de los resúmenes. El resumen demasiado repetitivo reportado por el usuario evidencia una necesidad de evaluación real.

Acción: crear casos sintéticos con respuestas esperadas, medir errores y tiempos, probar falta de cuota/servicio y establecer presupuesto, mensajes de indisponibilidad y criterios de revisión humana. No presentar la puntuación como decisión de contratación. Verificar qué datos salen al proveedor seleccionado.

### 9. Media: privacidad y ciclo de vida de datos

No se encontró un flujo completo documentado de conservación, eliminación/exportación de expedientes y archivos ni un aviso de uso de IA listo para operación. El anonimato de encuestas depende de reglas de agregación; asignar a una persona no habilita resultados individuales.

Acción: definir con los responsables de la organización los plazos de conservación, accesos y tratamiento de comentarios/documentos, informar a los usuarios y probar eliminación coherente en tablas, Storage y respaldos conforme a la política elegida. Esta revisión no constituye evaluación legal.

### 10. Media: preparar una entrega reproducible

Hay numerosos cambios modificados y archivos nuevos sin registrar. No se encontró `.github` con un flujo CI. El README conserva descripciones anteriores sobre módulos que ya se incorporaron y permisos de jefes.

Acción: revisar el diff completo, actualizar documentación, guardar una versión identificable sin secretos, automatizar lint/pruebas/build y validación de migraciones, y desplegar exactamente esa versión. Evitar que un despliegue omita archivos nuevos.

## Qué ya existe

Autenticación validada en servidor, perfiles activos, RLS y validaciones SQL, schemas estrictos, control de origen, documentos privados, cabeceras de protección, proveedores IA solo en servidor y auditoría restringida. Las pruebas revisadas verifican parte de estos controles. Su presencia no sustituye las comprobaciones del despliegue real.

## Orden recomendado de salida

1. Resolver paridad de rutas y migraciones; preparar una versión completa en Git.
2. Crear staging con configuración de producción, cuentas sintéticas y correo/IA operativos.
3. Ejecutar aceptación de todos los roles, recuperación de cuenta, límites de archivos y pruebas de carga acordes al volumen esperado.
4. Ensayar restauración, rollback y alertas; aprobar las políticas de datos.
5. Iniciar un piloto limitado con responsables de soporte y criterios de aceptación; ampliar tras verificar resultados.

No se asigna un porcentaje de preparación ni una fecha de lanzamiento porque faltan resultados del alojamiento real, volumen esperado y aceptación de usuarios.
