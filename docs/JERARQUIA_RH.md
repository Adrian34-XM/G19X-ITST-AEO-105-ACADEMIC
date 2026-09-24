# Equipo y permisos de jerarquía

En la vista general del organigrama, cada área tiene un recuadro con su nombre y número de integrantes. Las relaciones dentro del área conservan sus líneas. Cuando un jefe pertenece a otra área, su nombre aparece en la tarjeta del subordinado. El filtro por área conserva los superiores externos como contexto.

Para asignar un jefe, escribe parte del nombre del integrante o del jefe en su selector y elige una coincidencia. La búsqueda ignora mayúsculas y acentos. Escribir texto no guarda una asignación: hay que seleccionar una persona y pulsar **Guardar jerarquía**.

## Autoridad sobre RH

- El superusuario puede modificar cualquier integrante de RH.
- Un usuario de RH solo puede modificar a otro RH si es el superior de RH más alto en la cadena de jefes de esa persona, y su cuenta y registro de empleado están activos.
- Un superior intermedio, un compañero de otra rama y un subordinado no pueden modificarlo.
- Un RH sin superiores de RH solo puede ser modificado por el superusuario. No puede cambiar su propia jerarquía.
- La autoridad depende de los vínculos de jefe directo, no del nombre del puesto ni del área.
- El alta inicial de RH en el organigrama corresponde al superusuario, porque todavía no existe una cadena que autorice a otro RH.

La protección cubre cambios de puesto, jefe y estado del empleado. También se comprueba al mover una rama que contiene personal de RH, para evitar eludir la restricción cambiando un antecesor. La prevención de ciclos sigue vigente. Se aplica en PostgreSQL, además de ocultar las acciones no autorizadas en la interfaz.

## Activación

Ejecuta `supabase/activar-mejoras-rh.sql` en el SQL Editor de Supabase. La nueva migración es `202609240001_hr_hierarchy.sql`. Las rutas de edición de empleados y asignación de jefes comprueban que esté instalada antes de guardar.

Las pruebas locales verifican que subordinados y compañeros de otra rama no puedan modificar al superior, que el RH más alto pueda cambiar un puesto subordinado y que el superusuario pueda reorganizar la jerarquía. Estas pruebas no aplican la migración al proyecto Supabase remoto.
