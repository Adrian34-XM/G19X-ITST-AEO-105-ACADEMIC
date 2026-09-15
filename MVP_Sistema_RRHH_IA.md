# MVP — Sistema de Gestión de RRHH con IA

**Basado en:** `PRD_Sistema_RH_IA_MVP_2_Semanas.md`  
**Objetivo:** entregar en 14 días un MVP funcional, seguro y demostrable.

## 1. Objetivo

El MVP debe demostrar un flujo completo:

```text
Candidato → Vacante → Postulación + CV → IA → Entrevista → Contratación
→ Empleado → Onboarding → Curso → Tarea → Evidencia → IA
→ Desempeño → Dashboard RH
```

La prioridad es integración end-to-end, seguridad y funcionalidad real, no cubrir toda la visión empresarial.

## 2. Alcance

### P0 — obligatorio

- Login/logout.
- RBAC y RLS.
- Gestión de usuarios.
- Áreas y puestos.
- CRUD de vacantes.
- Registro de candidatos.
- CV privado.
- Postulaciones y estados.
- Recomendación y resumen de candidatos con IA.
- Entrevistas básicas.
- Contratación.
- Alta automática de empleado.
- Onboarding/checklist.
- Cursos y progreso.
- Tareas y evidencias.
- Verificación de evidencias con IA.
- Indicadores básicos de desempeño.
- Dashboard RH.
- Auditoría.
- Docker + seed.

### P1 — solo si P0 está estable

- Buddy.
- Recomendación de cursos con IA.
- Tutor IA.
- Encuestas pulse.
- Sentiment analysis.
- Organigrama.
- Resumen IA de desempeño.
- Reporte IA de analytics.

### Fuera del MVP

Nómina, asistencia biométrica, app móvil, SSO, ERP, firma electrónica, videollamadas, ML propio, predicción avanzada de fuga/burnout, evaluación 360 completa y multitenancy.

## 3. Stack

```text
Frontend/Backend: Next.js + React + TypeScript + Tailwind
DB/Auth/Storage: Supabase + PostgreSQL
IA: Gemini API
Fallback: Ollama
Infra: Docker + Docker Compose + Supabase CLI
```

La arquitectura debe ser un monolito modular: Next.js contiene UI, API/BFF, autenticación, módulos de negocio y AI Hub. La IA no se invoca directamente desde React.

## 4. Arquitectura

```text
                    ┌─────────────────────┐
                    │      Next.js        │
                    │ UI + Middleware +   │
                    │ API/BFF + Services  │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
        ┌───────▼────────┐           ┌────────▼───────┐
        │    Supabase    │           │     AI Hub     │
        │ Auth / RLS     │           │ Context Filter │
        │ PostgreSQL     │           │ Prompt Builder │
        │ Storage privado│           │ Schema Validate│
        └────────────────┘           └───────┬────────┘
                                             │
                                      ┌──────┴──────┐
                                      │             │
                                   Gemini        Ollama
```

Regla de seguridad:

```text
AUTH → ROLE → RESOURCE → RLS/POLICY → CONTEXT FILTER → AI
```

La IA nunca decide permisos.

## 5. Roles

| Rol | Acceso principal |
|---|---|
| `SUPERUSER` | usuarios, roles, puestos, auditoría |
| `RH_ADMIN` | reclutamiento, empleados, onboarding, cursos, tareas, analytics |
| `JEFE` | equipo, tareas y desempeño |
| `EMPLEADO` | perfil, onboarding, cursos, tareas, evidencias, desempeño propio |
| `CANDIDATO` | vacantes, CV, postulaciones e entrevistas propias |

## 6. Modelo de datos mínimo

```text
profiles
  id, full_name, email, role

departments
  id, name

positions
  id, name, department_id

candidates
  id, profile_id, phone, cv_path, skills, experience_years

vacancies
  id, position_id, title, description, requirements, skills,
  experience_required, status, created_by

applications
  id, candidate_id, vacancy_id, status,
  ai_score, ai_summary, ai_result, applied_at

interviews
  id, application_id, scheduled_at, notes, status, created_by

employees
  id, profile_id, position_id, department_id,
  manager_id, hire_date, status

onboarding
  id, employee_id, buddy_id, completion_percentage, status

onboarding_items
  id, onboarding_id, title, status, due_date, completed_at

courses
  id, title, description, content, duration_minutes, required

course_assignments
  id, course_id, employee_id, progress, status

tasks
  id, title, description, employee_id, created_by,
  priority, due_date, status

task_evidence
  id, task_id, employee_id, file_path,
  ai_status, ai_confidence, ai_observations, ai_result

performance_reviews
  id, employee_id, period, task_completion,
  course_completion, overall_score, summary

surveys
  id, title, description, active, created_by

survey_questions
  id, survey_id, question, type, options

survey_responses
  id, survey_id, question_id, employee_id, answer

ai_requests
  id, user_id, use_case, provider, status, created_at

ai_results
  id, request_id, result, model, created_at

audit_logs
  id, user_id, action, resource_type, resource_id, metadata, created_at
```

## 7. Estados

### Postulación

```text
POSTULADO → EN_REVISION → PRESELECCIONADO → ENTREVISTA → CONTRATADO
                                                  └──────→ RECHAZADO
```

### Tarea

```text
PENDING → IN_PROGRESS → SUBMITTED → APPROVED
                              └────→ REJECTED → SUBMITTED
```

### Curso

```text
ASSIGNED → IN_PROGRESS → COMPLETED
```

### Onboarding

```text
PENDING → IN_PROGRESS → COMPLETED
```

## 8. Pantallas mínimas

### Públicas

```text
/login
/register
/jobs
/jobs/[id]
```

### Candidato

```text
/candidate
/candidate/applications
/candidate/applications/[id]
/candidate/profile
/candidate/interviews
```

### RH

```text
/rh
/rh/vacancies
/rh/vacancies/new
/rh/vacancies/[id]
/rh/candidates/[id]
/rh/interviews
/rh/employees
/rh/employees/[id]
/rh/onboarding
/rh/courses
/rh/tasks
/rh/performance
/rh/climate
/rh/analytics
/rh/audit
```

### Empleado

```text
/employee
/employee/onboarding
/employee/courses
/employee/courses/[id]
/employee/tasks
/employee/tasks/[id]
/employee/performance
/employee/surveys
```

### Admin

```text
/admin
/admin/users
/admin/positions
/admin/audit
```

## 9. API mínima

```text
GET/POST       /api/vacancies
GET/PATCH/DELETE /api/vacancies/:id

POST/GET       /api/applications
GET            /api/applications/:id
PATCH          /api/applications/:id/status

POST           /api/candidates/cv
GET            /api/candidates/:id/cv-url

POST           /api/ai/recruitment/recommend
POST           /api/ai/recruitment/summary

POST/GET       /api/interviews
PATCH/DELETE   /api/interviews/:id

POST           /api/applications/:id/hire

GET/PATCH      /api/employees/:id
GET            /api/employees

GET            /api/onboarding/me
PATCH          /api/onboarding/items/:id
POST           /api/onboarding/:id/documents

GET/POST       /api/courses
POST           /api/courses/:id/assign
PATCH          /api/course-assignments/:id/progress

GET/POST       /api/tasks
GET/PATCH      /api/tasks/:id
POST           /api/tasks/:id/evidence
POST           /api/ai/task-verification

GET            /api/performance/me
GET            /api/performance/employee/:id
POST           /api/ai/performance-summary

GET/POST       /api/surveys
POST           /api/surveys/:id/respond
GET            /api/surveys/:id/results
POST           /api/ai/sentiment

GET            /api/analytics/kpis
POST           /api/ai/analytics/report
```

## 10. Flujo crítico de contratación

`POST /api/applications/:id/hire` debe ejecutarse únicamente para `RH_ADMIN`.

```text
1. Validar usuario.
2. Validar rol.
3. Validar application.
4. Validar que no esté contratada.
5. Crear employee.
6. Cambiar application → CONTRATADO.
7. Crear onboarding.
8. Crear checklist.
9. Asignar cursos iniciales.
10. Crear tareas iniciales.
11. Registrar audit_log.
```

Debe ser consistente: si una operación crítica falla, no debe quedar una contratación a medias.

## 11. IA

### Recomendación de candidato

Entrada:

```json
{
  "vacancy": {
    "title": "Full Stack Developer",
    "requirements": "...",
    "skills": ["React", "Node.js", "PostgreSQL"]
  },
  "candidate": {
    "skills": ["React", "Node.js"],
    "experience_years": 3,
    "cv_text": "..."
  }
}
```

Salida:

```json
{
  "score": 87,
  "match_level": "HIGH",
  "strengths": ["React", "Node.js"],
  "gaps": ["PostgreSQL"],
  "summary": "Perfil compatible con los requisitos principales."
}
```

### Verificación de evidencia

```json
{
  "status": "APPROVED",
  "confidence": 0.91,
  "observations": ["La evidencia coincide con la tarea."],
  "reason": "La evidencia satisface los criterios definidos."
}
```

La respuesta IA siempre debe pasar por validación de schema antes de actualizar datos.

### Tutor

```text
employee_id + course_id + question
        ↓
validar acceso al curso
        ↓
obtener contenido permitido
        ↓
construir contexto
        ↓
IA
```

### Regla de Prompt Injection

El CV, la evidencia y cualquier documento son **datos**, nunca instrucciones del sistema. No pueden cambiar permisos, revelar secretos ni ordenar acciones administrativas.

## 12. Storage

Buckets privados:

```text
cvs/
task-evidence/
onboarding-documents/
```

Para leer un archivo:

```text
usuario autorizado → API → autorización → signed URL temporal → archivo
```

Nunca utilizar URLs públicas para información sensible.

## 13. Dashboard RH

KPIs mínimos:

```text
Empleados activos
Vacantes activas
Candidatos
Contrataciones
Cursos completados
Tareas completadas
Tareas vencidas
Desempeño promedio
```

Fórmulas:

```text
task_completion = tareas_completadas / tareas_totales * 100
course_completion = cursos_completados / cursos_asignados * 100

overall_score = task_completion * 0.60 + course_completion * 0.40
```

Semáforo:

```text
>= 80  VERDE
60-79  AMARILLO
< 60   ROJO
```

## 14. Seguridad obligatoria

- Supabase Auth.
- Middleware por rol.
- RLS en tablas sensibles.
- Validación de autorización en backend.
- Storage privado.
- Signed URLs.
- API keys únicamente en servidor.
- AI Hub como única puerta hacia Gemini/Ollama.
- Context filtering antes de IA.
- Auditoría de operaciones críticas.

El frontend nunca debe contener `SUPABASE_SERVICE_ROLE_KEY` ni `GEMINI_API_KEY`.

## 15. Estructura del proyecto

```text
src/
├── app/
│   ├── (auth)/
│   ├── admin/
│   ├── rh/
│   ├── manager/
│   ├── employee/
│   ├── candidate/
│   └── api/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   ├── dashboard/
│   └── ai/
├── modules/
│   ├── recruitment/
│   ├── employees/
│   ├── onboarding/
│   ├── training/
│   ├── tasks/
│   ├── performance/
│   ├── climate/
│   └── analytics/
├── lib/
│   ├── auth/
│   ├── supabase/
│   ├── permissions/
│   ├── storage/
│   ├── audit/
│   └── ai/
└── middleware.ts

supabase/
├── migrations/
├── seed.sql
└── config.toml
```

## 16. Plan de 14 días

### Día 1 — Fundación

- [ ] Repositorio.
- [ ] Next.js/TypeScript/Tailwind.
- [ ] Docker.
- [ ] Supabase local.
- [ ] Variables de entorno.
- [ ] Estructura del proyecto.

### Día 2 — Seguridad

- [ ] Auth.
- [ ] Profiles.
- [ ] Roles.
- [ ] Middleware.
- [ ] RLS.
- [ ] Layout por rol.

### Día 3 — Reclutamiento I

- [ ] Departments.
- [ ] Positions.
- [ ] Vacancies.
- [ ] CRUD.
- [ ] Dashboard inicial.

### Día 4 — Reclutamiento II

- [ ] Candidate profile.
- [ ] CV upload.
- [ ] Storage privado.
- [ ] Applications.
- [ ] Estados.

### Día 5 — IA reclutamiento

- [ ] AI Hub.
- [ ] Gemini provider.
- [ ] Prompt.
- [ ] JSON schema.
- [ ] Score.
- [ ] Resumen.

### Día 6 — Entrevistas + auditoría

- [ ] Agenda.
- [ ] Cambio de estados.
- [ ] Candidate detail.
- [ ] Audit logs.

### Día 7 — Contratación

- [ ] Hire endpoint.
- [ ] Employee.
- [ ] Onboarding.
- [ ] Cursos iniciales.
- [ ] Tareas iniciales.
- [ ] Demo end-to-end.

### Día 8 — Onboarding

- [ ] Employee dashboard.
- [ ] Checklist.
- [ ] Buddy.
- [ ] Documentos.

### Día 9 — Cursos

- [ ] CRUD.
- [ ] Assignments.
- [ ] Progreso.
- [ ] Recomendación IA.

### Día 10 — Tareas

- [ ] CRUD.
- [ ] Evidencias.
- [ ] Storage.
- [ ] Verificación IA.

### Día 11 — Desempeño

- [ ] KPIs.
- [ ] Semáforo.
- [ ] Resumen.
- [ ] Organigrama si hay tiempo.

### Día 12 — Clima + Analytics

- [ ] Pulse survey.
- [ ] Sugerencias.
- [ ] Sentiment IA.
- [ ] Dashboard.

### Día 13 — QA y seguridad

- [ ] RLS.
- [ ] RBAC.
- [ ] Storage.
- [ ] Prompt injection.
- [ ] Errores.
- [ ] Seed.
- [ ] E2E.

### Día 14 — Entrega

- [ ] Build.
- [ ] Docker.
- [ ] README.
- [ ] Datos demo.
- [ ] Corrección de bugs.
- [ ] Guion de demo.
- [ ] Presentación.

## 17. Seed demo

Crear como mínimo:

```text
1 SUPERUSER
1 RH_ADMIN
1 JEFE
1 EMPLEADO
1 CANDIDATO

3 departamentos
5 puestos
3 vacantes
5 candidatos
5 aplicaciones
2 entrevistas
5 empleados
5 cursos
10 tareas
10 evidencias
2 encuestas
```

Usuario candidato de demo debe poder completar el flujo completo.

## 18. Pruebas obligatorias

### Auth

- [ ] Login válido.
- [ ] Login inválido.
- [ ] Logout.
- [ ] Sesión expirada.

### RBAC/RLS

- [ ] Candidato no accede a `/rh`.
- [ ] Empleado no accede a `/admin`.
- [ ] Empleado A no ve empleado B.
- [ ] Candidato A no ve candidato B.
- [ ] Jefe solo ve su equipo.

### Storage

- [ ] CV privado.
- [ ] Evidencia privada.
- [ ] Signed URL.
- [ ] Expiración.

### IA

- [ ] JSON válido.
- [ ] Error del proveedor controlado.
- [ ] Prompt injection bloqueado.
- [ ] Contexto limitado por permisos.

### E2E

- [ ] Registro candidato.
- [ ] Postulación.
- [ ] CV.
- [ ] IA.
- [ ] Entrevista.
- [ ] Contratación.
- [ ] Empleado.
- [ ] Onboarding.
- [ ] Curso.
- [ ] Tarea.
- [ ] Evidencia.
- [ ] IA verifica.
- [ ] Dashboard RH.

## 19. Criterios de aceptación

El MVP se considera funcional cuando:

1. Un candidato puede registrarse.
2. Puede ver una vacante y postularse.
3. Puede subir su CV de forma privada.
4. RH puede ver candidatos autorizados.
5. RH puede ejecutar análisis IA.
6. La IA devuelve score, fortalezas, brechas y resumen.
7. RH puede agendar entrevista.
8. RH puede contratar.
9. El sistema crea automáticamente al empleado.
10. Se crea onboarding.
11. Se asignan cursos y tareas.
12. El empleado completa onboarding.
13. El empleado completa un curso.
14. El empleado recibe una tarea.
15. Puede subir evidencia.
16. La IA puede verificarla.
17. Se calcula desempeño.
18. RH ve KPIs.
19. Los permisos se respetan.
20. Las operaciones críticas se auditan.

## 20. Definition of Done

Cada funcionalidad debe tener:

```text
[ ] UI
[ ] Backend
[ ] Validación
[ ] Autorización
[ ] RLS cuando corresponda
[ ] Loading
[ ] Empty state
[ ] Error state
[ ] Datos de prueba
[ ] Sin secretos expuestos
[ ] Docker
[ ] Documentación
```

## 21. Regla de alcance

Si durante el desarrollo una nueva funcionalidad amenaza el flujo principal, se pospone.

La prioridad es:

```text
1. Seguridad
2. Base de datos
3. Reclutamiento
4. Contratación
5. Empleado
6. Onboarding
7. Tareas
8. IA
9. Dashboard
10. UX avanzada
```

El resultado final debe ser un MVP que pueda demostrarse de principio a fin sin editar manualmente la base de datos.
