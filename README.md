# Nexo · Sistema de RRHH con IA

**Ideas y evolución del alcance:** [Ideas para el sistema](IDEAS_PARA_EL_SISTEMA.md) consolida las propuestas iniciales y las ampliaciones solicitadas hasta el 21 de septiembre de 2026.

**Activación de mejoras:** consulta [la guía de operaciones RH](docs/ACTIVAR_MEJORAS_RH.md) para habilitar superadministración, encuestas, agenda y adjuntos de vacantes en Supabase.

Aplicación Next.js/React/TypeScript con Supabase Auth, PostgreSQL, RLS y Storage privado. El código conecta reclutamiento, contratación, onboarding, cursos, tareas, evidencias, recomendaciones IA y desempeño.

**Documentación del código:** consulta [la guía en español](docs/CODIGO.md) para entender los módulos, permisos, base de datos y flujo de IA. Las pruebas locales no garantizan la disponibilidad de servicios externos; comprueba cada entorno antes de utilizarlo.

## Inicio local

**Actualización de paneles y orquestación:** aplica `supabase/migrations/202609170001_orchestration_audit.sql` en el SQL Editor del proyecto remoto (o con el flujo normal de migraciones local). Es necesaria para las recomendaciones generales, el catálogo formativo y la auditoría exclusiva de SUPERUSER. Consulta `docs/CODIGO.md` para los alcances por rol. Las migraciones previas deben estar instaladas.

Requisitos: Node.js 24, npm, Docker Desktop con motor Linux funcionando. Instalar dependencias con `npm ci`.

```powershell
npx supabase start
npm run setup:local
npx supabase db reset
npm run seed
docker compose --profile ai up -d ollama
docker compose exec ollama ollama pull qwen2.5:3b
npm run dev
```

`supabase db reset` elimina los datos de la instancia local de este proyecto. Utilízalo solo para la instalación inicial o para reiniciar deliberadamente la demostración; no ejecutarlo sobre datos que quieras conservar.

Abre [Nexo](http://localhost:3000/login). Supabase Studio estará en [Studio local](http://localhost:54323). `setup:local` lee el estado de Supabase y escribe `.env.local`, sin imprimir claves ni sobrescribir archivos existentes. Genera una contraseña aleatoria en `DEMO_PASSWORD`.

Si prefieres configurar a mano, copia `.env.example` a `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o la clave heredada `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `SUPABASE_SERVICE_ROLE_KEY` y `DEMO_PASSWORD` (12 caracteres como mínimo). No subas `.env.local` al control de versiones. No pegues claves secretas en la interfaz ni en el chat. La clave publicable sirve para Auth y consultas con RLS; no permite migrar el esquema ni crear usuarios administrativos.

El seed usa Auth Admin y sube archivos TXT reales a los buckets privados. Crea 3 áreas, 5 puestos, 3 vacantes, 5 candidatos con 5 postulaciones, 2 entrevistas, 5 empleados y un jefe, 5 cursos, 10 tareas, 10 evidencias, onboarding y 2 encuestas reservadas para P1. Rechaza una segunda ejecución cuando existen cuentas demo, para no resetear roles ni deshacer contrataciones.

## Usuarios demo

Todos usan la contraseña configurada en `DEMO_PASSWORD`, consultable en tu `.env.local`:

- `admin@nexo.test`: SUPERUSER; usuarios, roles, áreas, puestos y auditoría.
- `rh@nexo.test`: RH_ADMIN; procesos de RH.
- `jefe@nexo.test`: JEFE; empleados asignados a su equipo, tareas y desempeño.
- `empleado1@nexo.test` a `empleado5@nexo.test`: EMPLEADO.
- `candidato1@nexo.test` a `candidato5@nexo.test`: CANDIDATO.

Para demostrar la contratación usa `candidato1@nexo.test`, que empieza en POSTULADO, o registra una cuenta nueva. La contraseña de un candidato contratado no cambia: se actualiza su rol y al volver a entrar accede a `/employee`.

## Supabase alojado

Usa un proyecto de pruebas separado. Configura URL y claves, enlaza la CLI con ese proyecto y aplica las migraciones de `supabase/migrations` mediante `supabase db push`. El seed SQL crea áreas, puestos y cursos; `scripts/seed.mjs` crea cuentas y archivos. Para permitir ese seed sobre un proyecto remoto se requiere `ALLOW_REMOTE_DEMO=true`. No actives esta variable sobre producción.

El registro usa Supabase Auth y nunca confía en un rol enviado por el cliente. En local se desactiva la confirmación por correo. En un proyecto alojado, si mantienes la confirmación, el usuario confirma su correo y vuelve a `/login`; configura la URL del sitio en Supabase Auth. Las rutas consultan `getUser()` y el perfil activo actual.

## IA

Para Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=tu_clave_solo_servidor
GEMINI_MODEL=gemini-2.5-flash
AI_FALLBACK=false
```

Para Ollama usa `AI_PROVIDER=ollama`, `OLLAMA_URL=http://127.0.0.1:11434` y un modelo descargado que soporte salida JSON. El modelo de texto por defecto es `qwen2.5:3b`. Para imágenes, instala un modelo de visión compatible y configura `OLLAMA_VISION_MODEL` con su nombre. Los PDF escaneados requieren Gemini o revisión humana; los PDF con texto y TXT funcionan con ambos proveedores. Gemini admite el archivo PDF/imagen autorizado como entrada multimodal.

El fallback Gemini → Ollama solo se activa con `AI_FALLBACK=true`. Cada intento tiene timeout de 45 segundos; no hay reintentos infinitos. Máximo 5 solicitudes por usuario y minuto y una solicitud pendiente por recurso durante 2 minutos. Los resultados se validan con Zod antes de persistir. Se reutiliza la recomendación almacenada; los cambios de CV, habilidades o requisitos invalidan la recomendación. La IA no aprueba tareas, no contrata ni administra roles.

Antes de IA se aplican autenticación, rol, consulta RLS y contexto mínimo. No se envían correos, nombres de perfiles ni claves como campos de contexto. El CV autorizado puede contener datos personales propios del documento. Las instrucciones dentro de documentos se tratan como datos no confiables. El proveedor no dispone de herramientas ni acceso a la base de datos. Esta separación limita los efectos de prompt injection; no supone que un modelo nunca pueda producir una recomendación incorrecta.

## Docker

Supabase se administra con su CLI; Compose administra Next.js y, opcionalmente, Ollama. Después de `supabase start`, migraciones y seed:

```powershell
docker compose --profile ai up -d --build
docker compose exec ollama ollama pull qwen2.5:3b
```

La app usa `SUPABASE_INTERNAL_URL=http://host.docker.internal:54321` dentro del contenedor y conserva la URL pública para enlaces firmados accesibles por el navegador. La imagen utiliza build standalone y un usuario sin privilegios. `.dockerignore` excluye secretos. El build Docker no se verificó en esta sesión porque el motor no estuvo disponible.

## Guion de demostración

1. Registrar un candidato en `/register`, o entrar como `candidato1@nexo.test`.
2. En **Mi perfil**, guardar habilidades y experiencia; subir CV PDF/TXT privado.
3. En **Oportunidades**, postularse; revisar **Postulaciones**. El candidato demo ya tiene una postulación.
4. Salir y entrar como `rh@nexo.test`. En **Postulaciones**, abrir el CV privado y pulsar **Evaluar candidato**. Revisar score, fortalezas, brechas y resumen.
5. Cambiar a **En revisión** y luego **Preseleccionado**. Pulsar **Agendar entrevista**, seleccionar entrevistador y una hora sin conflicto (se reserva un intervalo de una hora).
6. Pulsar **Confirmar contratación**. PostgreSQL crea empleado, onboarding, cuatro elementos de checklist, cursos obligatorios y una tarea inicial en la misma transacción, y registra auditoría.
7. Entrar de nuevo con la cuenta del candidato, ahora empleado. En **Onboarding**, completar checklist y subir un documento.
8. En **Capacitación**, leer contenido, iniciar el curso, registrar avances de 25% y completarlo.
9. En **Tareas**, iniciar la tarea y subir evidencia. Pasa a **En revisión**.
10. Como RH, entrar a **Tareas**, abrir el archivo y ejecutar **Analizar evidencia**. Revisar resultado, confianza y observaciones; aprobar la entrega o solicitar correcciones con motivo.
11. Revisar **Desempeño**, **Analíticas** y **Auditoría**. La métrica es 60% tareas aprobadas + 40% cursos completados.
12. Intentar abrir `/rh` con un candidato, consultar un empleado ajeno por API o modificar roles con un usuario normal: deben rechazarse. Un jefe únicamente consulta y gestiona su equipo directo.

## API

Las operaciones de la interfaz usan `POST /api/commands` con `{op,payload}`. Los schemas rechazan campos extra y el RPC `command` vuelve a validar rol, propiedad y transiciones en PostgreSQL. Las tablas no permiten escrituras directas al rol `authenticated`.

También existen rutas de dominio: vacantes (GET/POST/PATCH/DELETE), postulaciones (GET/POST/status/hire), entrevistas (GET/POST/PATCH/DELETE como cancelación), empleados (GET/PATCH), onboarding propio y completar elementos, cursos y asignaciones, tareas y estado, archivos privados, `/api/performance/me`, `/api/performance/employee/:id` y `/api/analytics/kpis`. La contratación canónica es `POST /api/applications/:id/hire`.

Los listados REST devuelven `{data,page,page_size:50}`; `page` empieza en 0. Las páginas del MVP consultan hasta 1.000 registros por tabla en el workspace; no están diseñadas aún para operaciones masivas. Ver [decisiones y trazabilidad](docs/DECISIONES.md) para el alcance y sus límites.

Archivos: `POST /api/files` recibe `multipart/form-data` con `bucket`, `file` e `id` para tarea/onboarding. `GET /api/files?bucket=...&id=...` devuelve `{url,expires_in:60}` solo tras autorizar el recurso. No se aceptan rutas de archivo suministradas para firmar; se recupera la ruta almacenada de un registro visible por RLS.

IA: `POST /api/ai/recruitment` y `/api/ai/evidence`, cuerpo `{id}`. Las rutas de compatibilidad `/api/ai/recruitment/recommend`, `/api/ai/recruitment/summary` y `/api/ai/task-verification` usan el mismo contrato. Un resumen de candidato forma parte de la recomendación.

## Pruebas

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

- Unitarias: cálculos, roles, estados, schemas, mass assignment y validación de archivos.
- Base de datos: migraciones reales ejecutadas en PGlite (PostgreSQL embebido); RLS, contratación, conflicto de agenda, rollback inyectado a mitad de contratación, aislamiento, Storage policies y auditoría inmutable. Se crean esquemas de prueba para `auth.uid` y Storage; esto no sustituye una prueba contra Supabase completo.
- API: contratos de los handlers, rechazo previo de CSRF y falta de autenticación, JSON inválido, límites y redacción de errores. El cliente de Auth está sustituido únicamente dentro de estas pruebas.
- IA: contratos de ambos proveedores, salida inválida, fallback acotado y errores. El transporte HTTP está sustituido solo en pruebas; no se llamó a un modelo real.
- E2E: `e2e/core.spec.ts` incluye registro → CV → postulación → IA → entrevista → contratación → empleado → onboarding → cursos → evidencia → IA → aprobación humana → desempeño. Requiere servicios y credenciales reales. Se omite explícitamente si faltan las variables.

Ver [resultado de verificación](docs/VERIFICACION.md). No declarar terminado el MVP hasta que pase el E2E con Supabase y un proveedor real.

## Fuera de P0

Buddy, tutor IA, recomendación de cursos, encuestas pulse, análisis de sentimiento, organigrama y reportes IA avanzados. Se conserva el modelo mínimo de encuestas, pero no hay botones de producto simulando estas funciones. Nómina, biometría, SSO, ERP, videollamadas, ML propio, predicción médica/psicológica y multitenancy quedan fuera del MVP.

## Referencias técnicas

Se contrastaron las integraciones con [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [validación de identidad](https://supabase.com/docs/reference/javascript/auth-getuser), [JSON estructurado de Gemini](https://ai.google.dev/gemini-api/docs/structured-output), [PDF en Gemini](https://ai.google.dev/gemini-api/docs/generate-content/document-processing) y [visión en Ollama](https://docs.ollama.com/capabilities/vision). Para Next.js se consultó la documentación distribuida con la versión instalada en `node_modules/next/dist/docs`.
