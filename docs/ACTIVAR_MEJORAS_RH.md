# Activar las mejoras de RH, encuestas y agenda

## Paso necesario en Supabase

El código local necesita funciones y tablas nuevas en la base de datos. La clave de API de la aplicación no permite ejecutar migraciones SQL.

1. Abre el proyecto de Supabase que utiliza esta aplicación.
2. Entra a **SQL Editor** y crea una consulta nueva.
3. Copia **todo** el contenido de [activar-mejoras-rh.sql](../supabase/activar-mejoras-rh.sql) y pulsa **Run**.
4. Al terminar, las columnas `orquestacion`, `ambiente_laboral`, `operaciones_rh` y `asignaciones_multiples` deben indicar `true`.
5. Recarga el sistema en el navegador.

El archivo agrupa las migraciones de orquestación, ambiente laboral, operaciones RH y asignaciones múltiples. Aplica los bloques pendientes según sus tablas y se puede repetir en una instalación estándar del proyecto. No elimina los datos existentes. Requiere que las migraciones iniciales del 14 y 15 de septiembre ya estén aplicadas.

## Cómo usar las nuevas funciones

- **Superadministrador → Usuarios → Crear encargado de RH:** completa nombre, correo y contraseña inicial; el formulario propone `RH_ADMIN`. El menú del superadministrador incluye todos los módulos de RH. La auditoría continúa siendo exclusiva del superadministrador.
- **Vacantes → Crear propuesta de vacante con IA:** elige puesto, escribe las necesidades y opcionalmente adjunta PDF/TXT de referencia. La IA prepara campos editables. Revisa y guarda; el borrador no se publica automáticamente. El archivo de referencia para la generación no se conserva. En una vacante guardada, abre **Documentos privados de referencia** para conservar adjuntos accesibles solo a RH y superadministración.
- **Entrevistas:** selecciona el día en el calendario y pulsa **Agendar candidato en este día**. Elige candidato y vacante, horario y entrevistador. Una persona con entrevista pendiente queda excluida de nuevas citas, incluso para otra vacante; primero edita, completa o cancela su entrevista actual. Se conserva la separación mínima de 60 minutos por entrevistador. La agenda usa la zona horaria del navegador.
- **Onboarding y Tareas y evidencias:** selecciona el área para reducir los registros visibles.
- **Desempeño:** selecciona área y persona contratada. Puedes pedir a la IA una propuesta de instrucciones, corregirla y generar el análisis. Sin tareas ni cursos se muestra que faltan asignaciones, sin calificar a la persona.
- **Analíticas:** los filtros de área, persona, proceso y periodo se aplican tanto a los datos visibles como a la solicitud de IA. El selector de representación permite barras o distribución circular. El periodo corresponde a la fecha de creación de los registros, no a la de su finalización.
- **Ambiente laboral:** crea un borrador manual o con IA. Edita cada tarjeta, añade o reordena preguntas y revisa la vista previa. Guarda, selecciona al menos cinco destinatarios y publica. Las respuestas usan escala de 1 a 5 y comentario opcional. El análisis requiere cerrar la encuesta y contar con cinco respuestas. Es un formulario propio de Nexo con una presentación similar a Google Forms; no crea formularios en Google ni envía allí las respuestas.

## Protección de información en IA

El servidor vuelve a comprobar sesión, rol, área y persona. En desempeño y analíticas solo envía identificadores internos, estados, relaciones y fechas; excluye nombres, correos, textos libres, CV, evidencias y respuestas individuales de encuestas. Las instrucciones editables no pueden ampliar ese conjunto. No incluyas datos personales o secretos al redactarlas.

Las claves del proveedor permanecen en el servidor. Las recomendaciones no cambian estados ni toman decisiones sobre contratación o desempeño. Si falla el proveedor, se informa del error y los listados, filtros y gráficas siguen disponibles.

## Límites de verificación

Las pruebas automatizadas usan PostgreSQL embebido y proveedores simulados; no acreditan la disponibilidad del proveedor remoto. La interfaz carga hasta 1000 registros por tabla y los análisis hasta 200 por tabla. Las migraciones se verifican localmente; su activación en el proyecto remoto requiere el paso de SQL Editor descrito arriba.


## Asignar cursos y tareas a varias personas

En un curso pulsa **Asignar** (o **Asignar a mi equipo** para jefes). En Tareas pulsa **Crear**. Filtra por área o busca por nombre; marca personas o selecciona los resultados. La tarjeta de seleccionados conserva la elección al cambiar la búsqueda y permite quitar personas o limpiar la lista. Completa la fecha y confirma hasta 100 destinatarios. Cada tarea tiene sus propias evidencias. Los cursos existentes se omiten sin reiniciar progreso.

RH y el superadministrador pueden asignar a personas activas de las áreas autorizadas. Un jefe solo a su jerarquía. PostgreSQL valida el lote entero; si una persona no está autorizada, no se guarda ninguna asignación. Para activar únicamente esta ampliación sobre una instalación ya actualizada, ejecuta supabase/migrations/202609210002_bulk_assignments.sql; el archivo agrupado de arriba también la incluye y se puede repetir.

## Organigrama y perfiles

Equipo abre la jerarquía general autorizada, con tarjetas, iniciales y líneas de relación. Filtra por área para reducirla: los superiores de otras áreas permanecen atenuados como contexto. Puedes contraer equipos, expandir todo u ocultar el árbol. **Ver perfil** abre puesto, área, ingreso, estado, jefe y seguimiento de tareas y cursos. El correo se muestra en la ficha de RH y superadministración. No se añaden datos de CV ni respuestas anónimas al perfil.

En Tareas y evidencias el mismo selector permite filtrar por varias personas; sin selección se muestran todas las del área. Los análisis y alertas respetan esa selección.

## Planes de onboarding (22 de septiembre)

El activador incluye ahora `202609220001_onboarding_plans.sql`. Para instalaciones que ya tengan las mejoras anteriores, también se puede ejecutar únicamente esa migración. Consulta `docs/ONBOARDING.md` para plantillas, asignación, documentos, permisos y límites. Tras ejecutarlo, `planes_onboarding` debe devolver `true`.


## Revisiones e historiales (23 de septiembre)

El activador incluye `202609230001_workforce_reviews.sql`: RH en el organigrama, entrega/revisión de onboarding y capacitación, documentos por actividad y buzón anónimo. Al terminar, `revisiones_historiales` debe devolver `true`. Consulta [la guía de uso y permisos](REVISIONES_E_HISTORIALES.md).
