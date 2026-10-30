# Revisión de cumplimiento del MVP · Nexo

**Fecha:** 27 de octubre de 2026 · **Versión revisada:** `main` en `cfc39d0` (local) · **Tipo:** revisión de solo lectura (sin cambios en el código).

**Criterio de referencia**
1. `docs/REQUERIMIENTOS_NEXO.docx` v1.0 (13/10/2026): 52 requisitos funcionales (RF) y 16 no funcionales (RNF).
2. `MVP_Sistema_RRHH_IA.md`: definición original del MVP, con 20 criterios de aceptación, Definition of Done y pruebas obligatorias.

**Método.** Para cada requisito se buscó la regla clave del criterio de aceptación en la interfaz, la API, el SQL (RLS, RPC, triggers) y las pruebas. Que exista un archivo no basta. Los hallazgos graves se comprobaron a mano en el código. Las pruebas automáticas se ejecutaron el 27/10/2026.

---

## 1. Resultado global

| Bloque | Cumple | Parcial | Falta | Total |
|---|---:|---:|---:|---:|
| RF 01–52 | 41 | 11 | 0 | 52 |
| RNF 01–16 | 8 | 7 | 1 | 16 |
| **Total** | **49 (72 %)** | **18 (26 %)** | **1 (2 %)** | **68** |

**Veredicto.** El MVP **cumple en lo esencial**: el flujo completo existe de punta a punta y los controles P0 de seguridad (RLS, RPC, validación, archivos privados, IA consultiva) están implementados. Ningún requisito funcional falta por completo.

Hay que tener presentes estos puntos:
- **Hay un fallo de privacidad P0:** el candidato puede leer las notas internas de sus entrevistas.
- **Hay una prueba que falla.** Es una regresión del último commit en el script de activación para Supabase alojado.
- Varios requisitos están **parciales**: el documento promete algo más estricto de lo que hace el código.

Según la propia regla del documento de requisitos («los P0 aplicables deben cumplir sus criterios y no tener defectos que expongan datos»), conviene **corregir los puntos de la sección 3 antes de declarar el MVP aceptado**.

## 2. Pruebas automáticas (ejecutadas el 27/10/2026)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ sin errores |
| `npm run lint` | ✅ sin errores |
| `npm test` | ❌ **628 aprobadas, 1 fallida, 28 omitidas** (74 archivos: 63 OK, 1 con fallo y 10 omitidos, que son las pruebas `*-live`) |

**La prueba que falla** es `tests/activation.test.ts`, «activa las tres mejoras pendientes y permite repetir el script».
- Ejecutar `supabase/activar-mejoras-rh.sql` sobre `instalar-proyecto.sql` aborta con: `No se encontró la operación position.save. Aplica primero las migraciones base.`
- Con la versión del script **anterior** al commit `cfc39d0` («Sincroniza activar-mejoras-rh.sql con las migraciones hasta 202610220003»), las dos ejecuciones pasan. Lo comprobé con PGlite.
- Por tanto es una **regresión del último commit**: el bloque que parchea `position.save` se ejecuta cuando la función `command` ya fue envuelta (`workforce_legacy_command`) y el texto que busca ya no coincide.
- **Impacto:** una instalación alojada que use ese script **fallará**.

No se ejecutaron `npm run build` ni `npm run test:e2e`; la mayoría de los e2e se omiten sin `.local/real-flow-fixture.json`.

## 3. Huecos importantes (prioridad para la defensa)

| # | Severidad | Requisito | Hallazgo | Evidencia |
|---|---|---|---|---|
| 1 | **Alta (privacidad)** | RF16 / RNF04 | **El candidato puede leer las notas internas de sus entrevistas.** La política `interviews_read` usa `read_application`, que incluye al candidato dueño, y no hay restricción por columna. `snapshot()` hace `select("*")` y envía `notes` al cliente; también se pueden leer por REST con el token del candidato. | `202609140001_foundation.sql:9,33,48`; `src/modules/workspace/queries.ts:49` |
| 2 | **Alta (instalación)** | RNF13 | `activar-mejoras-rh.sql` falla tras el último commit (ver sección 2). | `tests/activation.test.ts` |
| 3 | Media | RF19 | La contratación exige solo una entrevista «no cancelada»: puede estar agendada en el futuro y no completada. Tampoco permite *vincular* un empleado ya existente: siempre inserta uno nuevo. | `202609140002_commands.sql:62-67` |
| 4 | Media | RF23 / RN05 | El SUPERUSER **no** puede modificar a un RH ya incorporado (lo retiró `202610210001_hr_top_manager_only.sql` y las pruebas lo fijan), pero el requisito dice «solo superusuario o RH superior». Hay que alinear el documento o el código. Un RH sin antecesor RH queda prácticamente sin quien lo edite. | `202610210001_hr_top_manager_only.sql`; `tests/database.test.ts:1632` |
| 5 | Media | RF35 | Pedir corrección de una tarea (`REJECTED`) **no exige comentario en el servidor**; solo lo exige la UI. | `202609140002_commands.sql:116-117` |
| 6 | Media | RF10 | No hay máquina de estados de vacante (se puede pasar de CLOSED a PUBLISHED o de PUBLISHED a DRAFT). El portal público `/jobs` recibe todas las columnas (`select("*")`, incluido `created_by`). | `src/app/[[...path]]/page.tsx:80-83`; `202609140005_public_vacancies.sql` |
| 7 | Media | RF32 | Si se reemplaza un plan cuya actividad sigue en PENDING pero ya tiene un quiz aprobado, se borran en cascada los intentos de evaluación (se pierde historial). | `202609220001_onboarding_plans.sql:146-148` |
| 8 | Media | RF49 | No hay panel de avisos desde un icono superior para EMPLEADO, JEFE ni RH (solo campana de candidato y avisos de contratación). La agenda de la vista general solo muestra entrevistas. | `src/components/workspace.tsx:1363-1372` |
| 9 | Baja | RF27 | No existe la acción de «iniciar» una actividad de incorporación; solo entregar y revisar. | `202609230001_workforce_reviews.sql:62-66` |
| 10 | Baja | RF34 | No se puede entregar evidencia de **solo texto**: siempre se exige archivo. | `src/components/forms.tsx:421-429` |
| 11 | Baja | RF17 | `interview.cancel` no valida el estado (permite cancelar una COMPLETED) ni avisa si el id no existe. | `202609140002_commands.sql:48-61` |
| 12 | Baja | RF48 | El umbral de análisis de clima es «≥5 respuestas **o** ≥5 comentarios», así que puede analizarse con menos de 5 respuestas. | `202610080001_private_ai_analyses.sql:138-139` |
| 13 | Baja | RF40 | La ruta antigua `course.review` sigue expuesta y fija el progreso en 75 %. | `202609230001_workforce_reviews.sql:117` |
| 14 | Baja | Privacidad | `task_evidence.ai_result` es legible por el propio empleado (la política `evidence_read` usa `read_employee`). En reclutamiento y clima los análisis sí se movieron a tablas privadas. | `foundation.sql:32` |
| 15 | Falta | RNF15 | No hay respaldo ni prueba de restauración. El propio documento lo declara condición previa a datos reales, no del prototipo. | — |

## 4. Matriz de requisitos funcionales

C = cumple · P = parcial · F = falta.

| ID | Estado | Evidencia principal | Nota |
|---|---|---|---|
| RF01 Acceso y cierre de sesión | C | `src/app/api/auth/[action]/route.ts`; `src/proxy.ts`; `src/lib/auth/index.ts:23-35` | — |
| RF02 Registro de candidatos | C | trigger `new_user()` (`foundation.sql:65-69`); `supabase/config.toml` confirmaciones | — |
| RF03 Invitar cuentas | C | `src/app/api/admin/users/route.ts` (SUPERUSER, 409 duplicado, compensación) | — |
| RF04 Recuperar acceso | C | `route.ts` recover/password (12-128) | — |
| RF05 Roles y actividad | C | `profile.admin` en `commands.sql:21-23`; `current_role()` exige `active` | — |
| RF06 Áreas y puestos | C | `delete_unused_department/position`; FK sin cascada | — |
| RF07 Auditoría | C | política `audit_read` solo SUPERUSER (`202609170001`) | — |
| RF08 Navegación y tema | C | `workspace-navigation.tsx`; `ThemeToggle` | — |
| RF09 Gestionar vacantes | C | `vacancy.save/delete`; Zod `schemas.ts:37-49` | — |
| RF10 Publicar oportunidades | **P** | política `vacancies_public_read` | sin máquina de estados; `/jobs` envía todas las columnas |
| RF11 Vacante con IA | C | `src/app/api/ai/vacancy/route.ts` (borrador DRAFT, `requireModuleTopic`) | — |
| RF12 Documentos de vacante | C | bucket privado, URL firmada 60 s | — |
| RF13 Perfil y CV | C | bucket `cvs`; `src/lib/storage/files.ts` (firma, MIME, tamaño) | — |
| RF14 Postulación única | C | `unique(candidate_id,vacancy_id)`; retiro y reactivación | — |
| RF15 Revisar postulaciones | C | transiciones en SQL; `application_assessments` privada | — |
| RF16 Avances del candidato | **P** | `application-updates/route.ts` | **fuga de `interviews.notes`** |
| RF17 Calendario de entrevistas | C | `interview.save/cancel`; `guard_interview_future`; índice `interview_slot` | cancel sin validar estado |
| RF18 Conflictos de agenda | C | `SCHEDULE_CONFLICT` (60 min); `CANDIDATE_SCHEDULED` | — |
| RF19 Contratar | **P** | `application.hire` atómico | entrevista no necesariamente completada; no vincula empleado existente |
| RF20 Asignación laboral | C | `complete_hiring_assignment`; `validate_manager_tree` | — |
| RF21 Buscar integrantes | C | `manages_employee` recursivo; búsqueda en UI | sin filtro por área en el directorio |
| RF22 Perfiles y fotos | C | `202610060001_profile_photos.sql`; `profile-photo.tsx` | — |
| RF23 Jerarquía coherente | **P** | `validate_manager_tree`; `hr_area_hierarchy` | SUPERUSER no edita RH incorporado |
| RF24 Correcciones de perfil | C | índice parcial PENDING; `review_profile_correction` | — |
| RF25 Plantillas | C | CHECK 1-30; índice único por alcance; borrador IA | índice trata (puesto) y (puesto+área) como alcances distintos |
| RF26 Asignar planes | C | `initialize_onboarding` (precedencia) | plazos no se ajustan a día hábil |
| RF27 Entregar actividades | **P** | `item.complete` lleva a SUBMITTED | no hay acción «iniciar» |
| RF28 Documentos del expediente | C | guard `DOCUMENT_REVIEW_PENDING`; RLS sin jefe | versionado implícito |
| RF29 Material de aprendizaje | C | `optional_onboarding_quiz` (oculta `correct`) | — |
| RF30 Intentos de evaluación | C | calificación en SQL | intentos ilimitados |
| RF31 Confirmar actividades | C | `guard_onboarding_step` (solo RH, desde SUBMITTED) | — |
| RF32 Conservar planes | **P** | `PLAN_STARTED` | quiz aprobado no cuenta como inicio, y su historial se pierde |
| RF33 Crear y asignar trabajo | **P** | `assign_many` atómica | cursos repetidos se omiten en vez de fallar |
| RF34 Entregar tareas | **P** | `task.status`, `file.attach` | sin entrega de solo texto |
| RF35 Revisar entregas con IA | **P** | IA solo escribe `ai_result`; 422 si no está respaldada | comentario de corrección no obligatorio en servidor |
| RF36 Conversaciones | C | `task_conversations` (sequence, idempotencia, recibos) | — |
| RF37 Catálogo de cursos | C | alcance área/puesto; borrador IA | — |
| RF38 Asignar cursos | C | `unique(course_id,employee_id)` | no valida que el curso corresponda al área |
| RF39 Avances y evidencias | **P** | `attach_course_evidence`; `approved_progress` | el informado se sobrescribe al revisar |
| RF40 Validar capacitación | C | `review_course_progress` (COMPLETED solo con 100 % aceptado) | ruta antigua `course.review` sigue activa |
| RF41 Indicadores con filtros | C | `filters.ts`; `analytics-summary.ts` | — |
| RF42 Varias gráficas | C | `chart-report.ts` (valores en código) | — |
| RF43 Explicar periodos | C | `chart-report.ts:157,216-229,355` | — |
| RF44 Análisis con contexto | C | prompts y revisión factual | depende del prompt, no de reglas fijas |
| RF45 Encuestas | C | `climate_command` (3-12, 1-5, DRAFT, OPEN, CLOSED) | — |
| RF46 Destinatarios elegibles | C | `CLIMATE_ALREADY_RESPONDED` | — |
| RF47 Respuestas anónimas | C | `climate_participation` separada de `climate_answers` | tablas antiguas `surveys`/`survey_responses` siguen en el esquema |
| RF48 Análisis de grupo | C | `climate_aggregate`; `<dialog>` con gráficas | umbral con «o» |
| RF49 Pendientes y agenda | **P** | `overview-dashboard.tsx` | sin panel de avisos superior para roles internos |
| RF50 Novedades de clima | C | `currentWeek()` CDMX; grupos <5 ocultos | — |
| RF51 Resúmenes del módulo | C | `WorkforceAI` (clave `scope`) | — |
| RF52 Límites de asistentes | C | `module-scope.ts`; 409 `AI_IN_PROGRESS`; 502/503 | — |

## 5. Matriz de requisitos no funcionales

| ID | Estado | Evidencia | Nota |
|---|---|---|---|
| RNF01 Acceso por recurso | C | `requireRole`/`authenticate`; helpers `owns_*`/`manages_*`; pruebas IDOR | — |
| RNF02 RLS y funciones | C | RLS en las 39 tablas (bucle en `foundation.sql:35-40`); funciones `security definer` con `search_path=''` | — |
| RNF03 Secretos | C | `.env.local` nunca versionado; claves solo en módulos `server-only` | HTTPS depende del despliegue |
| RNF04 Anonimato y minimización | **P** | IDs en lugar de nombres hacia la IA; clima ≥5 | el texto del CV va completo a la IA; fuga de `notes` (hallazgo 1) |
| RNF05 Archivos privados | C | `files.ts` (firma, MIME, 5 MiB; fotos 2 MiB) | — |
| RNF06 Fotos normalizadas | C | `normalizeProfilePhoto` → PNG 512 px sin metadatos | — |
| RNF07 Transacciones | C | contratación atómica; compensación en Storage y Auth | — |
| RNF08 Validación de entradas | C | ~97 `.strict()`; `checkOrigin` en todas las rutas que escriben; zona CDMX | — |
| RNF09 Claridad de la interfaz | **P** | `lang="es"`, estados en español | sin prueba automática de accesibilidad |
| RNF10 Teclado y carga | **P** | `aria-*`, `focus-visible`, `loading.tsx`/`error.tsx` | no hay prueba de navegación con Tab |
| RNF11 Consultas acotadas | **P** | `.limit(1000)` y avisos | sin paginación; KPI truncados sin aviso en `/api/analytics/kpis` |
| RNF12 Control de IA | **P** | `begin_orchestration` (1 pendiente, 3/min); timeout 45 s | cancelar no detiene el proveedor |
| RNF13 Instalación reproducible | **P** | README, lockfile, migraciones, seed | **`activar-mejoras-rh.sql` falla**; `seed.sql` no idempotente; Docker no verificado |
| RNF14 Verificación registrada | **P** | `RESULTADOS_CIERRE_MVP_20261013.json` (52/52 OK) | `VERIFICACION.md` desactualizado (sept.); evidencia fuera de Git |
| RNF15 Respaldo y restauración | **F** | — | declarado como condición para datos reales |
| RNF16 IA respaldada | C | esquemas Zod; `grounding.ts`; pruebas | rechazos intermitentes (LM-IA-01, aceptada) |

## 6. Contra la definición original del MVP (`MVP_Sistema_RRHH_IA.md`)

**Criterios de aceptación (sección 17).** Los 20 están implementados en código, con estos matices:
- **17.6:** la IA devuelve puntuación, fortalezas, brechas y resumen ✔, guardados en una tabla privada.
- **17.7–17.8:** la contratación acepta una entrevista solo agendada (hallazgo 3).
- **17.18 «RH ve KPIs»:** parcial. Los 8 KPI pedidos solo existen en `GET /api/analytics/kpis`, que **ninguna pantalla usa**. El dashboard muestra otro conjunto y no incluye candidatos, contrataciones, tareas vencidas ni desempeño promedio.
- **17.20:** la auditoría por trigger cubre las tablas críticas ✔.

**Otras diferencias con el plan original**

| Prometido | Estado real |
|---|---|
| Docker + Compose + Supabase CLI | `Dockerfile` y `compose.yaml` existen (app + Ollama), pero Supabase va aparte por CLI. La imagen **no se verificó**. |
| Tailwind | Instalado, pero la UI usa CSS propio (~6000 líneas). |
| Fórmula de desempeño 0.6/0.4 y semáforo | Implementada en `src/modules/performance/service.ts:22-29` y probada. El amarillo no tiene color propio en la UI. |
| P1: Buddy, Tutor IA | **No existen** (DECISIONES los deja como P1). |
| P1: recomendación de cursos con IA | Parcial: recomienda recursos, no cursos del catálogo por empleado. |
| P1: clima/pulse, sentimiento, organigrama, resumen IA de desempeño, reporte IA de analytics | Existen. |
| Pruebas obligatorias (sección 16) | Faltan pruebas explícitas de login inválido, sesión expirada, expiración de la URL firmada y un E2E continuo de todo el flujo (se cubrió con un script y el JSON de cierre). |

## 7. Riesgos para la defensa

1. **Documentación vs. repositorio.** `.gitignore` excluye `/docs/*` salvo 5 archivos. `REQUERIMIENTOS_NEXO.docx`, `DECISIONES.md`, `VERIFICACION.md` y `RESULTADOS_CIERRE_MVP_20261013.json` **no están en GitHub**. Si el jurado revisa el repo, no verá la evidencia.
2. **`VERIFICACION.md` dice que el MVP «no cumple todavía la definición de terminado»** (último registro en septiembre), mientras el JSON del 13/10 muestra 52/52 OK. Conviene actualizarlo o no citarlo.
3. **El requisito RF23 contradice el código** (autoridad del superusuario sobre RH). Prepara la explicación de esa decisión o ajusta el documento.
4. **Dashboard RH (MVP §13):** si te piden «tareas vencidas» o «desempeño promedio» en pantalla, no están como tarjeta.
5. **La fuga de `interviews.notes`** es justo el tipo de pregunta de seguridad que puede salir («¿qué ve un candidato si consulta la API directamente?»).
6. **La prueba que falla** se ve en cuanto alguien ejecuta `npm test`.

## 8. Recomendación (si decides corregir)

Por orden de impacto y esfuerzo:
1. Ocultar `notes` al candidato, con una vista o política por columna, o moviendo las notas a una tabla solo para RH, y añadir una prueba.
2. Arreglar el orden del bloque `position.save` en `activar-mejoras-rh.sql` hasta que `tests/activation.test.ts` pase.
3. Exigir comentario en `REJECTED` en SQL y entrevista `COMPLETED` (o al menos pasada) para contratar.
4. Decidir RF23 (código o documento) y mostrar los KPI de `/api/analytics/kpis` en el dashboard RH.
5. Versionar la evidencia de cierre (o adjuntarla en la entrega) y actualizar `VERIFICACION.md`.
