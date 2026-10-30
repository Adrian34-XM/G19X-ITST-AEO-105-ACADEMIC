# Nexo · Recorrido guiado y cuestionario de estudio

Material personal de estudio (no forma parte del repositorio). Las rutas son relativas a la raíz del proyecto.

---

## Parte 1 · Recorrido guiado: «RH crea un área» (`department.save`)

Abre cada archivo mientras lees. Objetivo: poder contar este viaje de memoria.

### Paso 0 · El usuario navega a `/rh`
- **`src/proxy.ts`** se ejecuta antes de cada página.
  - Renueva las cookies de sesión de Supabase (`createServerClient` + `auth.getUser()`).
  - Si la ruta empieza por `/admin|/rh|/manager|/employee|/candidate`, lee `profiles.role, active`.
  - Si el perfil no está activo o `mayEnter(role, ruta)` es falso, redirige a `/login` o al inicio de su rol (`home[role]`).
- **`src/lib/permissions/index.ts`** define `mayEnter` y `home`. Es la tabla de qué rol entra a qué área.
- ⚠️ Esto solo controla la **navegación**. El propio comentario del archivo dice que no reemplaza las otras comprobaciones.

### Paso 1 · La página
- **`src/app/[[...path]]/page.tsx`**: una sola página "atrapa-todo" resuelve todas las vistas.
- Llama a `snapshot()` (**`src/modules/workspace/queries.ts`**) con la **sesión del usuario**, no con la clave de servicio. Por eso RLS filtra lo que se carga.
- Renderiza **`src/components/workspace.tsx`**, que arma la navegación según el rol.

### Paso 2 · El formulario
- **`src/components/forms.tsx`** (líneas ~100-126): convierte los campos del formulario en `payload` y llama a `request("/api/commands", { op: spec.op, payload })`.
- Para un área: `{ op: "department.save", payload: { name: "Ventas" } }`. Si se edita, también lleva `id`.

### Paso 3 · La API
**`src/app/api/commands/route.ts`**, función `POST`:
1. `checkOrigin(req)` (**`src/lib/api.ts`**): rechaza peticiones de otro origen (protección CSRF) con 403.
2. `authenticate()` (**`src/lib/auth`**): obtiene el cliente Supabase **con la sesión del usuario** y su `profile`.
3. Valida la forma general `{ op, payload }` con Zod `.strict()`.
4. Si `op` no existe en `schemas` → 404 «Operación no encontrada».
5. Valida el `payload` con el esquema de la operación (**`src/modules/commands/schemas.ts`**, línea 23):
   `"department.save": z.object({ id: optionalId, name: short }).strict()`.
   `.strict()` rechaza cualquier campo extra, por ejemplo alguien que intente mandar `role: "SUPERUSER"`.
6. Llama a la RPC `save_department(target, title)`.
7. Traduce errores: `PGRST202` (no existe la función) → 503 «Aplica la migración…».

> La API **nunca** acepta SQL del cliente. Solo nombres de operación conocidos y datos validados.

### Paso 4 · PostgreSQL
**`supabase/migrations/202610220001_hr_department_manager.sql`** (versión vigente de `save_department`; la original está en `202609280005_hr_departments.sql`):
- `security definer set search_path=''`: corre con privilegios del dueño, con `search_path` vacío para evitar suplantación de funciones.
- Primera línea: si `auth.uid()` es nulo o el rol no es `RH_ADMIN` o `SUPERUSER` → `insufficient_privilege`. **Se vuelve a comprobar el rol aquí**, aunque la API ya autenticó.
- Valida el nombre (1–150 caracteres).
- Regla especial: el área «Recursos Humanos» solo la crea o renombra un `SUPERUSER`, y no puede duplicarse (`unique_violation`).
- `insert` o `update` y devuelve `{ id }`.
- `revoke all … from public, anon` + `grant execute … to authenticated`: un visitante sin sesión ni siquiera puede invocarla.

### Paso 5 · Vuelta
- La API responde `{ id }` → el formulario llama a `onSaved()` → se recarga el `snapshot` y aparece el área.

### Lo que debes concluir
| Capa | Archivo | Si alguien la salta… |
|---|---|---|
| Navegación | `src/proxy.ts` | …llamando a la API directamente con `fetch`, choca con la capa 2 |
| API | `src/app/api/commands/route.ts` + Zod | …con una sesión válida de EMPLEADO, choca con la capa 3 |
| Base de datos | `save_department` / RLS | Es la última palabra: rechaza por rol real en `profiles` |

**Ejercicio:** busca otra operación de `schemas.ts` (por ejemplo `position.save`) y haz tú solo el mismo recorrido hasta su función SQL. Usa `Ctrl+Shift+F` con el nombre de la función en `supabase/migrations`.

---

## Parte 2 · Cuestionario por fase

Intenta responder **sin mirar** y luego comprueba con la respuesta y el archivo indicado.

### Fase 1 · Qué hace el sistema
1. ¿Cuáles son los 5 roles y a qué ruta entra cada uno?
   <details><summary>Respuesta</summary>SUPERUSER→/admin, RH_ADMIN→/rh, JEFE→/manager, EMPLEADO→/employee, CANDIDATO→/candidate. Ver `src/lib/permissions/index.ts`.</details>
2. ¿Qué módulos de negocio tiene Nexo?
   <details><summary>Respuesta</summary>Reclutamiento, equipo y organigrama, incorporación (onboarding), capacitación, tareas y evidencias, desempeño, analítica y clima laboral. Ver README.md.</details>
3. ¿Quién puede ver la auditoría?
   <details><summary>Respuesta</summary>Solo SUPERUSER (`/…/audit`, tabla `audit_logs`). Ver docs/AUDITORIA.md.</details>
4. ¿La IA puede contratar a un candidato o aprobar una evidencia?
   <details><summary>Respuesta</summary>No. Su salida es consultiva y siempre la revisa una persona; nunca cambia estados por sí misma.</details>

### Fase 2 · Arquitectura
1. Nombra el stack principal.
   <details><summary>Respuesta</summary>Node 24, Next.js 16 (App Router, modo webpack), React 19, TypeScript, Supabase (Auth, PostgreSQL con RLS y RPC, Storage privado), Zod 4, amCharts 5; IA con Ollama local o Gemini (`AI_PROVIDER`).</details>
2. ¿Por qué hay una sola página `[[...path]]/page.tsx`?
   <details><summary>Respuesta</summary>Centraliza la resolución de vistas (login, /jobs público y áreas por rol), la carga del dataset autorizado con `snapshot()` y el render de `workspace.tsx`.</details>
3. Dibuja el camino de una escritura.
   <details><summary>Respuesta</summary>Formulario → API (`checkOrigin`, `authenticate`, Zod) → RPC/función SQL → tabla, con RLS y permisos re-comprobados en PostgreSQL.</details>
4. ¿Qué es `src/proxy.ts` en Next 16?
   <details><summary>Respuesta</summary>El reemplazo del antiguo middleware: renueva la sesión y controla la navegación por rol.</details>

### Fase 3 · Base de datos
1. ¿Dónde está la "fuente de verdad" del esquema?
   <details><summary>Respuesta</summary>`supabase/migrations/*.sql`, aplicadas en orden por fecha.</details>
2. ¿Qué es RLS y qué problema resuelve?
   <details><summary>Respuesta</summary>Row Level Security: políticas por fila que deciden qué filas puede leer o escribir cada usuario, aunque consulte la tabla directamente.</details>
3. ¿Qué significa `security definer` y por qué se acompaña de `set search_path=''`?
   <details><summary>Respuesta</summary>La función corre con los privilegios de su dueño; por eso debe validar ella misma quién llama (`auth.uid()`, `current_role()`). El `search_path` vacío obliga a nombres calificados (`public.tabla`) y evita que alguien inyecte objetos con el mismo nombre.</details>
4. ¿Qué hacen `instalar-proyecto.sql` y `activar-mejoras-rh.sql`?
   <details><summary>Respuesta</summary>El primero junta las migraciones base para un proyecto vacío; el segundo es una actualización repetible encima (cada bloque comprueba si ya está instalado). Ambos deben mantenerse sincronizados con las migraciones.</details>
5. ¿Por qué ocultar un botón no es seguridad?
   <details><summary>Respuesta</summary>Cualquiera puede llamar a la API con `fetch`/curl; la decisión real la toman la API y PostgreSQL.</details>

### Fase 4 · Seguridad en capas
1. Un EMPLEADO escribe `/rh` en el navegador. ¿Qué pasa y dónde?
   <details><summary>Respuesta</summary>`src/proxy.ts`: `mayEnter` falla y lo redirige a `/employee`.</details>
2. Ese EMPLEADO manda `POST /api/commands` con `department.save`. ¿Dónde se bloquea?
   <details><summary>Respuesta</summary>Pasa `checkOrigin` y `authenticate`, y Zod acepta los datos; pero `save_department` lanza `insufficient_privilege` porque su rol no es RH_ADMIN/SUPERUSER.</details>
3. ¿Qué protege `checkOrigin`?
   <details><summary>Respuesta</summary>Ataques CSRF: rechaza escrituras desde otro origen o con `sec-fetch-site: cross-site`.</details>
4. ¿Por qué `.strict()` en los esquemas Zod?
   <details><summary>Respuesta</summary>Rechaza campos no previstos; evita que se cuelen datos como un rol o un id ajeno.</details>
5. ¿Con qué credencial se cargan los datos de negocio?
   <details><summary>Respuesta</summary>Con la sesión del usuario (no la clave service-role), para que RLS aplique siempre.</details>

### Fase 5 · Escritura, lectura y archivos
1. ¿Qué contiene `src/modules/commands/schemas.ts`?
   <details><summary>Respuesta</summary>Un mapa operación → esquema Zod estricto (ej. `"department.save"`).</details>
2. ¿Qué hace `/api/commands` si la operación no existe?
   <details><summary>Respuesta</summary>404 «Operación no encontrada».</details>
3. ¿Cómo se entrega un archivo privado?
   <details><summary>Respuesta</summary>`src/app/api/files/route.ts` comprueba acceso y asociación y devuelve una URL firmada temporal; los buckets son privados.</details>
4. Si subes un archivo a Storage y luego falla asociarlo en SQL, ¿qué se hace?
   <details><summary>Respuesta</summary>Compensar manualmente (borrar el objeto subido): las transacciones SQL no abarcan Storage ni Auth.</details>
5. ¿Qué devuelve la API si falta una migración?
   <details><summary>Respuesta</summary>Un error claro (p. ej. 503 «Aplica la migración …»), detectado por el código `PGRST202` o helpers como `requireHrHierarchySchema`.</details>

### Fase 6 · IA
1. ¿Qué variable elige el proveedor de IA y dónde se abstrae?
   <details><summary>Respuesta</summary>`AI_PROVIDER` (ollama | gemini); `src/lib/ai/provider.ts`.</details>
2. ¿Quién calcula KPIs y alertas, la IA o el código?
   <details><summary>Respuesta</summary>El código/SQL (`insights.ts`, `analytics-summary.ts`); la IA solo los narra.</details>
3. ¿Para qué sirven `module-scope.ts` y `grounding.ts`?
   <details><summary>Respuesta</summary>El primero decide si la pregunta pertenece al módulo; el segundo verifica que la respuesta esté respaldada por los datos entregados.</details>
4. ¿Qué limita el uso de IA por usuario?
   <details><summary>Respuesta</summary>Reservas en `orchestration_runs`, limitadas en SQL: 3 por minuto y 1 pendiente por usuario. Además hay caché de resultados.</details>
5. ¿Qué pasa si el modelo menciona un id o un título que no existe o no está autorizado?
   <details><summary>Respuesta</summary>Los IDs no autorizados se eliminan de la salida; en tareas/onboarding, una respuesta que cite títulos inexistentes se rechaza (422).</details>
6. ¿Por qué los análisis privados de candidatos están separados?
   <details><summary>Respuesta</summary>Para que el candidato o participante no vea la evaluación interna (`src/lib/private-analyses.ts`, migración `202610080001_private_ai_analyses.sql`).</details>

### Fase 7 · Módulos
1. ¿Qué hechos calcula el servidor antes de que la IA hable de tareas e incorporación?
   <details><summary>Respuesta</summary>Cerradas, vencidas, motivos de seguimiento y antigüedad de evidencias (`src/modules/workspace/follow-up-facts.ts`).</details>
2. ¿Quién puede editar los datos laborales de otra persona de RH?
   <details><summary>Respuesta</summary>Solo la persona RH más alta en la jerarquía (`202610210001_hr_top_manager_only.sql`, docs/JERARQUIA_RH.md).</details>
3. ¿Quién asigna al encargado del área de Recursos Humanos?
   <details><summary>Respuesta</summary>Solo SUPERUSER (comprobado en la API y en `save_department_manager`).</details>
4. ¿Dónde se preparan los datos de las gráficas?
   <details><summary>Respuesta</summary>En el servidor, ya autorizados; amCharts 5 se carga bajo demanda en el navegador (`src/lib/charts/module-loader.ts`, `src/components/data-chart.tsx`).</details>

### Fase 8 · Pruebas
1. ¿Cómo prueba `tests/database.test.ts` el SQL sin Docker?
   <details><summary>Respuesta</summary>Carga las migraciones en PGlite (Postgres en memoria).</details>
2. ¿Qué son los archivos `*-live.test.ts`?
   <details><summary>Respuesta</summary>Pruebas contra IA o BD reales; se saltan salvo que actives banderas como `NEXO_AI_LIVE=1`.</details>
3. ¿Qué comando corre una sola prueba por nombre?
   <details><summary>Respuesta</summary>`npx vitest run -t "nombre del caso"`.</details>
4. ¿Qué cubren las pruebas de `e2e/`?
   <details><summary>Respuesta</summary>Recorridos de navegador con Playwright (`npm run test:e2e`).</details>

---

## Parte 3 · Preguntas de defensa (respuesta en 2 minutos, en voz alta)
1. «¿Qué pasa si alguien manipula el navegador para ver datos de otra área?»
2. «¿Cómo garantizan que la IA no invente datos?»
3. «¿Por qué Supabase y no un backend propio?» (apóyate en docs/DECISIONES.md)
4. «¿Qué limitaciones conocidas tiene el MVP?»
5. «Si mañana cambian Ollama por otro proveedor, ¿qué archivos tocarían?»
