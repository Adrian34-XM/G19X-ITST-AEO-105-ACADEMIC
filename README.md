# Nexo · Sistema de Recursos Humanos con IA

Aplicación web para reclutamiento, equipo y organigrama, incorporación, capacitación, tareas y evidencias, desempeño, analíticas y ambiente laboral. Incluye roles de superusuario, RH, jefe, empleado y candidato. La IA aporta análisis sujetos a revisión humana; no contrata ni aprueba entregas automáticamente.

Tecnologías: Node.js 24, Next.js 16, React 19, TypeScript, Supabase Auth, PostgreSQL y Storage privado. La IA puede usar Ollama local o Gemini.

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

Sustituye la URL de ejemplo por la dirección real del repositorio:

```sh
git clone <URL_DEL_REPOSITORIO> arquitectura-rh
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
npx supabase db push
```

El enlace puede solicitar la contraseña de PostgreSQL del proyecto; no es la contraseña de una cuenta Nexo. Revisa el destino antes de aplicar cambios. Para una instalación nueva, aplica **todas** las migraciones de `supabase/migrations/` mediante este flujo. No combines este procedimiento con los instaladores SQL agregados, que pueden intentar crear los mismos objetos.

4. En Supabase Auth configura la URL del sitio y permite `http://127.0.0.1:3000/auth/confirm` como URL de redirección. Si usas `localhost`, configura también esa variante y utiliza el mismo origen en `APP_URL`.
5. Configura las plantillas de confirmación, invitación y recuperación tomando como referencia `supabase/templates/`. En un servicio alojado estas plantillas no se instalan automáticamente por ejecutar migraciones SQL. Configura el envío de correo y, para pruebas fuera de las restricciones del servicio predeterminado, un proveedor SMTP propio.
6. Para cargar la demostración **solo en un proyecto de pruebas vacío**, ejecuta primero `supabase/seed.sql` en su SQL Editor. Después establece `DEMO_PASSWORD` y `ALLOW_REMOTE_DEMO=true` en `.env.local` y ejecuta `npm run seed`. Retira `ALLOW_REMOTE_DEMO` cuando termines. No ejecutes el seed de demostración sobre una instalación con datos reales.
7. Arranca la aplicación con el comando del apartado 6.

La contraseña y las claves son propias de cada instalación. Clonar el repositorio no copia usuarios, documentos, modelos, configuración SMTP ni datos de la base anterior. Para reutilizar una base alojada existente, usa sus credenciales autorizadas y aplica únicamente migraciones pendientes; no ejecutes el seed.

Para diagnosticar una instalación, ejecuta `supabase/verificar-migraciones.sql` en el SQL Editor. No modifica datos; muestra requisitos ausentes. El archivo no sustituye la ejecución ordenada de las migraciones, incluida la de fotos de perfil `202610060001_profile_photos.sql`.

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

Para arrancar una compilación de producción en la misma máquina, detén `npm run dev`, ejecuta `npm run build` y después `npm run start -- --hostname 127.0.0.1`. No ejecutes ambos servidores en el puerto 3000 al mismo tiempo. Esto prueba el modo de producción local; no configura un alojamiento público.

## 10. Problemas frecuentes

- **No se encontró el sitio:** comprueba que Next.js siga activo, que no haya errores en la terminal y que estés usando el puerto anunciado. Si 3000 está ocupado, detén tu instancia anterior o cambia el puerto y actualiza `APP_URL` y las redirecciones de Auth.
- **Docker no está disponible:** abre Docker Desktop, activa el motor Linux y vuelve a ejecutar `npx supabase start`.
- **Faltan tablas o funciones SQL:** verifica que las migraciones se aplicaron al mismo proyecto cuya URL aparece en `.env.local`. No ejecutes una mejora aislada sobre una base vacía.
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
