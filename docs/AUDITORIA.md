# Auditoría de cambios

Solo el superusuario puede consultar esta sección. Las rutas del servidor y la política RLS de `audit_logs` mantienen la misma restricción.

La vista muestra acción, módulo, persona que realizó el cambio, rol y fecha. Permite buscar por nombre o registro, filtrar por módulo y tipo de acción, y desplegar los valores anteriores y nuevos disponibles.

Se consultan hasta los 1000 eventos más recientes. Los filtros operan sobre esa muestra, no sobre todo el historial de la base de datos.

## Valores registrados

La migración `202609240002_audit_details.sql` amplía el registro con valores operativos permitidos: nombres, títulos, estados, roles, prioridad, fechas, progreso y asignaciones de puesto, área y jefe. Se conserva el nombre del actor en el momento del evento. Los nombres de registros relacionados se resuelven con los datos disponibles al consultar; si fueron eliminados, se indica que no están disponibles.

No se copian contraseñas, correos, documentos, comentarios ni contenidos de IA. No se añaden eventos sobre respuestas ni recibos de participación en encuestas anónimas. Sí se registran los cambios de la encuesta y las evidencias de capacitación.

## Activación y datos históricos

Ejecuta `supabase/activar-mejoras-rh.sql` en el SQL Editor de Supabase. El nuevo detalle se guarda a partir de esa activación. No es posible reconstruir valores anteriores que no se registraron en eventos históricos; la interfaz informa esa limitación.

Las pruebas locales comprueban valores anteriores y nuevos, la denegación de lectura para RH y jefes, y la cobertura de las nuevas tablas sin auditar respuestas anónimas.
