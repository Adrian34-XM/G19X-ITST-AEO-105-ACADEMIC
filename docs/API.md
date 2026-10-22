# Referencia de las API de Nexo

Nexo expone rutas HTTP de Next.js para autenticación, administración de personas, reclutamiento, trabajo, archivos, encuestas y análisis de IA. Esta referencia permite consumirlas desde la interfaz y preparar pruebas de integración. Describe el código `9ce4e91`, revisado el **16 de octubre de 2026**; los contratos definitivos están en las rutas y esquemas enlazados.

Base de desarrollo: `http://127.0.0.1:3000`. Las rutas de este documento comienzan en `/api`; no son las URL REST de Supabase. Para instalación, secretos y SMTP consulta el [README](../README.md). Para el flujo de los agentes consulta [Arquitectura y agentes](ARQUITECTURA_Y_AGENTES.md).

## Contenido

- [Convenciones y seguridad](#1-convenciones-y-seguridad)
- [Inventario de rutas](#2-inventario-de-rutas)
- [Autenticación](#3-autenticación)
- [Comandos de negocio](#4-comandos-de-negocio)
- [Adaptador REST](#5-adaptador-rest)
- [Administración de personas](#6-administración-de-personas)
- [Archivos y fotografías](#7-archivos-y-fotografías)
- [Incorporación](#8-incorporación)
- [Capacitación](#9-capacitación)
- [Conversaciones y avisos](#10-conversaciones-y-avisos)
- [Ambiente laboral](#11-ambiente-laboral)
- [Inteligencia artificial](#12-inteligencia-artificial)
- [Ejemplos y verificación](#13-ejemplos-y-verificación)

## 1. Convenciones y seguridad

### Sesión y permisos

Las API privadas utilizan **las cookies de sesión de Supabase Auth** mediante el cliente de servidor. Un token enviado únicamente en `Authorization: Bearer` no sustituye este flujo: estas rutas no implementan un autenticador Bearer independiente. En el navegador, usa solicitudes del mismo origen y `credentials: "same-origin"`.

[authenticate](../src/lib/auth/index.ts) comprueba identidad y perfil activo. Los roles son `SUPERUSER`, `RH_ADMIN`, `JEFE`, `EMPLEADO` y `CANDIDATO`. En esta referencia:

- **RH** suele significar `RH_ADMIN` y `SUPERUSER` para las rutas de administración. La regla de jerarquía de RH es más estricta: ni el superusuario puede modificar desde la aplicación los datos laborales de otro integrante RH; esa edición requiere al RH de mayor jerarquía.
- **Internos** significa RH, `JEFE` y `EMPLEADO`.
- **Sesión activa** exige autenticación, pero el acceso concreto sigue sujeto a RLS y funciones SQL.

Una lista de roles no concede acceso a cualquier persona o registro. Las RPC y las políticas de PostgreSQL comprueban propiedad, jerarquía, estado y relaciones. Algunos recursos ajenos se presentan como `404` porque RLS impide leerlos.

Las escrituras comprueban el origen y rechazan `Sec-Fetch-Site: cross-site`. No intercambies `localhost` y `127.0.0.1` al configurar origen y cookies. La aplicación no ofrece aquí un contrato general de acceso CORS para terceros. Nunca envíes `service_role`, claves del proveedor de IA o credenciales SMTP en una solicitud del navegador.

### Cuerpos parámetros y límites

- JSON: `Content-Type: application/json`; los lectores compartidos admiten hasta **100000 bytes** y devuelven `400` ante JSON mal formado o `413` al exceder el límite.
- Archivos: `multipart/form-data`; al usar `FormData` en el navegador, deja que este genere `Content-Type` y su boundary.
- `UUID`: identificador válido del recurso indicado, no de otro registro relacionado.
- `fecha`: `YYYY-MM-DD`; `instante`: ISO 8601 con zona u offset cuando lo exige el esquema.
- En los catálogos de campos, `?` significa opcional. `null` y `""` se admiten solo donde se especifican. Un campo obligatorio puede permitir texto vacío si no tiene longitud mínima.
- Los contratos marcados `.strict()` rechazan campos adicionales. No agregues identificadores, roles o nombres de campos que la operación no admite.

El lector multipart compartido limita el cuerpo a `5 MiB + 100000 bytes`; algunas rutas rechazan antes un `Content-Length` superior al máximo del archivo más 10000 bytes. El límite del transporte y el del archivo se comprueban por separado.

### Respuestas y errores

No hay un envoltorio universal de éxito. Algunas rutas devuelven `{ result }`, otras `{ ok: true }`, una fila, listas, contenido binario o el JSON de una RPC. El éxito usa `200`, salvo los `201` indicados en cada sección.

Los [errores compartidos](../src/lib/api.ts) tienen estas formas:

```json
{ "error": "Inicia sesión para continuar." }
```

```json
{
  "error": "Datos inválidos.",
  "fields": [{ "path": "payload.title", "message": "Mensaje de validación" }]
}
```

```json
{ "error": "Ya hay un análisis en curso.", "code": "AI_IN_PROGRESS" }
```

| Estado | Significado habitual                                                          |
| ------ | ----------------------------------------------------------------------------- |
| `400`  | JSON o formulario inválido, credenciales o enlace de autenticación no válidos |
| `401`  | Sesión ausente o no válida                                                    |
| `403`  | Perfil inactivo, origen, rol o recurso no autorizado                          |
| `404`  | Ruta, operación o recurso no encontrado o no visible                          |
| `409`  | Duplicado, dependencia, estado incompatible o revisión ya procesada           |
| `413`  | Cuerpo o carga demasiado grande                                               |
| `422`  | Contrato, regla de negocio, alcance temático o respuesta factual inválidos    |
| `429`  | Cuota de IA u otra restricción traducida desde SQL                            |
| `502`  | Fallo al completar una operación con IA o almacenamiento                      |
| `503`  | Servicio, esquema o migración no disponible; fallo inesperado ocultado        |
| `504`  | Tiempo de IA agotado en los flujos que lo traducen expresamente               |

`AI_IN_PROGRESS` incorpora `Retry-After: 5`. Ese valor no garantiza que el modelo haya terminado. `AI_OUT_OF_SCOPE` señala una consulta ajena al módulo; `AI_SCOPE_UNAVAILABLE` indica que no pudo verificarse su alcance. No todos los errores llevan `code` ni todos los endpoints utilizan todos los estados de la tabla.

La paginación y los límites descritos son topes de la implementación, no un total de todos los registros. Respeta `Cache-Control: no-store` cuando se devuelva y no publiques cookies, enlaces de acceso o URL firmadas.

## 2. Inventario de rutas

El código contiene **23 archivos de rutas**. Las rutas dinámicas amplían este inventario con las acciones y recursos detallados más adelante.

| Ruta o familia             | Métodos exportados       | Función                                       |
| -------------------------- | ------------------------ | --------------------------------------------- |
| `/api/auth/{action}`       | POST                     | Registro, sesión y enlaces de acceso          |
| `/api/auth/destination`    | GET                      | Destino del rol actual                        |
| `/api/commands`            | POST                     | Comandos de negocio validados                 |
| `/api/{...segments}`       | GET, POST, PATCH, DELETE | Adaptadores REST por recurso                  |
| `/api/admin/users`         | POST                     | Crear cuenta e invitar                        |
| `/api/teams`               | POST                     | Asignar jefe directo                          |
| `/api/employee-assignment` | POST                     | Completar asignación tras contratar           |
| `/api/profile-corrections` | GET, POST                | Solicitar y revisar correcciones              |
| `/api/files`               | GET, POST                | Cargar y consultar documentos privados        |
| `/api/profile-photo`       | GET, POST, DELETE        | Foto propia y consulta autorizada             |
| `/api/vacancy-documents`   | GET, POST                | Referencias documentales de vacantes          |
| `/api/assignments`         | POST                     | Asignación múltiple de tareas o cursos        |
| `/api/onboarding-plans`    | GET, POST                | Plantillas, actividades y planes              |
| `/api/onboarding-learning` | GET, POST                | Materiales y evaluación de lectura            |
| `/api/training`            | GET, POST, PATCH         | Evidencias, recursos y revisión de avances    |
| `/api/task-messages`       | GET, POST, PATCH         | Conversaciones y confirmación de lectura      |
| `/api/application-updates` | GET                      | Avances propios de candidatura                |
| `/api/climate`             | GET, POST                | Encuestas, respuestas, comentarios y análisis |
| `/api/climate/overview`    | GET                      | Novedades de ambiente laboral para RH         |
| `/api/ai/{useCase}`        | POST                     | Reclutamiento y evidencias de tareas          |
| `/api/ai/vacancy`          | POST                     | Propuesta de vacante                          |
| `/api/ai/orchestrate`      | POST                     | Resúmenes y recomendaciones por módulo        |
| `/api/ai/workforce`        | POST                     | Gráficas, perfiles y propuestas formativas    |

Las rutas dedicadas tienen prioridad sobre la familia genérica. No se debe interpretar que cualquier recurso admite todos los métodos exportados por el adaptador: se admiten sus ramas y operaciones explícitas.

## 3. Autenticación

Fuente: [auth/{action}/route.ts](../src/app/api/auth/[action]/route.ts). Todos los cuerpos siguientes son JSON. Estas acciones gestionan cookies a través de Auth; no devuelven la contraseña ni un par de tokens como contrato de login.

| POST a               | Cuerpo                                                   | Éxito                                                                                                    |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/api/auth/login`    | `email`, `password`, `full_name?`                        | `{ redirect }` al destino del rol; puede devolver mensaje para confirmar correo                          |
| `/api/auth/register` | `email`, `password`, `full_name?`                        | `{ message, redirect: "/login" }` sin iniciar sesión definitiva                                          |
| `/api/auth/logout`   | Sin cuerpo necesario                                     | `{ redirect: "/login" }`                                                                                 |
| `/api/auth/recover`  | `email`                                                  | `{ message }` genérico para no enumerar cuentas                                                          |
| `/api/auth/confirm`  | `token_hash`, `type`                                     | Registro: `{ message, redirect: "/login" }`; invitación o recuperación: `{ redirect: "/auth/password" }` |
| `/api/auth/callback` | `{ code }` **o** `{ access_token, refresh_token, type }` | Confirma sesión/enlace; devuelve redirección y, cuando corresponde, mensaje                              |
| `/api/auth/password` | `password`, `confirm_password`                           | Con sesión válida y perfil activo: `{ message, redirect: "/login" }`; cierra sesiones globalmente        |

Límites: correo válido de hasta 254 caracteres; contraseña de 12–128; nombre opcional de 1–150 tras recorte. En `password`, la confirmación debe coincidir. `type` admite `signup`, `invite` o `recovery`. `token_hash` admite 1–2048 caracteres; `code`, 1–4096; `access_token`, 1–16384; `refresh_token`, 1–4096.

`GET /api/auth/destination` exige sesión activa y devuelve `{ destination }`: `/admin`, `/rh`, `/manager`, `/employee` o `/candidate`. Fuente: [destination/route.ts](../src/app/api/auth/destination/route.ts).

El registro público crea candidatos según el flujo de Auth y sus triggers. Una respuesta genérica de registro o recuperación no demuestra entrega SMTP ni existencia del correo. Las pantallas `/auth/confirm` y `/auth/password` son rutas de interfaz, distintas de las API anteriores.

## 4. Comandos de negocio

`POST /api/commands` exige sesión activa y recibe:

```json
{
  "op": "department.save",
  "payload": { "name": "Área de demostración" }
}
```

Para asignar el encargado de Recursos Humanos, el superadministrador envía `POST /api/commands` con `{"op":"department.manager.save","payload":{"department_id":"UUID_DEL_AREA_RH","employee_id":"UUID_DEL_EMPLEADO"}}`. Para retirarlo, usa `"employee_id":""`. La respuesta exitosa de la RPC es `200` con `{ "ok": true, "employee_id": "..." }`; un destino no elegible produce `422`, un rol insuficiente `403` y una migración pendiente `503`.

Fuente: [commands/route.ts](../src/app/api/commands/route.ts) y [schemas.ts](../src/modules/commands/schemas.ts). Las respuestas de éxito son `200` con el JSON devuelto por la RPC; no se envuelven automáticamente en `data` ni en `ok`. La operación desconocida produce `404`.

La API valida el cuerpo y las migraciones necesarias; SQL autoriza cada acción. Para altas administrativas de Auth usa `/api/admin/users`, no `profile.admin` por sí solo.

### Catálogo de operaciones y campos

Convenciones de esta tabla: `corto` = texto recortado de 1–150 caracteres; `texto` = 1–14000; `id` = UUID. Todos los campos son obligatorios salvo `?`.

| `op`                      | `payload`                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `department.save`         | `id?`, `name: corto`                                                                                                                                                                                                             |
| `department.delete`       | `id`                                                                                                                                                                                                                             |
| `department.manager.save` | `department_id`, `employee_id: UUID o cadena vacía` — solo `SUPERUSER`; asigna, cambia o quita al encargado del área Recursos Humanos. El destino debe ser un empleado activo y tener perfil activo con rol `RH_ADMIN` o `JEFE`. |
| `position.save`           | `id?`, `name: corto`, `department_id: UUID`                                                                                                                                                                                      |
| `position.delete`         | `id`                                                                                                                                                                                                                             |
| `profile.admin`           | `id`, `role: uno de los cinco roles`, `active: boolean`                                                                                                                                                                          |
| `candidate.save`          | `phone: string hasta 40`, `skills: corto[] hasta 40`, `experience_years: number 0–80`                                                                                                                                            |
| `vacancy.save`            | `id?`, `position_id`, `title: corto`, `description: texto`, `requirements: texto`, `skills: corto[] hasta 40`, `experience_required: number 0–80`, `status: DRAFT/PUBLISHED/CLOSED`                                              |
| `vacancy.delete`          | `id`                                                                                                                                                                                                                             |
| `application.create`      | `vacancy_id: UUID`                                                                                                                                                                                                               |
| `application.withdraw`    | `id` de postulación                                                                                                                                                                                                              |
| `application.status`      | `id`, `status: EN_REVISION/PRESELECCIONADO/RECHAZADO`                                                                                                                                                                            |
| `application.hire`        | `id`, `department_id?`, `position_id?`, `manager_id?: UUID o ""`                                                                                                                                                                 |
| `interview.save`          | `id?`, `application_id`, `scheduled_at: instante con zona`, `interviewer_id`, `notes: string hasta 4000`, `status: SCHEDULED/COMPLETED/CANCELLED`                                                                                |
| `interview.cancel`        | `id`                                                                                                                                                                                                                             |
| `employee.enroll`         | `profile_id`, `position_id`, `manager_id: UUID o ""`                                                                                                                                                                             |
| `employee.save`           | `id`, `position_id`, `manager_id: UUID o ""`, `status: ACTIVE/INACTIVE`                                                                                                                                                          |
| `onboarding.complete`     | `id` de actividad                                                                                                                                                                                                                |
| `course.save`             | `id?`, `title: corto`, `description: texto`, `content: texto`, `duration_minutes: entero 1–10000`, `required: boolean`, `department_id?: UUID o ""`, `position_id?: UUID o ""`                                                   |
| `course.delete`           | `id`                                                                                                                                                                                                                             |
| `course.assign`           | `id` del curso, `employee_id`, `due_date: fecha`                                                                                                                                                                                 |
| `course.progress`         | `id` de asignación, `progress: entero 0–100`                                                                                                                                                                                     |
| `course.review`           | `id` de asignación, `status: COMPLETED/IN_PROGRESS`, `comments: texto`                                                                                                                                                           |
| `task.save`               | `id?`, `title: corto`, `description: texto`, `employee_id`, `priority: LOW/MEDIUM/HIGH`, `due_date: fecha hábil`                                                                                                                 |
| `task.status`             | `id`, `status: IN_PROGRESS/APPROVED/REJECTED`, `comments?: string hasta 4000`                                                                                                                                                    |

`candidate.save` actualiza el perfil de candidato asociado a la sesión; no admite un `id` arbitrario. Los `id` opcionales de guardado distinguen alta y edición, sujetos a SQL.

Reglas relevantes:

- Para postularse se exige CV previo; los duplicados o requisitos de retiro/repostulación pueden producir `409`.
- Contratar requiere las condiciones de entrevista y asignación verificadas por SQL. La IA no ejecuta la contratación.
- Las tareas usan días hábiles de México. Al crear, reprogramar o reactivar entrevistas se comprueba fecha futura y calendario; cerrar una cita histórica sin cambiar su fecha tiene tratamiento propio.
- Los avances de capacitación requieren las evidencias y revisiones correspondientes. Declarar `100` no equivale a completar automáticamente el curso.
- Eliminar áreas, puestos, cursos o vacantes puede rechazarse por dependencias o estado.
- Los comandos internos `ai.begin`, `file.attach` y `audit.access` utilizados por otras rutas **no** forman parte del catálogo público de este endpoint: no están en `schemas`.

## 5. Adaptador REST

Fuente: [api/{...segments}/route.ts](../src/app/api/[...segments]/route.ts). Todas estas lecturas exigen sesión aunque el catálogo de vacantes también se muestre en páginas públicas de la aplicación.

### Listas y detalle

`GET /api/{recurso}?page=0` y `GET /api/{recurso}/{id}` admiten:

`vacancies`, `candidates`, `applications`, `interviews`, `employees`, `courses`, `tasks`, `onboarding`, `course-assignments`, `departments`, `positions`, `profiles` y `audit`.

`audit` exige `SUPERUSER`; las demás lecturas conservan RLS. Las evaluaciones internas de postulaciones solo se incorporan cuando el lector está autorizado.

- `page` es entero de 0 a 10000, predeterminado `0`.
- La lista ordena por `id` y devuelve `{ data: [...], page, page_size: 50 }`.
- El detalle devuelve la fila directamente y `404` si no existe o no es visible. No incorpora `page_size` ni un envoltorio `data`.
- La lista no devuelve un `total`. No hay filtros generales `search`, `status` o `department` en este adaptador; no confundirlo con los filtros de IA.

### Lecturas especializadas

| GET                               | Respuesta                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/candidates/{id}/cv-url`     | Delega en `/api/files` con bucket `cvs` e ID del candidato                                                                                        |
| `/api/analytics/kpis`             | RH: `active_employees`, `active_vacancies`, `candidates`, `hires`, `completed_courses`, `completed_tasks`, `overdue_tasks`, `average_performance` |
| `/api/performance/me`             | Indicadores del empleado de la sesión                                                                                                             |
| `/api/performance/employees/{id}` | Indicadores del empleado visible por RLS                                                                                                          |
| `/api/onboarding/me`              | Proceso propio con `onboarding_items` anidados                                                                                                    |

Los indicadores de desempeño son `{ task_completion, course_completion, overall_score, signal }`. `overall_score` pondera 60 % de tareas aprobadas y 40 % de asignaciones de cursos completadas, redondeado a dos decimales. `signal` es `GREEN`, `YELLOW` o `RED`. No es una evaluación generada por IA. Los KPI cargan hasta 1000 filas por tabla.

### Escrituras de compatibilidad

El cuerpo se envía directamente, **sin** `{ op, payload }`. El adaptador obtiene el ID de la URL y aplica el contrato del comando indicado. Sus respuestas son `201` para POST y `200` para PATCH o DELETE con el JSON de la RPC.

| Método y ruta                                                             | Comando o delegación                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /api/vacancies` · `PATCH /api/vacancies/{id}`                       | `vacancy.save`                                                               |
| `DELETE /api/vacancies/{id}`                                              | `vacancy.delete`                                                             |
| `POST /api/applications`                                                  | `application.create`                                                         |
| `PATCH /api/applications/{id}/status`                                     | `application.status`                                                         |
| `POST /api/applications/{id}/hire`                                        | `application.hire` solo con ID; el adaptador no lee el cuerpo de esta acción |
| `POST /api/interviews` · `PATCH /api/interviews/{id}`                     | `interview.save`                                                             |
| `DELETE /api/interviews/{id}`                                             | `interview.cancel`                                                           |
| `PATCH /api/employees/{id}`                                               | `employee.save`                                                              |
| `POST /api/courses` · `PATCH /api/courses/{id}`                           | `course.save`                                                                |
| `DELETE /api/courses/{id}`                                                | `course.delete`                                                              |
| `POST /api/courses/{id}/assign`                                           | `course.assign`                                                              |
| `PATCH /api/course-assignments/{id}/progress`                             | `course.progress`                                                            |
| `POST /api/tasks` · `PATCH /api/tasks/{id}`                               | `task.save`; si el cuerpo contiene `status`, pasa a `task.status`            |
| `PATCH /api/candidates/{id}`                                              | `candidate.save` del candidato de la sesión                                  |
| `POST /api/departments`                                                   | `department.save`                                                            |
| `POST /api/positions`                                                     | `position.save`                                                              |
| `PATCH /api/onboarding/items/{id}`                                        | `onboarding.complete`; enviar `{}`                                           |
| `POST /api/candidates/cv`                                                 | Multipart: delega carga de CV                                                |
| `POST /api/tasks/{id}/evidence`                                           | Multipart: delega carga de evidencia de tarea                                |
| `POST /api/onboarding/{id}/documents`                                     | Multipart: delega carga; también requiere `item_id`                          |
| `POST /api/ai/recruitment/recommend` · `POST /api/ai/recruitment/summary` | Delega al análisis de reclutamiento, cuerpo `{ id }` de postulación          |
| `POST /api/ai/task-verification`                                          | Delega a evidencia, cuerpo `{ id }` de evidencia                             |

Las tres ramas de carga, las dos ramas de IA y la rama `onboarding/items/{id}` se evalúan antes del mapa de comandos del adaptador compartido por POST, PATCH y DELETE. La tabla muestra sus usos convencionales; no son endpoints independientes con contratos adicionales. Para nuevas integraciones prefiere `/api/files`, `/api/ai/{useCase}` y `/api/onboarding-plans`.

Para contratar indicando puesto, área o jefe usa `/api/commands` con `application.hire`. Para retirar una candidatura o eliminar un área/puesto usa también el comando correspondiente. No supongas que existe un alias REST para cada comando.

La migración `202610220001_hr_department_manager.sql` crea el área Recursos Humanos si aún no existe y añade `departments.manager_employee_id`. El área canónica queda protegida: RH puede consultar el registro, pero solo `SUPERUSER` puede renombrarla, eliminarla o gestionar a su encargado. La operación `department.manager.save` pasa por `/api/commands` y la RPC `save_department_manager`; PostgreSQL exige `SUPERUSER` y comprueba que el encargado sea un empleado activo con perfil activo y rol `RH_ADMIN` o `JEFE`. Enviar `employee_id: ""` quita al encargado. En la interfaz de **Administración → Áreas**, RH ve el nombre del encargado sin controles de edición.

La migración `202610220002_hr_area_hierarchy.sql` amplía la validación de superiores para aceptar jefes activos y responsables RH activos, y modifica `command('employee.enroll', ...)`: si el puesto elegido pertenece al área canónica Recursos Humanos, `manager_id` se establece en el encargado guardado en `departments.manager_employee_id`. El cliente no puede reemplazar ese valor; si no hay encargado activo, devuelve `HR_DEPARTMENT_MANAGER_REQUIRED` o `INVALID_MANAGER` y no crea el registro. Para otras áreas, se conserva el superior enviado en la operación. El encargado RH puede enlazar una sola vez registros RH existentes que no tengan jefe directo; después, los cambios de puesto y superior de cualquier persona del área RH requieren al RH de mayor jerarquía de su cadena. PostgreSQL valida roles, vigencia y ciclos. La API requiere `hr_hierarchy_version() >= 3`, por lo que se debe aplicar esta migración antes de usar el alta.

## 6. Administración de personas

### Alta de cuenta e invitación

`POST /api/admin/users` — **SUPERUSER**. Fuente: [admin/users/route.ts](../src/app/api/admin/users/route.ts).

JSON: `email` válido hasta 254 caracteres, `full_name` de 1–150 y `role` de los cinco roles. Devuelve **201** `{ id, message }`. No admite contraseña: la persona la define al aceptar su invitación. Si falla un paso posterior intenta compensar la cuenta creada; un fallo de limpieza puede dejarla creada y el mensaje lo advierte. La respuesta de la API no acredita recepción en el buzón.

### Jefe directo y asignación posterior a contratación

- `POST /api/teams` — RH o jefe: `{ employee: UUID, manager: UUID | null }` → `{ ok: true }`. Comprueba alcance y ciclos jerárquicos. Fuente: [teams/route.ts](../src/app/api/teams/route.ts).
- `POST /api/employee-assignment` — RH: `{ employee, department, position, manager: UUID | null }` → `{ ok: true }`. Completa una asignación pendiente tras la contratación; valida que el puesto pertenezca al área. Fuente: [employee-assignment/route.ts](../src/app/api/employee-assignment/route.ts).

### Correcciones del perfil laboral

Fuente: [profile-corrections/route.ts](../src/app/api/profile-corrections/route.ts).

- `GET /api/profile-corrections?employee={UUID}` — internos, con RLS: `{ rows }`, hasta 100 solicitudes ordenadas de más reciente a más antigua.
- `POST /api/profile-corrections`, `action: "request"` — internos, con autorización SQL: `{ action, employee, field, value, reason }`. `field` es `full_name` o `hire_date`; `value` admite 1–150 caracteres y `reason`, 1–1000 tras recorte. Para fecha utiliza `YYYY-MM-DD` y respeta la validación SQL del campo.
- Mismo POST, `action: "review"` — RH: `{ action, id, approve: boolean, comment }`, comentario recortado de 1–1000.

Ambos POST devuelven `{ ok: true }`. Una solicitud pendiente duplicada o ya revisada produce `409`.

## 7. Archivos y fotografías

### Documentos privados

Fuente: [files/route.ts](../src/app/api/files/route.ts). `POST /api/files` exige sesión y multipart con `bucket`, `file` y los campos correspondientes:

| `bucket`               | Campos y significado                                                 | Formato y máximo            |
| ---------------------- | -------------------------------------------------------------------- | --------------------------- |
| `cvs`                  | Candidato de la sesión; no requiere `id`                             | PDF o TXT UTF-8, 5 MiB      |
| `task-evidence`        | `id` de **tarea** propia                                             | PDF, TXT, PNG o JPEG, 5 MiB |
| `onboarding-documents` | `id` del **proceso** propio y `item_id` de **actividad**             | PDF, TXT, PNG o JPEG, 5 MiB |
| `course-evidence`      | `id` de **asignación de curso** propia y `progress` entero **1–100** | PDF, TXT, PNG o JPEG, 5 MiB |

La actividad de incorporación debe pertenecer al proceso y admitir documentos en su estado actual. Se comprueban tamaño, extensión, MIME y cabeceras; una validación de formato no certifica ausencia de malware. Éxito: **201**, JSON devuelto por la RPC de asociación.

`GET /api/files?bucket={bucket}&id={UUID}` devuelve:

```json
{
  "url": "URL_FIRMADA_TEMPORAL",
  "expires_in": 60,
  "mime_type": "application/pdf"
}
```

En esta **lectura**, `id` es el del **candidato** para `cvs` o el del **registro de evidencia/documento** para los otros buckets. No es el mismo ID de tarea o asignación utilizado en la carga.

- Añadir `preview=1` devuelve `{ url, mime_type }` con una URL local autorizada.
- `preview=content` devuelve el **contenido binario** con MIME, `private, no-store`, `nosniff` y restricciones de marco/CSP.
- Sin `preview`, el enlace firmado admite descarga durante 60 segundos. No debe registrarse como una URL pública permanente.

### Foto de perfil

Fuente: [profile-photo/route.ts](../src/app/api/profile-photo/route.ts).

- `POST /api/profile-photo`: sesión activa; multipart con **solo `file`**, PNG o JPEG hasta 2 MiB. Rechaza `id` y `profile_id`: modifica únicamente la foto propia. Normaliza a PNG de 512 × 512 y devuelve **201** `{ photo_path }`.
- `DELETE /api/profile-photo`: quita la foto propia, sin cuerpo necesario; devuelve `{ photo_path: null }`.
- `GET /api/profile-photo?id={UUID de perfil}`: consulta autorizada por RLS; devuelve **PNG binario**, no `{ url }`, con `private, no-store` y `Vary: Cookie`. Foto ausente o no visible: `404`.

La normalización limita dimensiones a 6000 píxeles por lado y 16 megapíxeles. No admite SVG como foto.

### Referencias documentales de vacantes

Fuente: [vacancy-documents/route.ts](../src/app/api/vacancy-documents/route.ts). Todas estas operaciones exigen **RH**.

- `GET /api/vacancy-documents?vacancy={UUID}` → `{ documents: [{ id, filename, created_at }] }`.
- Añadir `id={UUID del documento}` → `{ url }` firmada durante 60 segundos; exige pertenencia a la vacante indicada.
- `POST /api/vacancy-documents`: multipart `vacancy` y `file`; PDF o TXT hasta 5 MiB. Devuelve **201** `{ ok: true }`.

## 8. Incorporación

### Planes plantillas y revisión

Fuente: [onboarding-plans/route.ts](../src/app/api/onboarding-plans/route.ts) y [schemas.ts](../src/modules/onboarding/schemas.ts).

`GET /api/onboarding-plans` — RH o jefe: devuelve `{ templates }` activas, de más reciente a más antigua.

`POST /api/onboarding-plans` — internos; JSON `{ op, payload }`. SQL distingue acciones propias y de gestión. `ai.draft` se restringe además a RH o jefe y no publica el plan.

| `op`               | `payload`                                                                              |
| ------------------ | -------------------------------------------------------------------------------------- |
| `plan.start`       | `employee_id`                                                                          |
| `template.save`    | `title`, `steps`, `position_id: UUID o null`, `department_id: UUID o null`             |
| `template.disable` | `id` de plantilla                                                                      |
| `plan.apply`       | `id` de proceso, `start_date: fecha`, y **exactamente uno** de `template_id` o `steps` |
| `item.complete`    | `id` de actividad                                                                      |
| `item.save`        | `id` de actividad, `owner_role`, `due_date: fecha`                                     |
| `item.review`      | `id` de actividad, `status: COMPLETED/IN_PROGRESS`, `comments: 1–2000`                 |
| `document.review`  | `id` de documento, `status: APPROVED/REJECTED`, `comments: 1–2000`                     |
| `ai.draft`         | `position_id`, `context: string hasta 1500`                                            |

`steps` tiene de 1 a 30 objetos: `title` recortado de 1–160, `description` hasta 2000, `owner_role: EMPLOYEE/MANAGER/HR`, `days` entero 0–365 y `requires_document: boolean`. La plantilla usa `title` de 1–160.

Éxito de operaciones ordinarias: JSON de `onboarding_command`; de IA: `{ draft: { title, steps } }`. Un plan con avances puede impedir reemplazarlo (`409`); pueden faltar documentos, revisión o evaluación de lectura (`422`). El borrador generado requiere revisión y aplicación explícita.

### Materiales y evaluación de lectura

Fuente: [onboarding-learning/route.ts](../src/app/api/onboarding-learning/route.ts).

- `GET /api/onboarding-learning?id={UUID de actividad}`: sesión activa, lectura autorizada por RPC. Devuelve la configuración visible y, si hay material, `url` firmada durante 60 segundos. La lectura del participante no entrega las respuestas correctas de la evaluación.
- `POST` JSON: `{ id, answers }`, donde `answers` contiene 1–20 enteros de 0–5, índices de las opciones. Registra un intento autorizado y devuelve el JSON de calificación de la RPC.
- `POST` multipart — RH o jefe: `id`, `instructions` recortado de 1–2000, `minimum` entero 1–100, `questions` como **texto JSON** y `file` obligatorio. Guarda configuración y material autorizado y devuelve el JSON de la RPC.

Cada pregunta contiene `question` de 3–400, `options` con 2–6 textos de 1–200 y `correct` entero desde 0, menor que la cantidad de opciones. La configuración admite hasta 20 preguntas. El archivo utiliza los formatos y el máximo de los documentos de incorporación. No envíes los campos del formulario como un JSON de configuración: JSON y multipart activan operaciones diferentes.

## 9. Capacitación

### Asignación múltiple

`POST /api/assignments` — RH o jefe. Fuente: [assignments/route.ts](../src/app/api/assignments/route.ts).

```json
{
  "kind": "course",
  "employees": ["11111111-1111-4111-8111-111111111111"],
  "payload": {
    "id": "22222222-2222-4222-8222-222222222222",
    "due_date": "2026-11-10"
  }
}
```

Los UUID del ejemplo son ficticios. `employees` exige 1–100 IDs distintos. Para `kind: "course"`, `payload` es `{ id del curso, due_date }`. Para `kind: "task"`, contiene `title`, `description`, `priority` y `due_date` con el contrato de `task.save`, sin `id` ni `employee_id`. La RPC valida el conjunto en una transacción y devuelve su JSON; no amplía el equipo autorizado.

### Evidencias recursos y revisión

Fuente: [training/route.ts](../src/app/api/training/route.ts).

- `GET /api/training?assignment={UUID}`: sesión activa y RLS; `{ evidence: [{ id, progress, created_at }] }` de más reciente a más antigua.
- `POST /api/training`: internos, JSON `{ mode, id, prompt? }`; `prompt` recortado hasta 1500, predeterminado `""`.
- `mode: "resources"`: `id` del **curso**. Devuelve `{ result: { resources: [...] } }`, con objetos `title`, `kind: VIDEO/RESOURCE`, `query` y `reason`; el contrato admite 1–5. Son términos de búsqueda propuestos, no enlaces cuya disponibilidad se haya comprobado.
- `mode: "evidence"`: `id` de **evidencia de capacitación**, no de la asignación. Solo RH o jefe autorizado sobre otra persona; rechaza la autoevaluación. Devuelve `{ result: { summary, demonstrated, missing, recommendation } }`; `recommendation` admite `SUFFICIENT`, `MORE_EVIDENCE` o `HUMAN_REVIEW`. La IA no cambia porcentajes ni aprueba el curso.
- `PATCH /api/training`: RH o jefe, JSON `{ assignment: UUID, decision: "ACCEPT" | "REJECT", percentage: entero 0–100, comments: texto recortado 1–2000 }` → `{ ok: true }`.

Un avance ya revisado produce `409`. Al rechazar, el porcentaje no puede superar el último aprobado (`422`). Para cargar la evidencia usa `/api/files`, bucket `course-evidence`.

## 10. Conversaciones y avisos

### Mensajes de tareas

Fuente: [task-messages/route.ts](../src/app/api/task-messages/route.ts). Exige internos y acceso a la tarea.

- `GET /api/task-messages?unread=true` → `{ tasks }` con pendientes de lectura.
- `GET /api/task-messages?task={UUID}&before={secuencia opcional}` → `{ messages, hasMore, closed }`. `before` es entero positivo hasta `Number.MAX_SAFE_INTEGER`; trae hasta 50 mensajes, presentados en orden ascendente. Para obtener la página anterior usa la secuencia más antigua de la página recibida.
- Cada mensaje proyecta `id`, `sequence`, `author_id`, `author_name`, `author_role`, `body` y `created_at`.
- `POST /api/task-messages`: `{ task, message: texto recortado 1–3000, message_id: UUID }` → `{ id }`. Conserva el mismo `message_id` al reintentar el mismo envío.
- `PATCH /api/task-messages`: `{ task, through_sequence: entero positivo seguro }` → `{ ok: true }`; marca lectura hasta esa secuencia.

Una tarea `APPROVED` conserva la conversación en consulta y `closed: true`; intentar publicar puede producir `409`. No hay contrato de WebSocket en esta ruta: el cliente consulta periódicamente.

### Avances de candidatura

`GET /api/application-updates` — `CANDIDATO` o `EMPLEADO`. Fuente: [application-updates/route.ts](../src/app/api/application-updates/route.ts).

Respuesta: `{ applications, updates }`, con hasta 200 postulaciones propias y 200 avisos. Sin candidato o postulaciones asociados devuelve ambas listas vacías.

- Postulación: `id`, `vacancy_id`, `status`, `applied_at`, `updated_at`, `title`.
- Aviso: `id`, `application_id`, `previous_status`, `status`, `created_at`, `initial`.

Solo proyecta cambios de estado propios: no entrega auditoría completa, actores, comentarios internos ni evaluaciones de IA. Los estados visibles incluyen `POSTULADO`, `EN_REVISION`, `PRESELECCIONADO`, `ENTREVISTA`, `CONTRATADO`, `RECHAZADO` y `RETIRADO`. Consultar un aviso no lo convierte en correo electrónico ni guarda por sí solo un recibo de lectura global.

## 11. Ambiente laboral

Fuente: [climate/route.ts](../src/app/api/climate/route.ts). Exige internos; candidatos quedan fuera.

### Lectura

- `GET /api/climate` → `{ surveys, assignments, participation }`, sujetos a RLS y a protección de análisis privados. Límites de consulta: 200 encuestas, 10000 asignaciones y 1000 comprobantes de participación.
- `GET /api/climate?survey={UUID}` → agregado autorizado devuelto por `climate_results`. Su contenido depende del rol, cierre y umbral de participación; consultar no garantiza acceso a comentarios o análisis.

### Escrituras y análisis

`POST /api/climate` recibe JSON `{ op, payload }`:

| `op`         | `payload`                                                                           | Acceso y éxito                                                                   |
| ------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `save`       | `id?`, `title: 1–160`, `description: hasta 3000`, `questions: 3–12 textos de 3–400` | RH/jefe autorizado; JSON de RPC                                                  |
| `publish`    | `id`, `employees: 1–1000 UUID`                                                      | RH/jefe autorizado; JSON de RPC                                                  |
| `respond`    | `id`, `ratings: 3–12 enteros de 1–5`, `comment: hasta 3000`                         | Participante asignado según SQL; JSON de RPC                                     |
| `comment`    | `id`, `comment: texto recortado 3–3000`                                             | Comentario autorizado de participante; `{ ok: true }`                            |
| `close`      | `id`                                                                                | RH/jefe autorizado; JSON de RPC                                                  |
| `ai.draft`   | `topic: texto recortado 3–1000`                                                     | RH/jefe autorizado; `{ result: { title, description, questions } }`              |
| `ai.summary` | `id`                                                                                | Analista autorizado; `{ result }` y guarda análisis privado                      |
| `ai.graphs`  | `id`                                                                                | Analista autorizado; `{ result }`, sin guardar como resumen privado en esta rama |

SQL relaciona las valoraciones con las preguntas, controla respuestas duplicadas y congela la edición de encuestas publicadas. Los análisis se reservan a RH, superusuario y la jefatura creadora según las reglas del recurso; poder responder no concede permiso de análisis.

`ai.summary` y `ai.graphs` requieren encuesta **cerrada** y al menos **cinco respuestas o cinco comentarios**. Para gráficas se exigen además **cinco respuestas y promedios disponibles**. `result` contiene `summary`, `sentiment: POSITIVE/MIXED/CONCERNING`, `strengths`, `risks`, `recommendations` y `charts` calculadas. Cada gráfica tiene `title`, `kind: bars/pie` y `values: [{ label, count }]`. Si no hay suficientes respuestas para gráficas, el resumen puede no incluir barras de preguntas.

El agregado no debe utilizarse para reconstruir identidades ni inferir distribuciones individuales a partir de promedios. El borrador no se publica automáticamente.

### Novedades de la vista general

`GET /api/climate/overview` — RH. Fuente: [climate/overview/route.ts](../src/app/api/climate/overview/route.ts).

Devuelve `{ period, open, new_surveys, analyzed_this_week, surveys, limited }`. `period` contiene `start`, `end` y `timezone` para la semana de Ciudad de México. `surveys` incluye novedades autorizadas con participación y análisis disponible. Consulta hasta 200 encuestas y presenta hasta 12 relevantes; `limited` advierte del recorte. No genera análisis nuevos.

## 12. Inteligencia artificial

Los flujos reciben IDs, filtros y solicitudes, nunca claves del proveedor desde el cliente. El servidor obtiene contexto autorizado y valida el resultado. Una respuesta puede rechazarse aunque su JSON sea válido. Los errores por falta de respaldo no deben convertirse en aprobación de una evidencia ni resolverse desactivando validaciones.

### Reclutamiento y evidencia de tareas

Fuente: [ai/{useCase}/route.ts](../src/app/api/ai/[useCase]/route.ts).

- `POST /api/ai/recruitment` — RH: `{ id: UUID de postulación }`. Devuelve `{ result, cached: false }`; `result` contiene `score` entero 0–100, `match_level: LOW/MEDIUM/HIGH`, `strengths`, `gaps` y `summary`.
- `POST /api/ai/evidence` — RH o jefe autorizado: `{ id: UUID de evidencia de tarea }`. La tarea debe estar `SUBMITTED`. Devuelve `{ result, cached: false }`; `result` contiene `status: APPROVED/REJECTED/NEEDS_REVIEW`, `confidence: 0–1`, `observations` y `reason`.

Estos `status` y puntajes pertenecen a una **opinión de IA**, no cambian el estado real de la tarea o candidatura. La ruta no admite un archivo arbitrario en el cuerpo ni un `force` adicional en su contrato actual.

### Propuesta de vacante

`POST /api/ai/vacancy` — RH. Fuente: [ai/vacancy/route.ts](../src/app/api/ai/vacancy/route.ts).

Multipart: `position_id`, `context` recortado de 10–6000 y `file?` PDF/TXT hasta 5 MiB. El archivo opcional debe tener texto legible. Devuelve `{ draft }` con los campos de vacante, `position_id` y `status: "DRAFT"`. No guarda ni publica automáticamente la vacante.

### Orquestador por módulo

`POST /api/ai/orchestrate` — internos; `area: "analytics"` solo RH. Fuente: [orchestrate/route.ts](../src/app/api/ai/orchestrate/route.ts) y [contratos de orquestación](../src/lib/ai/orchestration/contracts.ts).

| Campo JSON   | Contrato                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------- |
| `area`       | Obligatorio: `overview`, `tasks`, `onboarding`, `courses`, `performance`, `analytics`        |
| `mode?`      | `analyze` predeterminado, o `prompt`                                                         |
| `prompt?`    | Texto recortado hasta 8000; predeterminado `""`                                              |
| `filters?`   | Objeto estricto; predeterminado `{}`                                                         |
| `force?`     | Boolean, predeterminado `false`; omite reutilización del resumen cuando procede              |
| `automatic?` | Boolean, predeterminado `false`; activa la modalidad automática prevista por el módulo       |
| `history?`   | Hasta 4 `{ question, answer }` previos; solo `tasks` y `onboarding` lo usan como continuidad |

Filtros admitidos, todos opcionales:

- `module`: los mismos cinco módulos, debe coincidir con `area`.
- `state`: texto hasta 40; `priority`: `""`, `HIGH`, `MEDIUM`, `LOW`.
- `from`, `to`: fecha o `""`; `days`: `all`, `7`, `30`, `90` **como texto**.
- `department`, `employee`, `position`: UUID o `""`; `employees`: hasta 1000 UUID.
- `role`: texto hasta 30; `query`: texto hasta 200.
- `required`: `""`, `"true"`, `"false"`; `overdue`: `""`, `yes`, `no`.
- `process`: `all`, `tasks`, `courses`, `applications`.

La presencia de un filtro en el esquema no garantiza que todos los módulos lo utilicen igual; [filters.ts](../src/modules/workspace/filters.ts) determina su aplicación. Los filtros nunca amplían el alcance de la sesión. El resumen semanal de vista general tiene su periodo propio.

Éxito de `mode: "analyze"`: `{ result: { summary, recommendations }, model, generated_at, metrics? }`. Una reutilización puede añadir `cached: true` y no incluye necesariamente `metrics`. Cada recomendación contiene `title`, `reason`, `priority`, `resource_type`, `resource_id` y `employee_id`; las referencias no autorizadas se eliminan o se dejan en `null`.

Éxito de `mode: "prompt"`: **`{ prompt }` directamente**, sin envoltorio `result`. Es una propuesta de instrucciones para el análisis posterior, no su ejecución.

### Gráficas perfiles y propuestas de trabajo

`POST /api/ai/workforce` — internos; los modos `training`, `onboarding` o `section: "analytics"` exigen además RH. Para `mode: "tasks"`, una pregunta que solicita tareas atrasadas/vencidas por área o departamento devuelve conteos verificados en servidor (`verified: true`, `source: "server-counts"`) y no llama al proveedor de IA. Solo cuenta tareas con fecha anterior al día actual que no están `SUBMITTED` ni `APPROVED`, dentro del alcance y filtros autorizados. El resto de análisis consume el límite de Nexo de tres ejecuciones por usuario por minuto incluso si usa Ollama local. Fuente: [workforce/route.ts](../src/app/api/ai/workforce/route.ts).

Cuerpo JSON:

- `mode` obligatorio: `chart`, `profile`, `onboarding`, `training`, `tasks`.
- `section?`: `performance` o `analytics`.
- `prompt?`: recortado hasta 8000, predeterminado `""`.
- `employee_id?`, `position_id?`, `task_id?`: UUID o `""`. `profile` exige empleado; `training`, puesto válido; `task_id` solo se admite para una tarea autorizada en modo `tasks`.
- `filters?`: `department`, `employee` (UUID o `""`), `employees` (hasta 1000), `days` (`all/7/30/90` como texto), `process` (`all/tasks/courses/applications`), `query` (hasta 200), `onboarding_ids` (1–1000 UUID, solo modo `onboarding`).
- `chart_options?`: solo modo `chart`; contrato descrito debajo.

Un jefe o empleado no puede escoger `filters.department` para ampliar su jerarquía. La ruta comprueba empleados, procesos y coherencia entre áreas mencionadas y filtros.

`chart_options` admite:

- `period`: `module` predeterminado, `all`, `7`, `30`, `90` o `custom`.
- `from?`, `to?`: fechas reales; en `custom` ambas son obligatorias, ordenadas y con diferencia máxima de 365 días, es decir, hasta 366 fechas inclusivas.
- `group`: `auto` predeterminado, `status`, `department`, `day`, `week`, `month`.
- `compare`: boolean, predeterminado `true`.

El inicio personalizado no puede ser posterior a hoy y se comprueba compatibilidad con el periodo del módulo. Las cifras de las gráficas se calculan con registros autorizados, no con números inventados por el modelo.

Éxito: `{ result }`, cuyo contrato depende del modo:

- `chart`: `summary`, `charts`, `narrative_scope` y, si falla solo la interpretación, `narrative_error` y `narrative_error_code`. Los informes de gráfica incluyen sus datos, periodo, comparaciones, descripción y limitaciones según [chart-report.ts](../src/modules/workspace/chart-report.ts). La expansión por área puede producir más informes que las configuraciones inicialmente propuestas.
- `training`: `title`, `description`, `content`, `duration_minutes`; borrador formativo, sin guardado automático como curso.
- `profile`, `onboarding`, `tasks`: `summary` y `recommendations` como lista de textos, no objetos de recomendación del orquestador.

**Fallo parcial en gráficas:** puede recibirse `200` con gráficas calculadas, `summary: ""` y `narrative_error`. Conserva las gráficas y muestra el aviso; no presentes una explicación inventada ni interpretes el `200` como una narrativa completa.

`narrative_error_code` distingue `AI_CHART_FACTUAL_REJECTION` (texto no respaldado), `AI_CHART_TIMEOUT` (tiempo agotado), `AI_CHART_INVALID_OUTPUT` (JSON incompleto o inválido) y `AI_CHART_PROVIDER_FAILED` (fallo del proveedor). Los mensajes públicos explican la causa sin incluir respuestas rechazadas ni datos privados del proveedor. No cambian permisos ni los conteos ya calculados.

El cliente dibuja estos valores con amCharts 5; el contrato de la API no depende de la librería. Cambiar entre barras, columnas, líneas, circular y dona reutiliza la misma respuesta, sin ejecutar otra solicitud al modelo ni ampliar los filtros. Véase [la guía de gráficas](GRAFICAS.md).

### Cuotas y tratamiento de fallos

Las reservas de orquestación limitan ejecuciones por usuario; otras rutas utilizan reservas por caso de uso y recurso. `force` no evita cuotas. No hay una garantía de idempotencia general para POST.

Ante un rechazo factual válido, revisa contexto y archivos y aplica el tratamiento de [LM-IA-01](../README.md#lm-ia-01--rechazo-intermitente-de-análisis-limitación-aceptada-del-mvp): esperar, repetir una vez y continuar con revisión humana si persiste. Una aceptación de esta limitación no garantiza exactitud ni disponibilidad continua del proveedor.

## 13. Ejemplos y verificación

### Consulta desde una sesión abierta

Los ejemplos siguientes son código de referencia para el navegador de una instalación de prueba. No incluyen cookies o contraseñas reales.

```js
async function nexoJSON(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status}: ${body.error ?? "Error de Nexo"}`);
  }
  return body;
}

const tareas = await nexoJSON("/api/tasks?page=0");
console.log(tareas.data, tareas.page_size);
```

La función anterior es para respuestas JSON. Para `/api/profile-photo` o `preview=content` utiliza `response.blob()` y verifica `response.ok` antes de mostrar el contenido.

### Resumen con filtros

```js
const analisis = await nexoJSON("/api/ai/orchestrate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    area: "tasks",
    mode: "analyze",
    prompt: "Resume las entregas que requieren revisión.",
    filters: { module: "tasks", days: "7" },
    force: true,
    automatic: false,
  }),
});
console.log(analisis.result);
```

### Carga de evidencia

Sustituye `tareaId` por una tarea propia y `archivo` por el `File` seleccionado por la persona. Este ejemplo envía el archivo cuando se ejecuta:

```js
const form = new FormData();
form.set("bucket", "task-evidence");
form.set("id", tareaId);
form.set("file", archivo);
const evidencia = await nexoJSON("/api/files", {
  method: "POST",
  body: form,
});
```

Para reproducir una revisión no uses el ID de la tarea donde se espera el de la evidencia. Obtén los identificadores de los recursos autorizados, sin inventarlos ni reutilizar los de otro usuario.

### Cobertura y comprobaciones recomendadas

Esta referencia cubre los 23 archivos de rutas, los comandos publicados por `schemas` y las ramas del adaptador genérico. Sus respuestas no sustituyen un esquema completo de todas las tablas: las filas y el JSON de RPC dependen también de [las migraciones](../supabase/migrations/).

Para comprobar una instalación, utiliza datos ficticios y separa estas verificaciones:

1. Sesión ausente (`401`), perfil inactivo o rol no permitido (`403`) y recurso ajeno no accesible.
2. JSON mal formado, campos extra, UUID inválido, estados y tamaños límite.
3. Paginación, listas vacías y diferencia entre ID de recurso y de evidencia.
4. Transiciones de candidatura, revisión duplicada y requisitos de documentos.
5. Alcance temático, filtros y rechazo factual de IA, incluyendo el fallo parcial de narrativa de gráficas.
6. Protección de CV, evaluaciones privadas y comentarios de encuesta frente a roles no autorizados.
7. Recepción efectiva de mensajes y funcionamiento de enlaces en pruebas de SMTP autorizadas.

Las pruebas existentes están en [tests](../tests/) y [e2e](../e2e/). La creación de esta referencia se basa en lectura de contratos y rutas; no implica que se hayan ejecutado aquí estas escrituras ni verificado una instalación remota.
