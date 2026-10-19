# Gráficas con amCharts 5

## Uso en Nexo

- **Desempeño y analíticas, análisis generado:** selecciona los filtros del módulo y el periodo, agrupación y comparación. Puedes solicitar varias vistas o una gráfica por área. El servidor conserva el alcance autorizado y calcula cada informe; amCharts representa sus cifras. Cambia entre barras, columnas, líneas, circular y dona sin volver a generar el análisis.
- **Paneles de analíticas:** muestran la distribución por estado del proceso seleccionado. El selector permite barras o dona y conserva los filtros aplicados al conjunto cargado.
- **Ambiente laboral:** columnas o barras por pregunta con promedios decimales y escala fija de 0 a 5. Las etiquetas P1, P2, etc. se corresponden con las preguntas completas del listado y la tabla. Estos valores no son conteos ni porcentajes de personas. Las gráficas siguen sujetas a encuesta cerrada, cinco respuestas como mínimo y agregados disponibles.

Las gráficas ofrecen detalles al pasar el puntero y una tabla HTML en **Ver datos de la gráfica**. En vistas XY se puede seleccionar un intervalo para acercar la vista; con más de ocho categorías se añade una barra de desplazamiento. Este acercamiento es visual y no cambia los filtros del servidor. La tabla conserva todas las categorías.

Los conteos incluyen los valores cero. Las gráficas vacías muestran un aviso; los promedios mantienen hasta dos decimales. Las líneas conectan categorías ordenadas por el informe: una agrupación por creación no reconstruye cambios históricos de estado. El color distingue categorías, sin asignar por sí solo un juicio sobre desempeño.

En las gráficas circular y dona, la leyenda ocupa un espacio propio debajo del círculo, con altura reservada y una fila por categoría. Las leyendas extensas permiten desplazamiento y las etiquetas abreviadas conservan el nombre completo al pasar el puntero. Se deja espacio para la marca de amCharts en el borde inferior. Los detalles usan `{category}` para estas series y `categoryLabel` en los datos de presentación: `label` es un objeto interno de la librería y no debe utilizarse para mostrar el nombre de una categoría. `tests/chart-tooltip.test.ts` reproduce esa colisión con el formateador real y verifica nombres, cifras, porcentajes y decimales.

## Arquitectura

1. `chartSchema` valida las propuestas de representación. `chart-report.ts` y los agregados de encuestas determinan las cifras con datos autorizados.
2. `workforce-tools.tsx`, `operations-panels.tsx` y `climate-question-chart.tsx` entregan título, categorías y valores al componente común `DataChart`.
3. `DataChart` genera la tabla y carga `AmChart` mediante `import()` después del montaje en el navegador. Un recurso compartido (`module-loader.ts`) conserva la descarga y el resultado entre gráficas, comunica errores y limita cada espera a 30 segundos. El paquete no se ejecuta en SSR ni necesita un CDN.
4. `AmChart` crea un `Root` por elemento, configura ejes/series antes de asignar datos y llama a `root.dispose()` al desmontarse o cambiar el contenido de los datos, representación, tema o movimiento reducido. Un array nuevo con las mismas cifras no reinicia el canvas. Los identificadores por índice evitan fusionar categorías con textos iguales.

La carga del paquete se difiere hasta mostrar una gráfica. Las instancias se ajustan al ancho disponible; etiquetas largas se abrevian en los ejes y se conservan completas en los detalles y la tabla. El tema sigue la preferencia de Nexo. Las animaciones se omiten cuando el navegador solicita movimiento reducido. Los fallos de carga o dibujo muestran un aviso y **Reintentar gráfica**, conservando la tabla y el análisis. Este botón no recarga la página ni repite una solicitud de IA. Si una descarga lenta termina después del límite, la gráfica se recupera automáticamente mientras no haya sido reemplazada por un intento más reciente.

El paquete se instala con `npm ci` a partir de `package-lock.json`. No requiere una clave de IA adicional. No se entregan credenciales, archivos privados ni identidades de participantes a amCharts; el componente recibe las categorías y cifras que ya puede consultar la sesión. No carga scripts remotos ni ejecuta JavaScript generado por IA. La librería visual no sustituye controles de API, RLS o privacidad.

## Mantenimiento y comprobación

- Componentes: [DataChart](../src/components/data-chart.tsx), [AmChart](../src/components/am-chart.tsx).
- Adaptador: [data.ts](../src/lib/charts/data.ts). Rechaza cantidades negativas/no finitas, conserva ceros, decimales y orden; no altera filtros ni promedios.
- Negocio: [chart-report.ts](../src/modules/workspace/chart-report.ts), [workforce-ai.ts](../src/modules/workspace/workforce-ai.ts), [climate-charts.ts](../src/modules/workspace/climate-charts.ts).
- Ejecutar `npm run typecheck`, `npm run lint` y `npm test`. Al cambiar el motor, comprobar también en navegador las cinco representaciones, cambio de tema, navegación entre módulos, filtros y preguntas de encuesta.

Las skills del asistente son herramientas locales para desarrollar, no dependencias de ejecución. `.gitignore` excluye las carpetas `.agents/skills/`, `.codex/skills/` y `.cursor/skills/`.

### Validación de la integración (19 de octubre de 2026)

TypeScript, ESLint de los archivos modificados y la compilación de producción finalizaron correctamente. Pasaron 35 pruebas del adaptador, tabla accesible, cinco representaciones, informes con filtros, privacidad de encuestas y SQL. La suite general registró 571 pruebas correctas, 24 omitidas y un tiempo agotado en la prueba SQL; esa prueba pasó al repetirse con concurrencia limitada. La inspección visual quedó pendiente porque la herramienta del navegador bloqueó el acceso local.

La instalación no cambió versiones de paquetes existentes. `npm audit` notificó nueve avisos (ocho altos y uno crítico) en dependencias existentes, incluyendo Next.js y su cadena de herramientas; amCharts no figura entre los paquetes señalados. Esta integración no resuelve esos avisos ni sustituye su revisión antes de publicar una versión.

## Recargas y carga de gráficas en desarrollo

Los registros de Next.js mostraron peticiones de actualización `/_next/hmr` bloqueadas (403) desde `127.0.0.1`, porque el servidor se inicializaba como `localhost`. `allowedDevOrigins: ["127.0.0.1"]` admite únicamente ese nombre local adicional; se conserva el bloqueo a otros orígenes. El script `npm run dev` utiliza webpack después de un error interno de actualización observado con Turbopack. Next.js todavía puede recargar la vista al cambiar archivos o reiniciar el servidor durante el desarrollo; para una demostración estable usa `npm run build` y después `npm start` con el servidor de desarrollo detenido.

El cargador anterior mostraba siempre el indicador de espera y no tenía un plazo de salida. Su botón de recuperación llamaba a `window.location.reload()`, perdiendo el estado de pantalla. El cargador actual distingue descarga, error y disponibilidad; comparte una sola importación y permite reintentar sin navegar. Las pruebas `chart-module-loader.test.ts` reproducen rechazo, espera agotada, recuperación y promesas obsoletas; `dev-origins.test.ts` reproduce el 403 original y verifica acceso local conservando el bloqueo externo.

La corrección pasó 29 pruebas de regresión, TypeScript, ESLint y la compilación de producción. Se comprobó también la sintaxis del arranque PowerShell. La validación visual en el navegador sigue pendiente por el bloqueo de la herramienta de inspección.

## Interpretación de IA y revisión factual

La lectura del análisis se genera después de calcular las gráficas. El redactor recibe hechos autorizados, procesos, áreas y periodos; no debe forzar una comparación cuando solo hay una vista o faltan datos. Cada frase se contrasta en una llamada con `answer_text` y `source_text`, restringiendo las fuentes al proceso y área mencionados. Una comparación entre procesos conserva las fuentes de ambos. Las correcciones utilizan instrucciones de gráficas, sin aplicar criterios de evaluación de CV o evidencias.

El 19 de octubre se reprodujo con datos ficticios un rechazo incorrecto del modelo local: comparaba una afirmación sobre tareas con cifras de capacitación y rechazaba un texto correcto. La corrección separa las fuentes y simplifica el contrato de revisión. Pasaron cuatro pruebas con el proveedor Ollama real: procesos distintos, una vista vacía, comparación entre áreas y rechazo de un estado inventado. La comprobación reduce errores, pero sigue dependiendo del modelo; un texto que no supere la revisión no se publica. La API conserva las gráficas y distingue rechazo factual, tiempo agotado, salida inválida o fallo del proveedor mediante `narrative_error_code`.

## Fuentes y licencia

- [Integración oficial con React](https://www.amcharts.com/docs/v5/getting-started/integrations/react/).
- [Demostración de columnas](https://www.amcharts.com/demos/simple-column-chart/).
- [Demostración de dona](https://www.amcharts.com/demos/donut-chart/).
- [Repositorio y licencia del paquete](https://github.com/amcharts/amcharts5).

Se conserva la marca de amCharts. La skill no concede una licencia comercial del paquete; véanse [los avisos de terceros](../THIRD_PARTY_NOTICES.md) y los términos oficiales antes de cambiar su atribución.
