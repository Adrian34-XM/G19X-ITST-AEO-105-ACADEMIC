# Entrevistas, contratación y seguimiento

## Cambios de navegación

- Entrevistas muestra secciones de agendadas, completadas y canceladas, con sus conteos. El calendario se despliega para consultar o agendar; se retiró el buscador genérico.
- Onboarding separa seguimiento, asignación de actividades, edición de plantillas y resumen con IA. Las actividades y documentos de cada persona se abren desde su tarjeta.
- Capacitación separa el catálogo y las asignaciones del seguimiento y revisión, y de la creación con IA.
- Tareas y evidencias presenta primero el título, estado y fecha límite. Las instrucciones, entregas y revisión se despliegan dentro de la tarjeta. Los filtros por personas y el análisis del equipo también se pueden ocultar.

## Contratación

Al confirmar una contratación, RH selecciona el área, el puesto de esa área y, opcionalmente, el jefe directo. Solo se ofrecen empleados activos con perfil activo de jefe o RH. La contratación y la asignación se guardan en una transacción; si alguna validación falla, no queda una contratación parcial.

Las actividades iniciales de incorporación utilizan la plantilla del puesto o área finalmente elegidos. No se usa la plantilla del puesto original de la vacante cuando el destino cambia.

## Fechas de entrevista

El formulario y el servidor impiden agendar fechas u horas pasadas. La base de datos aplica la misma regla para proteger llamadas directas. Una entrevista antigua puede marcarse como completada o actualizar sus notas sin modificar su fecha; no puede reagendarse en el pasado.

## Activación en Supabase

Ejecuta `supabase/activar-mejoras-rh.sql` en el SQL Editor del proyecto Supabase. Este archivo acumulativo comprueba las mejoras ya instaladas y agrega las pendientes. La migración específica es `supabase/migrations/202609230004_interviews_hiring.sql`; requiere las migraciones anteriores.

Sin esta actualización de la base de datos, el formulario de contratación informa que falta activar el esquema y no intenta guardar una asignación que el esquema anterior ignoraría.

## Verificación

Las pruebas de base de datos comprueban el rechazo de entrevistas pasadas, la actualización de entrevistas existentes, la validación del área y puesto, la asignación del jefe y la creación de actividades desde la plantilla de destino. La prueba del archivo acumulativo comprueba que se puede ejecutar dos veces.

La revisión en navegador verifica las secciones y formularios sin contratar a candidatos reales. Ejecutar las pruebas locales no aplica las migraciones al proyecto Supabase remoto.
