# PRD --- Sistema Integral de Gestión de Talento Humano con IA.

**Versión:** 1.0\
**Fecha:** 10 de septiembre de 2026\
**Plazo de desarrollo:** 2 semanas\
**Tipo de entrega:** MVP funcional académico / prototipo demostrable\
**Base:** Documento "IDEAS PARA EL SISTEMA"

---

## 1. Resumen ejecutivo

El proyecto consiste en desarrollar una plataforma web integral de
Recursos Humanos que centralice reclutamiento, gestión de empleados,
onboarding, capacitación, desempeño, clima laboral y analíticas de
People Analytics.

La plataforma utilizará inteligencia artificial como una capa
transversal para apoyar decisiones y automatizar tareas, pero **la IA no
tendrá autoridad para saltarse permisos**. El acceso a información
estará determinado primero por autenticación, roles, políticas de base
de datos y filtros de contexto; posteriormente la IA podrá trabajar
únicamente con la información que el usuario tenga autorización para
consultar. Se priorizan los flujos que conectan los
módulos principales:

> Usuario → Reclutamiento → Candidato contratado → Onboarding → Empleado
> → Capacitación/Tareas → Desempeño → Dashboard RH.

---

## 2. Problema

La información de Recursos Humanos suele encontrarse distribuida entre
procesos y herramientas independientes. Esto provoca:

- Duplicidad de información.
- Falta de trazabilidad del ciclo de vida del colaborador.
- Dificultad para dar seguimiento a candidatos.
- Procesos manuales de onboarding y capacitación.
- Poca visibilidad del desempeño.
- Dificultad para identificar pendientes y riesgos.
- Reportes que requieren análisis manual.
- Riesgo de exponer información sensible a usuarios o sistemas de IA
  sin autorización.

El sistema busca resolver estos problemas mediante una fuente
centralizada de información y flujos automatizados entre módulos.

---

## 3. Objetivo general

Construir un MVP web de Recursos Humanos que permita
administrar usuarios, candidatos, vacantes y empleados, automatizar el
flujo de contratación hacia onboarding, gestionar tareas y capacitación,
mostrar indicadores de desempeño y utilizar IA para recomendaciones,
resúmenes y verificación de evidencias, manteniendo control de acceso
por roles.

---

## 4. Objetivos específicos

1.  Implementar autenticación y RBAC.
2.  Permitir al superusuario administrar usuarios y roles.
3.  Permitir a RH crear y gestionar vacantes.
4.  Permitir a candidatos cargar CV y consultar el estado de su
    postulación.
5.  Utilizar IA para recomendar candidatos para una vacante.
6.  Permitir cambiar el estado de una postulación y agendar entrevistas.
7.  Convertir automáticamente un candidato contratado en empleado.
8.  Crear un flujo inicial de onboarding con checklist y documentos.
9.  Administrar cursos y progreso de capacitación.
10. Permitir asignar tareas y cargar evidencias.
11. Utilizar IA para verificar evidencias de tareas.
12. Mostrar indicadores de desempeño y una vista jerárquica de
    empleados.
13. Permitir encuestas de clima laboral y análisis básico de
    comentarios.
14. Centralizar KPIs de RH.
15. Implementar un Hub de IA mediante API Proxy/BFF.
16. Registrar eventos críticos mediante auditoría.

---

# 5. Alcance del MVP

## 5.1 Incluido

### Administración

- Login/logout.
- Gestión de usuarios.
- Gestión de roles.
- Gestión básica de puestos.
- Perfil de usuario.
- Protección de rutas.

### Reclutamiento

- CRUD de vacantes.
- Publicación/activación de vacantes.
- Postulación de candidatos.
- Carga de CV.
- Listado de candidatos por vacante.
- Estados de postulación.
- Recomendación de CV mediante IA.
- Resumen del candidato mediante IA.
- Agenda básica de entrevista.
- Cambio a contratado.

### Empleados

- Alta automática desde contratación.
- Listado y filtros.
- Perfil resumido.
- Puesto y área.
- Estado de desempeño.
- Progreso de cursos.
- Progreso de tareas.
- Árbol jerárquico básico.

### Onboarding

- Checklist.
- Carga segura de documentos.
- Cursos iniciales.
- Visualización del progreso.

### Capacitación

- Catálogo de cursos.
- Inscripción/asignación.
- Progreso.
- Estado de completado.
- Recomendaciones de cursos mediante IA.
- Tutor IA básico.
- Evaluaciones/cuestionarios simples.

### Tareas y desempeño

- Crear tareas.
- Asignar tareas.
- Fecha límite.
- Subida de evidencia.
- Verificación IA.
- Estado aprobado/rechazado.
- Indicadores de cumplimiento.
- Autoevaluación asistida por IA.
- Resumen de desempeño para RH/jefe.

### Clima laboral

- Encuestas tipo pulse.
- Respuestas.
- Buzón de sugerencias.
- Análisis de sentimiento básico mediante IA.
- Resultados agregados.

### People Analytics

- Rotación.
- Cursos completados.
- Tareas completadas.
- Estado general de desempeño.
- Reporte ejecutivo generado mediante IA a partir de datos
  autorizados.

### Orquestación

- Eventos entre módulos.
- Contratación → onboarding.
- Contratación → cursos iniciales.
- Contratación → empleado.
- Contratación → metas/tareas iniciales.
- Auditoría.
- Hub IA.

---

# 6. Fuera de alcance

Estas funciones podrán quedar como extensiones posteriores:

- Nómina.
- Control de asistencia biométrico.
- Integraciones con ERP.
- Integraciones con bolsas de trabajo externas.
- Videollamadas integradas.
- Firma electrónica legal.
- Motor avanzado de predicción de rotación.
- Modelo ML propio para burnout.
- Sistema avanzado de compensaciones.
- Evaluación 360° completa.
- Automatizaciones empresariales complejas.
- Aplicación móvil nativa.
- Multiempresa/multitenant completo.
- Integraciones corporativas SSO.
- Entrenamiento de modelos de IA propios.

---

# 7. Usuarios y roles

## 7.1 Superusuario

Responsable de administración global.

Permisos principales:

- Crear usuarios.
- Editar usuarios.
- Desactivar usuarios.
- Asignar roles.
- Gestionar puestos.
- Consultar configuración global.
- Consultar auditoría.

No debe utilizarse como rol cotidiano para operaciones de RH.

## 7.2 RH_Admin

Responsable de procesos de Recursos Humanos.

Puede:

- Crear y gestionar vacantes.
- Consultar postulantes.
- Revisar recomendaciones de IA.
- Gestionar entrevistas.
- Contratar candidatos.
- Gestionar empleados.
- Gestionar onboarding.
- Gestionar cursos.
- Gestionar encuestas.
- Consultar dashboards.
- Generar reportes.
- Consultar información agregada de desempeño.

## 7.3 Jefe / Administrador de área

Puede:

- Consultar colaboradores de su área.
- Crear tareas.
- Consultar desempeño de su equipo.
- Revisar evidencias.
- Consultar progreso de cursos.
- Generar feedback asistido por IA.

**Nota:** el documento base define explícitamente Superusuario,
RH_Admin, Empleado y Candidato. Para cumplir las necesidades de tareas,
desempeño y equipos, este PRD propone `Jefe` como rol opcional del MVP.
Si el tiempo es crítico, puede resolverse inicialmente con permisos de
`RH_Admin`.

## 7.4 Empleado

Puede:

- Ver su dashboard.
- Consultar onboarding.
- Consultar cursos.
- Realizar capacitaciones.
- Consultar tareas.
- Subir evidencias.
- Consultar encuestas.
- Completar autoevaluación.
- Consultar feedback privado.

No puede consultar información privada de otros empleados.

## 7.5 Candidato

Puede:

- Crear/usar su cuenta.
- Completar perfil.
- Subir CV.
- Consultar vacantes.
- Postularse.
- Consultar estado de sus postulaciones.
- Consultar entrevistas agendadas.
- Recibir notificaciones.

No puede consultar información de otros candidatos.

---

# 8. Requisitos funcionales

## RF-01 --- Autenticación

El sistema deberá permitir:

- Inicio de sesión.
- Cierre de sesión.
- Recuperación de sesión.
- Identificación del usuario mediante Supabase Auth.
- Asociación del usuario autenticado con su perfil y rol.

**Prioridad:** P0.

---

## RF-02 --- Control de acceso

El sistema deberá implementar RBAC.

Cada petición deberá validar:

1.  Usuario autenticado.
2.  Rol.
3.  Recurso solicitado.
4.  Permisos sobre el recurso.
5.  Contexto de la operación.

La seguridad deberá existir tanto en frontend como en backend y base de
datos.

**Prioridad:** P0.

---

## RF-03 --- Gestión de usuarios

El Superusuario podrá:

- Crear usuario.
- Asignar rol.
- Activar/desactivar usuario.
- Consultar información básica.
- Asociar empleado/candidato con cuenta.

**Prioridad:** P0.

---

## RF-04 --- Gestión de vacantes

RH podrá:

- Crear vacante.
- Editar vacante.
- Activar/desactivar vacante.
- Definir:
  - Puesto.
  - Área.
  - Descripción.
  - Requisitos.
  - Habilidades.
  - Experiencia.
  - Estado.
- Consultar cantidad de postulantes.

**Prioridad:** P0.

---

## RF-05 --- Postulación

Un candidato podrá:

- Ver vacantes disponibles.
- Consultar detalles.
- Adjuntar CV.
- Enviar postulación.
- Consultar estado.

Estados mínimos:

```text
POSTULADO
EN_REVISION
PRESELECCIONADO
ENTREVISTA
CONTRATADO
RECHAZADO
```

**Prioridad:** P0.

---

## RF-06 --- Recomendación IA de candidatos

RH podrá solicitar una recomendación de candidatos.

La IA deberá recibir únicamente:

- Información de la vacante.
- Requisitos.
- Habilidades.
- Experiencia relevante.
- Información autorizada del CV.

La respuesta deberá estructurarse como JSON.

Ejemplo conceptual:

```json
{
  "candidate_id": "uuid",
  "score": 87,
  "match_level": "alto",
  "strengths": ["Experiencia en React", "Experiencia en PostgreSQL"],
  "gaps": ["Poca experiencia en liderazgo"],
  "summary": "Perfil altamente compatible con los requisitos principales."
}
```

La recomendación será **asistiva**, no una decisión automática de
contratación.

**Prioridad:** P0.

---

## RF-07 --- Visualizador de candidatos

RH deberá poder:

1.  Seleccionar una vacante.
2.  Ver cantidad de candidatos.
3.  Ver candidatos ordenados por recomendación IA.
4.  Abrir un candidato.
5.  Consultar resumen.
6.  Consultar CV.
7.  Cambiar estado.

El CV deberá utilizar URL firmada temporal.

**Prioridad:** P0.

---

## RF-08 --- Entrevistas

RH podrá:

- Agendar entrevista.
- Definir fecha/hora.
- Agregar notas.
- Asociar entrevista a candidato.
- Cambiar estado a entrevista.

El candidato deberá visualizar que tiene una entrevista agendada.

**Prioridad:** P1.

---

## RF-09 --- Contratación

Al marcar un candidato como `CONTRATADO`:

1.  Crear/activar registro de empleado.
2.  Asociar puesto.
3.  Asociar área.
4.  Crear onboarding.
5.  Asignar checklist inicial.
6.  Asignar cursos iniciales.
7.  Crear tareas iniciales.

Este flujo deberá ejecutarse mediante el orquestador de eventos.

**Prioridad:** P0.

---

# 9. Onboarding

## RF-10 --- Checklist de onboarding

El empleado deberá visualizar una lista de tareas:

- Documentación.
- Presentación con equipo.
- Lectura de reglamentos.
- Curso inicial.
- Configuración inicial.

Cada elemento tendrá:

```text
PENDIENTE
EN_PROGRESO
COMPLETADO
```

**Prioridad:** P0.

---

## RF-11 --- Documentos

Los documentos sensibles deberán:

- Guardarse en bucket privado.
- No ser accesibles mediante URL pública.
- Generar URL firmada.
- Expirar después de un periodo corto.

**Prioridad:** P0.

---

# 10. Capacitación

## RF-12 --- Cursos

RH podrá crear:

- Nombre.
- Descripción.
- Contenido.
- Duración.
- Área.
- Nivel.
- Curso obligatorio/opcional.

El empleado podrá consultar sus cursos asignados.

**Prioridad:** P0.

---

## RF-13 --- Ruta de aprendizaje IA

La IA podrá recomendar cursos utilizando:

- Puesto.
- Perfil.
- Cursos completados.
- Habilidades.
- Brechas detectadas.

Resultado esperado:

```json
{
  "recommendations": [
    {
      "course_id": "uuid",
      "reason": "Fortalece una habilidad requerida para el puesto.",
      "priority": "alta"
    }
  ]
}
```

**Prioridad:** P1.

## RF-14 --- Tutor IA

El empleado podrá realizar preguntas relacionadas con el contenido de
capacitación.

El tutor deberá:

- Responder preguntas.
- Explicar conceptos.
- Evitar inventar contenido cuando se configure con material
  específico.
- Respetar el contexto permitido.

**Prioridad:** P1.
------------------------------------------------------------------------

## RF-15 --- Evaluaciones

El sistema podrá generar preguntas utilizando IA a partir del contenido
de un curso.

El MVP podrá limitarse a:

- Opción múltiple.
- 5 preguntas por evaluación.
- Calificación automática.

**Prioridad:** P1.

---

# 11. Tareas y evidencias

## RF-16 --- Creación de tareas

Jefe/RH podrá crear:

- Título.
- Descripción.
- Fecha límite.
- Prioridad.
- Empleado asignado.

**Prioridad:** P0.

---

## RF-17 --- Evidencia

El empleado podrá cargar:

- PDF.
- Imagen.
- Captura.
- Documento compatible.

La evidencia quedará asociada a la tarea.

**Prioridad:** P0.

---

## RF-18 --- Verificación IA

El backend enviará a la IA:

- Descripción de tarea.
- Evidencia.
- Contexto necesario.

La IA devolverá JSON:

```json
{
  "status": "approved",
  "confidence": 0.91,
  "observations": "La evidencia contiene información consistente con la tarea.",
  "reason": "El documento demuestra la realización de la actividad."
}
```

Estados:

```text
PENDIENTE
EN_REVISION
APROBADO
RECHAZADO
```

La IA no deberá poder modificar directamente la base de datos.

El backend validará y procesará la respuesta.

**Prioridad:** P0.

---

# 12. Desempeño

## RF-19 --- Indicadores

El sistema deberá calcular indicadores como:

- Porcentaje de tareas completadas.
- Porcentaje de cursos completados.
- Tareas vencidas.
- Cursos pendientes.
- Cumplimiento general.

Semáforo:

```text
VERDE     = buen desempeño
AMARILLO  = desempeño normal / requiere seguimiento
ROJO      = desempeño bajo / requiere atención
```

Los umbrales deberán configurarse como constantes del MVP.

**Prioridad:** P0.

---

## RF-20 --- Árbol organizacional

RH/Jefe podrá visualizar una estructura:

```text
Empresa
├── Área
│   ├── Jefe
│   │   ├── Empleado
│   │   └── Empleado
│   └── Empleado
└── Área
    └── Empleado
```

Cada nodo mostrará:

- Nombre.
- Puesto.
- Área.
- Indicador de desempeño.

Al seleccionar un empleado, se mostrará un resumen.

**Prioridad:** P1.

---

## RF-21 --- Resumen IA de empleado

La IA podrá generar un resumen basado exclusivamente en datos
autorizados:

- Cursos.
- Tareas.
- Cumplimiento.
- Evaluaciones.
- Información de desempeño disponible.

Debe evitar datos sensibles o información fuera del alcance del usuario.

**Prioridad:** P1.

---

# 13. Autoevaluación

## RF-22 --- Autoevaluación conversacional

El empleado podrá responder preguntas mediante una interfaz tipo chat.

Preguntas ejemplo:

- ¿Cuáles fueron tus principales logros?
- ¿Qué retos enfrentaste?
- ¿Qué objetivos cumpliste?
- ¿Qué deseas mejorar?

La IA generará un borrador estructurado.

El empleado deberá poder editarlo antes de enviarlo.

**Prioridad:** P1.

---

# 14. Alertas y feedback

## RF-23 --- Alertas de tareas

El sistema podrá identificar:

- Tareas próximas a vencer.
- Tareas vencidas.
- Alta concentración de pendientes.

Se mostrará una alerta al empleado.

**Prioridad:** P1.

---

## RF-24 --- Feedback privado

El empleado podrá recibir recomendaciones personales generadas por IA
utilizando únicamente información de su propio desempeño.

**Prioridad:** P2.

---

# 15. Clima laboral

## RF-25 --- Pulse Surveys

RH podrá crear encuestas cortas.

Tipos:

- Escala.
- Opción múltiple.
- Comentario.

El empleado podrá responder desde su dashboard.

**Prioridad:** P1.

---

## RF-26 --- Buzón anónimo

El empleado podrá enviar comentarios sin exponer su identidad al resto
de empleados.

El sistema deberá proteger la asociación entre comentario e identidad.

**Prioridad:** P1.

---

## RF-27 --- Sentiment Analysis

La IA podrá clasificar comentarios agregados como:

```text
POSITIVO
NEUTRO
NEGATIVO
```

El sistema deberá presentar tendencias, no utilizar la clasificación
como una decisión automática sobre una persona.

**Prioridad:** P1.

---

# 16. People Analytics

## RF-28 --- Dashboard RH

El dashboard deberá mostrar al menos:

- Total de empleados.
- Total de candidatos.
- Vacantes activas.
- Contrataciones.
- Cursos completados.
- Tareas completadas.
- Distribución de desempeño.
- Resultados de clima.

**Prioridad:** P0.

---

## RF-29 --- Copiloto de reportes

RH podrá escribir preguntas como:

> "Genera un análisis del avance de capacitación del área de ventas."

El backend deberá transformar la petición en una consulta/estructura
controlada y proporcionar a la IA únicamente los datos permitidos.

La IA devolverá:

- Resumen.
- Hallazgos.
- Recomendaciones.

**Prioridad:** P1.

---

# 17. Orquestador

## RF-31 --- Eventos

Se propone una arquitectura basada en eventos simples.

Eventos iniciales:

```text
candidate.hired
onboarding.created
course.assigned
task.created
task.completed
task.verified
survey.completed
```

Ejemplo:

```text
candidate.hired
       ↓
crear empleado
       ↓
crear onboarding
       ↓
asignar buddy
       ↓
asignar cursos iniciales
       ↓
crear tareas iniciales
```

Para el MVP no se requiere un broker externo. Se podrá implementar
mediante funciones de servicio y transacciones PostgreSQL.

**Prioridad:** P0.

---

# 18. Hub de IA

## RF-32 --- Arquitectura IA

Todas las llamadas de IA deberán pasar por:

```text
Frontend
   ↓
Next.js API Route / BFF
   ↓
Auth + RBAC
   ↓
Context Filter
   ↓
AI Service
   ↓
Gemini / Ollama
```

El frontend **nunca** deberá contener:

- Gemini API Key.
- Supabase Service Role Key.

**Prioridad:** P0.

---

## RF-33 --- Casos de uso IA

El Hub deberá centralizar:

---

Caso Entrada Salida

---

Recomendación CV Vacante + CV autorizado Score + fortalezas +
brechas

Resumen candidato CV autorizado Resumen

Verificación tarea Descripción + evidencia JSON de aprobación

Cursos Perfil + puesto Recomendaciones

Tutor Pregunta + contexto Respuesta

Evaluación Contenido curso Preguntas

Desempeño Datos autorizados Resumen

Clima Comentarios Sentimiento

Reporte RH KPIs autorizados Análisis
-----------------------------------------------------------------------

---

# 19. Seguridad

## 19.1 Principio

La seguridad debe funcionar como:

```text
AUTH → ROLE → RESOURCE → POLICY → CONTEXT → AI
```

La IA nunca será una fuente de autorización.

---

## 19.2 Supabase Auth

Se utilizará Supabase Auth para autenticación.

Se asociará cada usuario a un perfil:

```text
auth.users
     │
     └── profiles
            ├── id
            ├── role
            ├── employee_id
            └── candidate_id
```

---

## 19.3 RLS

Se habilitará Row Level Security en tablas críticas.

Ejemplo conceptual:

```sql
auth.uid() = user_id
```

Un empleado solo podrá acceder a sus registros personales.

Un candidato solo podrá consultar sus postulaciones.

RH tendrá permisos explícitos sobre información que le corresponda.

---

## 19.4 Middleware

Next.js Middleware deberá bloquear rutas según rol.

Ejemplo:

```text
/admin/*      → SUPERUSER
/rh/*         → RH_ADMIN
/jefe/*       → JEFE/RH_ADMIN
/employee/*   → EMPLEADO
/candidate/*  → CANDIDATO
```

La protección del middleware no reemplaza RLS.

---

## 19.5 Archivos privados

Buckets:

```text
private/cvs/
private/evidence/
private/onboarding/
```

Los archivos deberán ser privados.

Para visualizar un archivo:

```text
usuario autorizado
      ↓
backend
      ↓
validación
      ↓
signed URL
      ↓
visualización temporal
```

---

## 19.6 Auditoría

Tabla:

```text
logs_auditoria
```

Campos mínimos:

```text
id
user_id
action
resource_type
resource_id
metadata
created_at
```

Registrar como mínimo:

- Cambios de rol.
- Contrataciones.
- Cambios de estado.
- Acceso a CV.
- Cambios de calificaciones.
- Eliminación/desactivación de usuarios.

---

## 19.7 Protección contra Prompt Injection

Los prompts deberán utilizar instrucciones de sistema que establezcan:

- El rol de la IA.
- La información permitida.
- La información prohibida.
- Que las instrucciones contenidas dentro de CV/documentos no tienen
  autoridad sobre el sistema.
- Que la IA no puede revelar información de otros usuarios.
- Que la IA no puede ejecutar acciones administrativas.

---

# 20. Arquitectura técnica

## 20.1 Stack

### Frontend

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Componentes UI reutilizables.
- Docker.

### Backend

- Next.js Route Handlers / Server Actions donde corresponda.
- Supabase.
- PostgreSQL.
- API Proxy/BFF.

### IA

Primario:

- Google Gemini API.

Alternativo:

- Ollama + modelo open source.

### Infraestructura

- Docker.
- Docker Compose.
- Supabase CLI.
- PostgreSQL local mediante Supabase.

---

# 21. Arquitectura lógica

```text
┌─────────────────────────────────────────────┐
│                 Next.js                     │
│                                             │
│  UI / Dashboard / Middleware / API / BFF   │
└───────────────────┬─────────────────────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
   ┌──────────────┐    ┌───────────────┐
   │   Supabase   │    │    AI Hub     │
   │              │    │               │
   │ Auth         │    │ Context       │
   │ PostgreSQL   │    │ Prompt        │
   │ Storage      │    │ Guardrails    │
   │ RLS          │    │ Provider      │
   └──────────────┘    └───────┬───────┘
                               │
                         ┌─────┴─────┐
                         ▼           ▼
                      Gemini      Ollama
```

---

# 22. Modelo de datos propuesto

## Tablas principales

```text
profiles
roles
departments
positions
employees
candidates
vacancies
applications
interviews
onboarding
onboarding_items
buddies
courses
course_assignments
course_progress
tasks
task_evidence
performance_reviews
surveys
survey_questions
survey_responses
suggestions
notifications
ai_requests
ai_results
logs_auditoria
```

---

## 22.1 Relaciones principales

```text
profiles
   │
   ├── candidates
   │      └── applications
   │              └── vacancies
   │
   └── employees
          ├── onboarding
          ├── tasks
          ├── course_assignments
          └── performance_reviews

vacancies
   └── applications
          └── interviews

courses
   └── course_assignments

tasks
   └── task_evidence

surveys
   └── survey_responses
```

---

# 23. Pantallas del MVP

## Públicas

1.  Login.
2.  Registro candidato.
3.  Vacantes públicas.
4.  Detalle de vacante.

## Candidato

5.  Dashboard candidato.
6.  Mis postulaciones.
7.  Detalle de postulación.
8.  Entrevistas.
9.  Perfil/CV.

## RH

10. Dashboard RH.
11. Vacantes.
12. Crear vacante.
13. Detalle de vacante.
14. Candidatos.
15. Detalle de candidato.
16. Comparador/recomendación IA.
17. Entrevistas.
18. Empleados.
19. Organigrama.
20. Onboarding.
21. Cursos.
22. Tareas.
23. Desempeño.
24. Clima.
25. People Analytics.
26. Reportes IA.
27. Auditoría.

## Empleado

28. Dashboard empleado.
29. Onboarding.
30. Mis cursos.
31. Tutor IA.
32. Mis tareas.
33. Subir evidencia.
34. Mi desempeño.
35. Encuestas.
36. Buzón.

## Superusuario

37. Usuarios.
38. Roles.
39. Puestos.
40. Auditoría.

---

# 24. Dashboard por rol

## Dashboard RH

Tarjetas:

```text
Vacantes activas
Postulantes
Entrevistas
Contrataciones
Empleados
Cursos pendientes
Tareas pendientes
```

Gráficas:

- Contrataciones por periodo.
- Candidatos por vacante.
- Desempeño.
- Capacitación.
- Clima.

---

## Dashboard empleado

Mostrar:

```text
Mi progreso de onboarding
Cursos pendientes
Tareas pendientes
Próxima entrevista/reunión
Encuestas pendientes
Indicador de desempeño
```

---

## Dashboard candidato

Mostrar:

```text
Postulaciones
Estado actual
Próxima entrevista
Notificaciones
```

---

# 25. UX/UI

La interfaz deberá priorizar:

- Claridad.
- Pocas acciones por pantalla.
- Dashboards con tarjetas.
- Tablas con filtros.
- Estados mediante badges.
- Semáforos de desempeño.
- Formularios simples.
- Diseño responsive.
- Navegación por rol.

Las funciones de IA deberán distinguirse visualmente de los datos
originales.

Ejemplo:

> **Recomendación IA:** Perfil altamente compatible.

Debe aclararse que es una recomendación y no una decisión automática.

---

# 26. Notificaciones

MVP:

- Notificaciones internas.

Eventos:

- Entrevista agendada.
- Cambio de estado de postulación.
- Nueva tarea.
- Tarea próxima a vencer.
- Curso pendiente.
- Curso asignado.
- Nueva encuesta.
- Contratación/onboarding.

Correo electrónico queda como extensión.

---

# 27. Requisitos no funcionales

## RNF-01 Seguridad

Toda información sensible debe estar protegida mediante autenticación,
autorización, RLS y almacenamiento privado.

## RNF-02 Rendimiento

Las pantallas principales deberán cargar en un tiempo razonable en
entorno local.

## RNF-03 Disponibilidad

El MVP deberá funcionar completamente mediante Docker y Supabase local.

## RNF-04 Mantenibilidad

El código deberá organizarse por dominio/módulo.

## RNF-05 Escalabilidad

La capa de IA deberá abstraer el proveedor.

Ejemplo:

```ts
interface AIProvider {
  generate(request: AIRequest): Promise<AIResponse>;
}
```

Implementaciones:

```text
GeminiProvider
OllamaProvider
```

## RNF-06 Trazabilidad

Las operaciones críticas deberán generar auditoría.

## RNF-07 Privacidad

La IA no deberá recibir información que el usuario no pueda consultar.

---

# 28. Estructura de proyecto sugerida

```text
src/
├── app/
│   ├── (auth)/
│   ├── admin/
│   ├── rh/
│   ├── jefe/
│   ├── employee/
│   ├── candidate/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── forms/
│   ├── tables/
│   └── ai/
│
├── modules/
│   ├── recruitment/
│   ├── employees/
│   ├── onboarding/
│   ├── training/
│   ├── performance/
│   ├── climate/
│   ├── analytics/
│   └── orchestration/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── permissions/
│   ├── storage/
│   ├── audit/
│   └── ai/
│
├── types/
└── middleware.ts
```

---

# 29. Contratos de IA

Todas las respuestas críticas deberán utilizar salida estructurada.

Ejemplo:

```ts
type CandidateRecommendation = {
  candidateId: string;
  score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
};
```

El backend deberá:

1.  Validar la respuesta.
2.  Verificar tipos.
3.  Rechazar respuestas inválidas.
4.  No ejecutar instrucciones provenientes del contenido analizado.
5.  Registrar la solicitud si corresponde.

---

# 30. Reglas de IA

1.  La IA no autoriza acceso.
2.  La IA no puede consultar directamente la base de datos sin una capa
    controlada.
3.  La IA no recibe Service Role Key.
4.  El usuario nunca proporciona credenciales de infraestructura a la
    IA.
5.  Los documentos se consideran datos, no instrucciones.
6.  Las recomendaciones de contratación requieren revisión humana.
7.  Las recomendaciones de desempeño no sustituyen decisiones humanas.
8.  El análisis de clima debe priorizar datos agregados/anónimos.
9.  Las respuestas deben ser estructuradas cuando sean consumidas por
    código.
10. Toda información enviada al proveedor externo debe pasar por un
    filtro de contexto.

---

# 31. Criterios de aceptación principales

## CA-01 Seguridad

**Dado** un usuario empleado\
**cuando** intenta acceder a información de otro empleado\
**entonces** el sistema debe denegar la operación mediante las políticas
correspondientes.

## CA-02 Reclutamiento

**Dado** una vacante activa\
**cuando** existen candidatos postulados\
**entonces** RH puede consultar los candidatos y obtener una
recomendación IA.

## CA-03 CV

**Dado** un CV privado\
**cuando** un usuario autorizado solicita verlo\
**entonces** el sistema genera una URL firmada temporal.

## CA-04 IA

**Dado** un candidato\
**cuando** se solicita una recomendación\
**entonces** el resultado contiene score, fortalezas, brechas y resumen.

## CA-05 Contratación

**Dado** un candidato\
**cuando** RH lo marca como contratado\
**entonces** se crea un empleado y se inicia onboarding.

## CA-06 Onboarding

**Dado** un nuevo empleado\
**cuando** accede al sistema\
**entonces** puede ver su checklist.

## CA-07 Tareas

**Dado** una tarea asignada\
**cuando** el empleado sube evidencia\
**entonces** el sistema puede enviarla al verificador IA y guardar el
resultado.

## CA-08 Dashboard

**Dado** un RH_Admin\
**cuando** entra al dashboard\
**entonces** puede consultar KPIs autorizados.

## CA-09 IA y permisos

**Dado** un usuario sin permiso sobre información de un empleado\
**cuando** solicite a la IA información sobre dicho empleado\
**entonces** la capa de contexto deberá impedir que esa información sea
enviada al modelo.

---

# 35. Datos de demostración

Para facilitar la presentación se deberá incluir un seed con:

- 1 Superusuario.
- 2 usuarios RH.
- 2 jefes.
- 5 empleados.
- 5 candidatos.
- 3 vacantes.
- 2 entrevistas.
- 5 cursos.
- 10 tareas.
- Evidencias.
- 2 encuestas.
- Respuestas de clima.

El seed debe permitir demostrar:

```text
Candidato
   ↓
Postulación
   ↓
IA recomienda
   ↓
Entrevista
   ↓
Contratado
   ↓
Empleado
   ↓
Onboarding
   ↓
Curso
   ↓
Tarea
   ↓
Evidencia
   ↓
IA verifica
   ↓
Desempeño
   ↓
Dashboard RH
```

---

# 36. Estrategia de pruebas

## Unitarias

Probar:

- Funciones de permisos.
- Cálculo de KPIs.
- Cálculo de semáforo.
- Validación de respuestas IA.
- Transiciones de estados.

## Integración

Probar:

- Auth + perfiles.
- RLS.
- Storage.
- Postulación.
- Contratación.
- Onboarding.
- Tareas + evidencias.
- AI Hub.

## End-to-end

Escenario principal:

```text
1. Login RH
2. Crear vacante
3. Login candidato
4. Postularse
5. Subir CV
6. Login RH
7. Ejecutar recomendación IA
8. Seleccionar candidato
9. Agendar entrevista
10. Contratar
11. Login empleado
12. Completar onboarding
13. Tomar curso
14. Completar tarea
15. Subir evidencia
16. Verificación IA
17. RH consulta desempeño
```

---

# 37. Riesgos

---

Riesgo Impacto Mitigación

---

IA tarda o falla Alto Mock/fallback + Ollama

Gemini free tier Medio Cachear resultados y
limitado reducir llamadas

RLS mal configurado Crítico Pruebas por rol

Scope demasiado grande Crítico Priorizar P0

UI consume demasiado Alto Componentes
tiempo reutilizables

CV complejo Medio Soportar PDF primero

IA genera JSON inválido Medio Validación con schema

Prompt injection Alto Context filtering +
system instructions

Datos demo Medio Seed desde la primera
insuficientes semana

Docker falla al final Alto Probar desde día 1
-----------------------------------------------------------------------

---

# 38. Decisiones técnicas importantes

## 38.1 No construir microservicios

Se utilizara un monolito modular:

```text
Next.js
 ├── UI
 ├── API
 ├── Auth
 ├── módulos
 └── AI Hub
```

Esto reduce complejidad y acelera desarrollo.

## 38.2 No construir un broker de eventos

Usar servicios internos y transacciones.

El patrón puede evolucionar posteriormente hacia un sistema de eventos
real.

## 38.3 IA desacoplada

Nunca llamar Gemini directamente desde componentes React.

Usar:

```text
AIService
   └── AIProvider
          ├── Gemini
          └── Ollama
```

## 38.4 Seguridad antes que IA

Primero:

```text
Auth
RBAC
RLS
Context filtering
```

Después:

```text
AI
```

---

# 39. Definition of Done

Una funcionalidad se considera terminada cuando:

- [ ] Funciona en frontend.
- [ ] Tiene validación.
- [ ] Tiene autorización.
- [ ] Tiene RLS cuando aplica.
- [ ] Maneja errores.
- [ ] Tiene estado de loading.
- [ ] Tiene estado vacío.
- [ ] No expone secretos.
- [ ] Tiene datos de prueba.
- [ ] Puede ejecutarse con Docker.
- [ ] Está documentada.
- [ ] No rompe los flujos existentes.

---

# 40. Definition of Done del MVP

El MVP estará listo cuando se pueda ejecutar satisfactoriamente el
siguiente escenario:

> Un candidato se registra, consulta una vacante, sube su CV y se
> postula. RH observa la vacante y los postulantes, solicita una
> recomendación mediante IA, revisa el CV y el resumen, agenda una
> entrevista y cambia al candidato a contratado. El sistema crea
> automáticamente su registro como empleado, onboarding, cursos y
> tareas. El empleado inicia sesión, completa elementos del onboarding,
> toma un curso, recibe una tarea, sube una evidencia y la IA ayuda a
> verificarla. RH puede consultar el progreso, el desempeño y los KPIs
> desde un dashboard protegido por roles.

---

# 41. Guion de demostración recomendado

## Escena 1 --- Seguridad

Entrar como candidato y demostrar que no puede acceder a `/rh`.

Después entrar como RH y mostrar el dashboard.

## Escena 2 --- Reclutamiento

Crear una vacante:

```text
Desarrollador Full Stack
```

Mostrar postulantes.

Ejecutar IA.

Mostrar:

- Score.
- Fortalezas.
- Brechas.
- Resumen.

## Escena 3 --- Contratación

Cambiar candidato a entrevista.

Agendar.

Cambiar a contratado.

Mostrar la transición automática.

## Escena 4 --- Onboarding

Entrar como empleado.

Mostrar:

- Checklist.
- Buddy.
- Cursos.
- Documentos.

## Escena 5 --- Capacitación

Abrir curso.

Mostrar progreso.

Hacer una pregunta al tutor IA.

## Escena 6 --- Tarea

Crear tarea.

Empleado sube evidencia.

Ejecutar verificación IA.

Mostrar:

```text
APROBADO
```

## Escena 7 --- Analytics

Regresar a RH.

Mostrar:

- Progreso.
- Desempeño.
- Semáforo.
- KPIs.
- Resumen IA.

## Escena 8 --- Seguridad IA

Realizar una petición intentando obtener información no autorizada y
demostrar que el Hub IA no proporciona datos fuera del contexto
permitido.

---

# 42. Entregables

1.  Código fuente.
2.  Dockerfile.
3.  Docker Compose.
4.  Configuración Supabase local.
5.  Migraciones SQL.
6.  Seed de datos.
7.  Variables de entorno de ejemplo.
8.  README.
9.  Documentación de arquitectura.
10. Documentación de roles.
11. Documentación del Hub IA.
12. Casos de prueba.
13. Guion de demostración.
14. Presentación técnica.

---

# 43. README mínimo requerido

El proyecto deberá incluir instrucciones equivalentes a:

```bash
git clone <repo>
cd <project>

cp .env.example .env.local

docker compose up -d

npx supabase start

npm install

npm run dev
```

El README deberá explicar:

- Requisitos.
- Instalación.
- Variables de entorno.
- Supabase.
- Gemini.
- Ollama opcional.
- Seed.
- Usuarios demo.
- Roles.
- Ejecución con Docker.
- Pruebas.

---

# 44. Métricas de éxito del MVP

Métrica Objetivo

---

Flujos críticos funcionales 100%
Roles principales 4+
Módulos conectados 6+
Casos de uso IA 4+
Datos sensibles protegidos 100%
Rutas críticas protegidas 100%
Flujo contratación → empleado Funcional
Flujo tarea → evidencia → IA Funcional
Ejecución local Docker Funcional
Seed reproducible Funcional

---

# 45. Backlog posterior a la entrega

Después del MVP:

1.  Predicción de fuga de talento.
2.  Detector de burnout.
3.  Evaluación 360°.
4.  Notificaciones por correo.
5.  Calendarios externos.
6.  Firma electrónica.
7.  Integración con bolsas de trabajo.
8.  App móvil.
9.  ML propio.
10. Multiempresa.
11. SSO.
12. Reportes PDF/Excel.
13. Historial avanzado de desempeño.
14. Automatización de encuestas por antigüedad.
15. Motor avanzado de workflows.

---

# 46. Resumen técnico para desarrollo

La prioridad absoluta debe ser:

```text
1. Seguridad
2. Datos
3. Flujo end-to-end
4. Reclutamiento
5. Contratación
6. Empleado
7. Tareas
8. IA
9. Dashboards
10. UX
```

No se debe intentar implementar toda la visión empresarial con
profundidad durante el MVP. El éxito consiste en demostrar que existe
una **arquitectura sólida y extensible** donde los módulos principales
están conectados y la IA funciona como una capacidad transversal
controlada.

La decisión arquitectónica clave es:

```text
                 ┌───────────────┐
                 │    Next.js    │
                 │ UI + BFF/API  │
                 └───────┬───────┘
                         │
              ┌──────────┴──────────┐
              │                     │
        ┌─────▼─────┐         ┌─────▼─────┐
        │ Supabase  │         │   AI Hub  │
        │ Auth/RLS  │         │ Guardrails│
        │ PostgreSQL│         │ Providers │
        │ Storage   │         └─────┬─────┘
        └─────┬─────┘               │
              │               ┌─────┴─────┐
              │               │           │
              │            Gemini       Ollama
              │
       ┌──────▼────────────────────────────┐
       │ Reclutamiento → Empleado → HR     │
       │ Onboarding → Cursos → Tareas      │
       │ Desempeño → Clima → Analytics     │
       └───────────────────────────────────┘
```

**Resultado esperado:** un MVP funcional, seguro, ejecutable localmente,
demostrable en una presentación y preparado para crecer después de las
dos semanas.
