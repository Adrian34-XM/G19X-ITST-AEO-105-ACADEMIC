# Nexo · Sistema de Recursos Humanos con IA

Aplicación web para reclutamiento, equipo y organigrama, incorporación, capacitación, tareas y evidencias, desempeño, analíticas y ambiente laboral. Incluye roles de superusuario, RH, jefe, empleado y candidato. La IA aporta análisis sujetos a revisión humana; no contrata ni aprueba entregas automáticamente.

Tecnologías: Node.js 24, Next.js 16, React 19, TypeScript, Supabase Auth, PostgreSQL, Storage privado y amCharts 5 para gráficas interactivas. La IA puede usar Ollama local o Gemini.

Para el apoyo en el desarrollo de este sistema se utilizo chatGPT-Astra

## Índice de documentación

- [Arquitectura y agentes de IA](docs/ARQUITECTURA_Y_AGENTES.md): componentes del sistema, orquestador, clasificador de alcance, generador, revisor factual, permisos y decisiones humanas.
- [Referencia de las API](docs/API.md): rutas HTTP, métodos, autenticación, parámetros, respuestas, errores y ejemplos de uso.
- [Gráficas con amCharts 5](docs/GRAFICAS.md): tipos de gráfica, filtros, datos autorizados, accesibilidad, temas y mantenimiento.
- [Guía del código](docs/CODIGO.md): explicación de los flujos de negocio, autenticación, archivos, inteligencia artificial y base de datos.
- [Mapa del código](docs/MAPA_CODIGO.md): índice de archivos, responsabilidades y funciones o componentes exportados.
- [Avisos de terceros](THIRD_PARTY_NOTICES.md): atribuciones y condiciones de los componentes externos incorporados.

La instalación, configuración, operación y resolución de problemas se describen en los apartados siguientes de este README.

Las gráficas de desempeño, analíticas y preguntas de ambiente laboral utilizan `@amcharts/amcharts5`, instalado con las demás dependencias de npm. La librería se carga en el navegador al mostrar una gráfica. Las cifras y los permisos siguen calculándose en el servidor; cambiar la representación no ejecuta otra consulta de IA. Se conserva la marca de amCharts conforme a su licencia, documentada en [los avisos de terceros](THIRD_PARTY_NOTICES.md). Las skills locales de los asistentes se excluyen de Git y no se requieren para ejecutar Nexo.

## 1. Requisitos

Instala antes de comenzar:

- Git.
- Node.js **24** con npm. Comprueba `node --version` y `npm --version`.
- Un navegador actualizado, por ejemplo Edge, Chrome o Firefox.
- Para Supabase local: Docker Desktop en Windows/macOS, o Docker Engine y Compose en Linux. En Windows utiliza contenedores Linux y configura WSL 2 según lo que solicite Docker Desktop.
- Para IA local: Ollama instalado en el equipo, o el servicio Ollama de Docker descrito más adelante. Necesitas espacio para descargar modelos y RAM disponible; el consumo depende del modelo y de la concurrencia.
- Internet para descargar dependencias, imágenes de Docker y modelos. Gemini y Supabase alojado también requieren conexión durante su uso.

Puedes elegir **Supabase local** (apartados 2–5) o **Supabase alojado** (apartado 8). No necesitas instalar PostgreSQL por separado para la opción local: lo administra la CLI de Supabase en Docker.

## 2. Obtener el proyecto

Clona el repositorio académico actual:

```sh
git clone https://github.com/Adrian34-XM/G19X-ITST-AEO-105-ACADEMIC.git arquitectura-rh
cd arquitectura-rh
npm ci
```

Ejecuta todos los comandos siguientes desde esa carpeta. `npm ci` utiliza las versiones de `package-lock.json`. La CLI de Supabase ya está incluida como dependencia de desarrollo; no necesitas instalarla globalmente.

En PowerShell, si aparece un error de ejecución de `npm.ps1` o `npx.ps1`, utiliza `npm.cmd` y `npx.cmd` en lugar de `npm` y `npx`.

## 3. Preparar Supabase local

Inicia Docker y espera a que su motor esté disponible. Después ejecuta:

```sh
npx supabase start
npm run setup:local
```

El primer arranque puede tardar mientras descarga imágenes. `setup:local` obtiene las claves de la instancia local, crea `.env.local` y genera una contraseña aleatoria para las cuentas demo. No imprime secretos ni sobrescribe un `.env.local` existente.

Si copiaste un `.env.local` de otra instalación, el script no lo actualizará: revisa que sus URL y claves correspondan a la instancia que vas a utilizar. No mezcles credenciales de Supabase local con las de un proyecto alojado.

### Instalación inicial de las tablas

En una instancia local nueva, aplica todas las migraciones y los datos SQL iniciales:

```sh
npx supabase db reset --local
npm run seed
```

**`db reset --local` borra los datos de esta instancia local.** Este paso es para la instalación inicial o un reinicio deliberado de la demostración. No lo repitas para arrancar diariamente ni sobre datos que quieras conservar.

Las migraciones están en `supabase/migrations/` y se ejecutan en orden. Incluyen auditoría, permisos, evidencias, encuestas, conversaciones y fotos de perfil. No ejecutes únicamente una migración de mejoras en una base vacía: depende de las anteriores.

La migración `202610080001_private_ai_analyses.sql` separa las evaluaciones internas de las postulaciones y encuestas visibles a participantes. Conserva los análisis anteriores en tablas privadas y los permisos de RH/jefaturas. Aplícala antes de iniciar esta versión; un cambio de interfaz no sustituye la protección RLS. Los instaladores SQL agregados son históricos y no incluyen esta corrección: actualiza con las migraciones posteriores en orden y comprueba el resultado con `supabase/verificar-migraciones.sql`.

`npm run seed` crea cuentas confirmadas y registros ficticios para probar el sistema. Rechaza una segunda ejecución cuando detecta cuentas demo existentes. La contraseña es el valor de `DEMO_PASSWORD` en tu archivo local; cambiar esa variable después no cambia las contraseñas de usuarios ya creados.

## 4. Configurar las variables

Abre `.env.local` en tu editor. Añade esta variable si el script de configuración no la incluyó:

```env
APP_URL=http://127.0.0.1:3000
```

El archivo contiene las siguientes variables principales. Los valores de este ejemplo son referencias, no credenciales utilizables:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=CLAVE_ANON_DE_TU_INSTANCIA_LOCAL
SUPABASE_SERVICE_ROLE_KEY=CLAVE_PRIVADA_DE_TU_INSTANCIA_LOCAL
APP_URL=http://127.0.0.1:3000
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
AI_FALLBACK=false
DEMO_PASSWORD=CONTRASENA_LOCAL_DE_AL_MENOS_12_CARACTERES
```

Conserva los valores reales generados por `setup:local`; no los reemplaces por estos ejemplos. También se admite `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en lugar de la clave heredada `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Si defines ambas, la clave publicable tiene prioridad.

`SUPABASE_SERVICE_ROLE_KEY` es privada y el sistema actual la necesita para operaciones administrativas. No le añadas el prefijo `NEXT_PUBLIC_`, no la copies al navegador y no la publiques. Las cuentas normales acceden mediante sesión y políticas RLS.

Para una configuración manual puedes copiar `.env.example` a `.env.local`: en PowerShell, `Copy-Item .env.example .env.local`; en Bash, `cp .env.example .env.local`. Completa las claves reales y una contraseña demo propia antes del seed.

## 5. Configurar la IA

### Opción A: Ollama instalado en el equipo

Instala Ollama desde [su sitio oficial](https://ollama.com/download), inicia su servicio y descarga el modelo de texto:

```sh
ollama pull qwen2.5:3b
ollama list
```

Utiliza `AI_PROVIDER=ollama`, `OLLAMA_URL=http://127.0.0.1:11434` y `OLLAMA_MODEL=qwen2.5:3b` en `.env.local`.

Para analizar imágenes o PDF escaneados, descarga además un modelo de visión:

```sh
ollama pull gemma3:4b
```

Y añade:

```env
OLLAMA_VISION_MODEL=gemma3:4b
```

El modelo visual requiere recursos adicionales y es opcional para probar el resto de la plataforma. Los PDF con texto y archivos TXT pueden procesarse por extracción textual; un análisis textual no interpreta automáticamente las imágenes internas. La conversión de PDF para visión admite hasta seis páginas.

Si Ollama ya está activo, no ejecutes otra instancia de `ollama serve` ni otro contenedor sobre el mismo puerto. Para descargar un modelo basta con que el servicio existente esté disponible.

### Opción B: Ollama con Docker

Puedes usar esta opción en lugar de instalar Ollama directamente. Comprueba que el puerto 11434 esté libre:

```sh
docker compose --profile ai up -d ollama
docker compose exec ollama ollama pull qwen2.5:3b
```

Para visión, ejecuta también `docker compose exec ollama ollama pull gemma3:4b` y configura `OLLAMA_VISION_MODEL`. La aplicación sigue ejecutándose con npm en el equipo.

Para detener este servicio: `docker compose stop ollama`. Los modelos descargados permanecen en el volumen de Docker.

### Opción C: Gemini

Configura una clave válida del proveedor, únicamente en el servidor:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=TU_CLAVE_PRIVADA
GEMINI_MODEL=gemini-2.5-flash
AI_FALLBACK=false
```

El modelo indicado debe estar disponible para tu cuenta. El servicio puede tener cuotas o costes. Puedes habilitar `AI_FALLBACK=true` si también has configurado y descargado un modelo de Ollama local; de otro modo conserva `false`.

La aplicación puede arrancar aunque no haya un proveedor de IA disponible, pero los análisis de IA fallarán hasta que lo configures. La IA no sustituye las validaciones humanas ni garantiza respuestas correctas para cualquier prompt.

## 6. Arrancar y entrar

```sh
npm run dev -- --hostname 127.0.0.1
```

Deja esa terminal abierta y visita [http://127.0.0.1:3000/login](http://127.0.0.1:3000/login). El listado público de vacantes está en `/jobs`.

El comando de desarrollo utiliza webpack. `localhost` y `127.0.0.1` pueden acceder al canal local de actualización; otros orígenes siguen bloqueados. Durante la edición del código, Next.js puede actualizar o recargar la vista. Para una demostración sin esas actualizaciones, utiliza el modo de producción descrito más adelante. Si una gráfica no termina de cargar en 30 segundos, muestra un aviso y permite reintentar solo esa gráfica, conservando el análisis y las cifras; consulta [la guía de gráficas](docs/GRAFICAS.md).

En Windows también puedes arrancar en segundo plano, desde PowerShell en la carpeta del proyecto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Este comando inicia Next.js y, si `AI_PROVIDER=ollama` apunta al puerto local 11434, inicia Ollama cuando hace falta. Conserva los procesos que ya están activos, comprueba la página de acceso y guarda registros y PID en `.local/start-system/`. No cambia claves, no inicia Supabase ni reinicia la base de datos. Los modelos de Ollama deben estar descargados. Si usas Supabase local, inicia sus servicios con `npx supabase start` antes; con Supabase alojado no necesitas Docker para abrir Nexo.

Los procesos siguen activos al cerrar la terminal, pero debes volver a arrancarlos después de reiniciar Windows. Puedes usar `-NoAI` para iniciar solo Nexo. Si aparece `ERR_CONNECTION_REFUSED`, comprueba que el proceso del servidor siga activo; esa pantalla significa que el navegador no logra conectar con el puerto, no que haya fallado un módulo de la aplicación.

Supabase Studio está normalmente en [http://127.0.0.1:54323](http://127.0.0.1:54323). Ejecuta `npx supabase status` para consultar las direcciones de tu instalación; su salida también contiene claves y no debe compartirse públicamente.

### Usuarios de demostración

Todos utilizan la contraseña generada en `DEMO_PASSWORD` al ejecutar el seed:

- `admin@nexo.test`: superusuario.
- `rh@nexo.test`: administración de RH.
- `jefe@nexo.test`: jefe del equipo.
- `empleado1@nexo.test` a `empleado5@nexo.test`: empleados.
- `candidato1@nexo.test` a `candidato5@nexo.test`: candidatos.

Estos correos son ficticios y no son buzones reales. El seed confirma las cuentas para permitir la demostración. Una contratación cambia el rol y la pantalla del candidato; no cambia su contraseña.

### Registro, invitaciones y recuperación

La configuración local actual **sí exige confirmación de correo para registros nuevos**. Consulta la dirección del capturador local de correo que muestra `npx supabase status` y abre allí los mensajes de prueba: no se envían a un buzón Gmail real desde el capturador local.

`APP_URL` debe coincidir con la dirección usada para abrir la aplicación. Las plantillas locales se encuentran en `supabase/templates/`. El enlace de acceso llega a `/auth/confirm`.

Para enviar correos a buzones reales con Supabase alojado, sigue la configuración SMTP del apartado 8. El capturador de correo local y un proveedor SMTP cumplen funciones distintas.

## 7. Uso diario, actualizaciones y parada

Para arrancar otra vez, inicia Docker, ejecuta `npx supabase start`, inicia Ollama si lo usas y ejecuta `npm run dev -- --hostname 127.0.0.1`. No repitas el reset ni el seed.

Para incorporar cambios del repositorio, guarda primero tus cambios locales, actualiza la rama y ejecuta `npm ci`. Si hay migraciones nuevas, realiza un respaldo y aplícalas a la instancia local con:

```sh
npx supabase migration up --local
```

Reinicia Next.js después de cambiar `.env.local`. Para detenerlo, pulsa `Ctrl+C` en su terminal. Para detener Supabase local, usa `npx supabase stop`; no añadas opciones que eliminen datos si quieres conservarlos. Para Ollama instalado directamente, descarga un modelo de memoria con `ollama stop qwen2.5:3b` o `ollama stop gemma3:4b`; esto no desinstala el modelo ni cierra el servicio.

## 8. Alternativa: Supabase alojado

Esta opción utiliza la base de datos en Supabase y la aplicación en tu máquina. No necesita Docker para la base de datos; sí conexión a Internet.

1. Crea un proyecto de Supabase separado para esta instalación.
2. Copia `.env.example` a `.env.local`. Completa la URL del proyecto, su clave pública y su clave `service_role` privada. Configura `APP_URL=http://127.0.0.1:3000` y el proveedor de IA elegido.
3. Autentica y enlaza la CLI con el proyecto correcto; sustituye el identificador del ejemplo:

```sh
npx supabase login
npx supabase link --project-ref <IDENTIFICADOR_DEL_PROYECTO>
npx supabase db push --dry-run --skip-vault
npx supabase db push
```

El enlace puede solicitar la contraseña de PostgreSQL del proyecto; no es la contraseña de una cuenta Nexo. Revisa el destino antes de aplicar cambios. Para una instalación nueva, aplica **todas** las migraciones de `supabase/migrations/` mediante este flujo. No combines este procedimiento con los instaladores SQL agregados, que pueden intentar crear los mismos objetos.

El comando con `--dry-run --skip-vault` permite revisar qué migraciones se aplicarían sin aplicarlas ni actualizar secretos de Vault. Lee ese resultado antes del `db push` real. Para actualizar una instalación alojada existente, respalda los datos y sigue el mismo flujo con su proyecto autorizado; aplica únicamente las migraciones pendientes, sin reset ni seed. Actualizar o subir el código a GitHub no actualiza la base de datos.

4. En Supabase Auth configura la URL del sitio y permite `http://127.0.0.1:3000/auth/confirm` como URL de redirección. Si usas `localhost`, configura también esa variante y utiliza el mismo origen en `APP_URL`.
5. Configura las plantillas de confirmación, invitación y recuperación tomando como referencia `supabase/templates/`. En un servicio alojado estas plantillas no se instalan automáticamente por ejecutar migraciones SQL. Configura el envío de correo y, para pruebas fuera de las restricciones del servicio predeterminado, un proveedor SMTP propio.
6. Para cargar la demostración **solo en un proyecto de pruebas vacío**, ejecuta primero `supabase/seed.sql` en su SQL Editor. Después establece `DEMO_PASSWORD` y `ALLOW_REMOTE_DEMO=true` en `.env.local` y ejecuta `npm run seed`. Retira `ALLOW_REMOTE_DEMO` cuando termines. No ejecutes el seed de demostración sobre una instalación con datos reales.
7. Arranca la aplicación con el comando del apartado 6.

La contraseña y las claves son propias de cada instalación. Clonar el repositorio no copia usuarios, documentos, modelos, configuración SMTP ni datos de la base anterior. Para reutilizar una base alojada existente, usa sus credenciales autorizadas y aplica únicamente migraciones pendientes; no ejecutes el seed.

Para diagnosticar una instalación, ejecuta `supabase/verificar-migraciones.sql` en el SQL Editor. No modifica datos; muestra requisitos ausentes. El archivo no sustituye la ejecución ordenada de las migraciones, incluida la de fotos de perfil `202610060001_profile_photos.sql`.

### Correos de acceso con Brevo y Supabase

Nexo utiliza **Supabase Auth** para enviar confirmaciones de registro, invitaciones y recuperación de contraseña. El SMTP se configura en el proyecto de Supabase; no necesitas añadir una biblioteca de correo a Next.js. El servicio predeterminado de Supabase tiene restricciones de destinatarios y cuotas: configura un SMTP personalizado para tus usuarios. Consulta [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

**1. Preparar el remitente en Brevo**

- Crea una cuenta en [Brevo](https://www.brevo.com/) y elige su plan gratuito si cubre tus necesidades; revisa sus cuotas vigentes.
- En **Configuración → Remitentes, dominios e IP → Remitentes**, añade el nombre `Nexo` y un correo al que tengas acceso. Verifícalo con el código recibido.
- Para pruebas sin dominio propio, puedes añadir un remitente de un proveedor gratuito si tu cuenta lo permite y confirmar **Add this sender anyway**. No añadas `gmail.com` como dominio tuyo. Brevo puede sustituir la dirección visible por una de sus dominios; revisa también spam. Para producción, autentica un dominio propio. [Requisitos de remitentes](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

**2. Obtener las credenciales SMTP**

En el menú de cuenta de Brevo, abre **SMTP & API → SMTP**, copia el **SMTP login** y genera una **clave SMTP** llamada `Nexo`. El login es el usuario SMTP asignado, que puede ser diferente de tu correo remitente. La clave SMTP es distinta de una API key y de la contraseña de tu cuenta. [Guía de Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

**3. Configurar Supabase**

En **Authentication → Email → SMTP Settings**, activa **Custom SMTP**, completa estos campos y guarda:

- **Sender email:** el correo verificado en Brevo.
- **Sender name:** `Nexo`.
- **Host:** `smtp-relay.brevo.com`.
- **Port:** `465`.
- **Username:** el **SMTP login** de Brevo.
- **Password:** la **clave SMTP** generada.

Guarda la clave únicamente en la configuración privada de Supabase y en tu gestor de contraseñas. No la pongas en el README, en código, en variables `NEXT_PUBLIC_*` ni en Git. Configurar SMTP en el panel no requiere reiniciar Next.js.

**4. Configurar los destinos de los enlaces**

En **Supabase → Authentication → URL Configuration**, para desarrollo local configura:

- **Site URL:** `http://127.0.0.1:3000`.
- **Redirect URLs:** `http://127.0.0.1:3000/auth/confirm`.

En `.env.local`, utiliza el mismo origen:

```env
APP_URL=http://127.0.0.1:3000
```

Reinicia Next.js si cambias `APP_URL`. Si utilizas `localhost`, configura y utiliza esa variante de forma consistente. Los enlaces locales deben abrirse en la máquina donde corre Nexo: `127.0.0.1` apunta al dispositivo de quien abre el correo. Para otros equipos, configura la URL HTTPS pública de tu instalación tanto en `APP_URL` como en **Site URL**, y permite su ruta `/auth/confirm` en **Redirect URLs**. [Configuración de redirecciones](https://supabase.com/docs/guides/auth/redirect-urls).

**5. Instalar las tres plantillas de correo**

En **Authentication → Email → Email Templates**, configura cada plantilla. Los archivos en `supabase/templates/` se aplican a Supabase local mediante `config.toml`; para el proyecto alojado debes copiar su contenido al panel. Conserva exactamente las expresiones `{{ .RedirectTo }}` y `{{ .TokenHash }}`. [Variables de las plantillas](https://supabase.com/docs/guides/auth/auth-email-templates).

**Confirm sign up** — asunto: `Confirma tu correo en Nexo`.

```html
<h2>Confirma tu correo en Nexo</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=signup">Confirmar correo</a></p>
<p>Si no creaste esta cuenta, ignora este correo. No compartas el enlace.</p>
```

**Reset password** — asunto: `Recupera tu acceso a Nexo`.

```html
<h2>Recupera tu acceso a Nexo</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Elegir una nueva contraseña</a></p>
<p>Si no solicitaste este cambio, ignora este correo. No compartas el enlace.</p>
```

**Invite user** — asunto: `Tu invitación a Nexo`.

```html
<h2>Te invitamos a Nexo</h2>
<p>Confirma tu correo y define tu contraseña para acceder a tu espacio de trabajo.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=invite">Aceptar invitación</a></p>
<p>Si no esperabas esta invitación, puedes ignorarla. No compartas este enlace.</p>
```

Guarda cada plantilla. En la configuración del proveedor **Email** de Supabase Auth, conserva activada la confirmación de correo para registros públicos; las cuentas demo confirmadas por el seed no sirven para comprobar ese envío.

**6. Probar la entrega y los enlaces**

1. Con Nexo encendido, abre una ventana de incógnito y entra en `/register`.
2. Registra una cuenta de prueba con un correo real que controles y que no esté registrado. Comprueba que el mensaje llega, confirma el enlace y verifica el inicio de sesión.
3. Desde `/login`, prueba **Recuperar acceso** con esa cuenta, abre el mensaje más reciente y completa el cambio de contraseña.
4. Para probar invitaciones, utiliza una cuenta superusuario y un correo de prueba distinto, todavía no registrado.

Si no llega el mensaje, revisa spam, el remitente verificado, las credenciales, las cuotas y los registros de **Auth** en Supabase y de **Transactional → Logs** en Brevo. La respuesta genérica de registro o recuperación no confirma por sí sola que se haya enviado el correo. Si llega pero el enlace falla, revisa `APP_URL`, las redirecciones, las tres plantillas y que Nexo esté accesible desde el dispositivo. No publiques enlaces de confirmación ni capturas de claves.

Los avisos de avance de postulaciones se muestran **dentro de Nexo**, en la campana del candidato; no se envían por SMTP. Configurar este proveedor tampoco activa correos de tareas, entrevistas o encuestas.

## 9. Comprobar la instalación

```sh
npm run test:supabase
npm run typecheck
npm run lint
npm test
npm run build
```

La comprobación de Supabase es de disponibilidad y permisos anónimos; no demuestra todos los recorridos autenticados. Las pruebas habituales de IA simulan el transporte. Algunas pruebas reales y de navegador necesitan cuentas o archivos locales de preparación que no se distribuyen en Git.

Para pruebas de navegador, instala Chromium con `npx playwright install chromium`. En Windows, la configuración utiliza Edge por defecto; si quieres utilizar Chromium, define `E2E_BROWSER_CHANNEL=chromium` en el entorno de la terminal antes de `npm run test:e2e`.

Para comprobar manualmente los recorridos: entra como candidato, completa el perfil y sube un CV antes de postularte; continúa como RH con la entrevista y contratación; verifica el acceso del nuevo empleado, la incorporación y sus entregas. Como jefe o RH revisa tareas y capacitaciones, y comprueba como superusuario la auditoría. Una respuesta de IA no equivale a aprobación humana.

En el espacio del candidato, la vista general y **Mis postulaciones** muestran tarjetas con la etapa actual y los cambios registrados. La campana consulta los avances cada 15 segundos mientras la pestaña está visible; permite marcar avisos como leídos y abrir la postulación. La lectura se conserva en ese navegador. Los estados proceden de las postulaciones y su auditoría, sin mostrar evaluaciones internas de RH ni dar por completadas etapas sin registro. El seguimiento requiere las migraciones de auditoría ya incluidas; no necesita una migración adicional. Si la contratación convierte la cuenta en empleado, su campana conserva los avisos de esa candidatura propia.

Para arrancar una compilación de producción en la misma máquina, detén `npm run dev`, ejecuta `npm run build` y después `npm run start -- --hostname 127.0.0.1`. No ejecutes ambos servidores en el puerto 3000 al mismo tiempo. Esto prueba el modo de producción local; no configura un alojamiento público.

### Consultar desempeño y analíticas

- En **Desempeño**, busca por nombre o apellido desde el panel visible. La búsqueda admite mayúsculas, minúsculas, nombres sin acentos y espacios al principio o al final. RH y superusuario pueden combinarla con el área y un colaborador concreto; **Limpiar búsqueda y filtros** recupera el conjunto autorizado.
- Las pestañas **Resumen**, **Análisis con IA** y **Por persona** comparten el ámbito filtrado. La vista por persona muestra el número de coincidencias y avisa cuando no hay resultados. El acceso individual del empleado se limita a sus propios registros; la jefatura trabaja con su equipo autorizado.
- En **Analíticas**, abre **Mostrar filtros** para delimitar el área, colaborador, proceso y periodo disponible. Las gráficas y solicitudes de IA utilizan esos filtros. Las fechas de creación no equivalen a fechas de finalización de actividades.
- Al solicitar gráficas, indica proceso, desglose y periodo; por ejemplo: «Estados de tareas en cada área durante los últimos 7 días». Revisa la descripción, la fecha utilizada y las limitaciones de cada gráfica antes de tomar decisiones. Los indicadores se calculan sobre los datos autorizados cargados, con un máximo de 1000 registros por tabla; no representan por sí solos una evaluación integral de desempeño.

Las evaluaciones de postulaciones son internas de RH/superusuario. Los análisis de encuestas se reservan a RH/superusuario y a la jefatura creadora; poder contestar una encuesta no concede acceso a su análisis. Estos controles requieren la migración de análisis privados indicada en el apartado 3.

### LM-IA-01 · Rechazo intermitente de análisis: limitación aceptada del MVP

**Estado:** aceptada para el alcance del MVP el **13 de octubre de 2026**, por solicitud expresa del responsable del proyecto en este chat. Esta aceptación cierra el pendiente de documentar y aceptar esta limitación concreta. La comprobación de registro, confirmación de correo y recuperación de contraseña conserva su seguimiento independiente.

**Comportamiento observado.** Un análisis de evidencia ficticia con Ollama y `qwen2.5:3b` fue rechazado por la revisión factual: «La respuesta de IA no pudo respaldarse con los datos disponibles. No se guardó esa evaluación; revisa los registros o archivos e intenta nuevamente». Al repetir únicamente el mismo caso, sin desactivar la validación, se obtuvo una respuesta válida y la prueba pasó. La causa específica de la variación no quedó determinada de forma concluyente.

**Evidencia del 13 de octubre de 2026.** La ejecución completa de IA real tuvo **23 pruebas aprobadas y 1 fallida de 24**. La repetición del caso fallido tuvo **1 aprobada y 0 fallidas**. El caso es `analiza la evidencia indicada con Ollama y valida su respuesta sin guardar cambios`, en [tests/evidence-live.test.ts](tests/evidence-live.test.ts). Los informes originales se conservan localmente en `.local/mvp-final-ai-complete-20261013.json` y `.local/mvp-final-evidence-recheck.json`; esos archivos no se distribuyen en Git. La repetición aprobada se registra por separado y no convierte retrospectivamente la ejecución completa en una suite sin fallos. Estos resultados tampoco establecen una tasa de fallo general ni garantizan el siguiente análisis.

**Impacto aceptado.** Una consulta válida puede terminar sin análisis y requerir un nuevo intento o revisión manual de los archivos. Se acepta esa interrupción puntual para la demostración y uso supervisado del MVP. La aceptación no acredita la exactitud universal de las respuestas ni certifica disponibilidad para una operación empresarial continua.

**Tratamiento operativo y controles que se conservan:**

1. Revisar que el archivo sea legible, que corresponda a la actividad y que la solicitud esté dentro del módulo autorizado.
2. Esperar a que termine la solicitud anterior y repetir una vez el análisis. Si vuelve a ser rechazado, continuar con la revisión humana del documento y registrar la incidencia; evitar reintentos repetidos sin revisar su causa.
3. Conservar el rechazo de resultados sin respaldo y el aviso al usuario. Un resultado rechazado no se presenta como una evaluación válida.
4. Mantener la decisión humana sobre contratación y aprobación de tareas o cursos, junto con los permisos y la privacidad de los archivos.

**Seguimiento.** Reabrir LM-IA-01 si el rechazo se vuelve reproducible con una entrada válida, bloquea un flujo principal o se presenta como válida una respuesta sin respaldo. Al cambiar modelo, proveedor o instrucciones, repetir los casos de generación y revisión factual, incluyendo los casos que deben rechazarse. Esta aceptación registra una limitación conocida; no declara corregida su intermitencia.

## 10. Problemas frecuentes

- **No se encontró el sitio:** comprueba que Next.js siga activo, que no haya errores en la terminal y que estés usando el puerto anunciado. Si 3000 está ocupado, detén tu instancia anterior o cambia el puerto y actualiza `APP_URL` y las redirecciones de Auth.
- **Docker no está disponible:** abre Docker Desktop, activa el motor Linux y vuelve a ejecutar `npx supabase start`.
- **Faltan tablas o funciones SQL:** verifica que las migraciones se aplicaron al mismo proyecto cuya URL aparece en `.env.local`. No ejecutes una mejora aislada sobre una base vacía.
- **El sistema pide `202610080001_private_ai_analyses.sql`:** aplica esa migración pendiente en la instancia correcta y ejecuta `supabase/verificar-migraciones.sql`. Conserva los análisis existentes en tablas privadas; no basta con recargar la página ni con hacer push del código. No uses un reset para actualizar una base con datos que quieras conservar.
- **Faltan claves o el acceso administrativo falla:** revisa URL, clave pública y `SUPABASE_SERVICE_ROLE_KEY`. Las claves de distintos proyectos no son intercambiables. Reinicia Next.js después de editar el entorno.
- **No llega un correo:** en local revisa el capturador de correo; en alojado revisa confirmación, SMTP, destinatario, cuotas y registros de Auth. Las direcciones `@nexo.test` son ficticias.
- **El enlace de correo está incompleto o caducado:** utiliza el mensaje más reciente, revisa las plantillas y `APP_URL`, y solicita un enlace nuevo. Los enlaces tienen vigencia y pueden ser de un solo uso.
- **Ollama dice que 11434 está ocupado:** ya hay otro servicio usando ese puerto. Utiliza la instancia existente o detén el servicio que tú hayas iniciado antes de arrancar otra.
- **La IA tarda o consume mucha memoria:** cierra otros procesos pesados, evita análisis simultáneos y descarga de memoria modelos que no utilices. Mantén el modelo ligero de texto; usa visión solo cuando sea necesaria.
- **No puede analizar una imagen:** comprueba que `OLLAMA_VISION_MODEL` esté configurado y que ese modelo aparezca en `ollama list`, o utiliza un proveedor multimodal configurado.
- **Un análisis es rechazado por falta de respaldo:** la validación no pudo confirmar la respuesta. Revisa los datos y el alcance de la pregunta; no desactives las comprobaciones para aceptar cifras inventadas.
- **El seed dice que ya existen usuarios:** no es un comando de arranque diario. Usa las cuentas existentes. Un reset solo procede en una instancia local de pruebas cuyos datos puedas borrar.

## 11. Publicar el código sin secretos

`.env.local`, `.local/`, documentación informativa local, respaldos y archivos privados deben permanecer fuera del repositorio. Conserva `.env.example` con valores de ejemplo, nunca con claves reales. Revisa `git status --short` y `git diff --cached --stat` antes de cada commit.

Las reglas de `.gitignore` no eliminan archivos ya versionados ni copias del historial. Si una credencial llega a un commit, revócala o reemplázala y limpia el historial antes de publicar. No subas CV, evidencias o capturas con datos personales. Los archivos de `tests/fixtures/` deben seguir siendo ficticios.

Publica únicamente la rama prevista; evita `git push --mirror`, que puede incluir referencias privadas de herramientas. En un alojamiento configura los secretos mediante variables privadas de entorno, sin subir `.env.local`.

## Referencias

- [Instalación de Node.js](https://nodejs.org/).
- [Docker](https://docs.docker.com/get-started/get-docker/).
- [Supabase: desarrollo local](https://supabase.com/docs/guides/local-development).
- [Supabase: claves y seguridad](https://supabase.com/docs/guides/getting-started/api-keys).
- [Supabase: SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- [Ollama](https://ollama.com/download).
- [Gemini API](https://ai.google.dev/gemini-api/docs).

Las funciones de nómina, biometría, ERP y multitenancy no forman parte de esta implementación. Revisa y prueba tu instalación antes de usarla con datos reales.
