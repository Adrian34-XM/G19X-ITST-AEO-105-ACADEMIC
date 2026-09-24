# Onboarding: planes, seguimiento y documentos

> Actualización del 23 de septiembre: consulta [Revisiones e historiales](REVISIONES_E_HISTORIALES.md). El colaborador entrega y RH confirma; los documentos ahora pertenecen a una actividad.

## Activación

Ejecuta `supabase/migrations/202609220001_onboarding_plans.sql` en el SQL Editor de Supabase si ya tienes las migraciones anteriores. Como alternativa, el archivo actualizado `supabase/activar-mejoras-rh.sql` incluye este bloque y omite los ya instalados.

La migración conserva los procesos, documentos y actividades existentes. Los documentos existentes quedan pendientes de revisión. No se aplicó automáticamente a la base remota desde este entorno.

## Uso

- RH y superadministración crean plantillas por puesto, área o generales. Una plantilla activa por alcance evita ambigüedades. Para corregirla, carga **Editar copia**, desactiva la anterior y guarda su reemplazo. Los planes ya asignados conservan su contenido.
- La contratación elige la plantilla del puesto, luego del área y por último la general. Si no hay plantilla mantiene los cuatro pasos básicos anteriores.
- **Plantillas y planes revisables** permite redactar actividades o solicitar una propuesta de IA. Debe revisarse antes de guardar o asignar. Los jefes pueden preparar planes para sus subordinados; las plantillas globales las administra RH.
- Los plazos se calculan desde la fecha de inicio elegida. Los responsables son la persona incorporada, su jefatura actual o RH. No se asigna una persona concreta de RH: es responsabilidad compartida de los usuarios autorizados de RH.
- Un plan iniciado o con documentos no puede reemplazarse; se permite ajustar responsables y fechas de actividades pendientes o en progreso, no las entregadas para revisión.
- La vista muestra avance, siguiente actividad y atrasos. Las alertas de atraso también aparecen en vista general. Son avisos dentro de la aplicación, no correos ni notificaciones push.
- El empleado sube documentos privados, RH los aprueba o solicita correcciones con comentarios. Cada corrección se sube como una nueva versión; se conserva la entrega anterior. Los jefes ven avances pero no el expediente documental sensible.
- Una actividad documental exige al menos un documento aprobado de esa actividad y ningún archivo pendiente de revisión. Admite varios archivos; RH confirma la actividad después de la entrega del responsable.

## Seguridad y comprobaciones

Los permisos, responsabilidades, revisión humana y bloqueos se comprueban en PostgreSQL, incluyendo la ruta antigua de completar actividades. La IA recibe el nombre del puesto y las instrucciones escritas, nunca archivos del expediente, nombres ni correos recuperados de la base. Sus claves permanecen en el servidor. Evita introducir datos personales en el texto libre.

Pruebas locales: selección de plantilla, aplicación de plazos, aislamiento de equipos, bloqueo de completar actividades ajenas, bloqueo documental, correcciones y nueva entrega, progreso y planes iniciados. La IA se valida con un proveedor simulado; probar un proveedor real y el recorrido remoto requiere activar la migración en Supabase.
