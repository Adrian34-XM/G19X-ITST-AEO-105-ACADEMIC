# IA local: imágenes y documentos

La integración visual es compartida por las rutas de análisis de evidencias de tareas, evidencias de capacitación y CV. Conserva autenticación, jerarquía y descargas privadas con la sesión del solicitante. Los módulos que únicamente almacenan archivos (por ejemplo, onboarding) no adquieren automáticamente un botón de análisis.

## Configuración

En `.env.local`, usa `AI_PROVIDER=ollama`, `OLLAMA_MODEL=qwen2.5:3b` para texto y `OLLAMA_VISION_MODEL=gemma3:4b` para imágenes. Instala el modelo con `ollama pull gemma3:4b`. Las imágenes y PDF escaneados se procesan localmente; no requieren una clave externa. Si se selecciona Gemini, los archivos se enviarán a ese proveedor según la configuración existente.

## Formatos y límites

- PNG y JPG/JPEG: análisis visual en tareas y capacitación. El proveedor recibe la imagen y los requisitos de la tarea o curso, nunca solo el porcentaje declarado.
- PDF con texto: extracción de hasta 20 páginas y 14 000 caracteres. El análisis considera texto, no asegura interpretar todas las figuras de un documento mixto.
- PDF sin texto/escaneado: renderizado local de todas las páginas, máximo seis por archivo, y envío de imágenes al modelo visual. Se rechazan documentos más largos con un mensaje; no se recortan silenciosamente. Cada página se limita a 1600 píxeles en su lado mayor.
- TXT: UTF-8, hasta 14 000 caracteres de contexto.
- Máximo de subida: 5 MB por archivo. CV admite PDF/TXT; tareas y capacitación también PNG/JPG.
- DOCX, XLSX, PPTX, ZIP, audio y video no tienen extractor ni análisis habilitado. Exporta a PDF o TXT según el contenido.

Los PDF dañados o protegidos con contraseña requieren una copia válida y sin contraseña. Una captura de una entrega o un porcentaje no demuestra por sí sola el aprendizaje. La IA debe distinguir lo visible de lo no comprobable, y la aceptación final sigue correspondiendo a RH o al jefe autorizado.

## Ejecución y pruebas

Las solicitudes de visión permiten hasta 180 segundos y descargan el modelo de memoria después de responder (`keep_alive: 0`). Esto reduce RAM retenida, pero puede hacer más lenta la siguiente consulta.

La suite normal prueba selección de modelo, adjuntos, extracción de texto, renderizado PDF y límites. La prueba real es optativa: configura `RUN_LOCAL_VISION=true` y ejecuta Vitest con las variables de `.env.local` sobre `tests/vision-live.test.ts`. `VISION_TEST_IMAGE` permite elegir un PNG de prueba; por defecto se usa un archivo sintético. Los resultados locales se guardan en `.local/vision-*.json`, carpeta ignorada por Git. No se ejecutan llamadas reales al modelo durante la suite habitual.

## Resultado verificado en este equipo

El 25/09/2026 se instaló `gemma3:4b` y Ollama confirmó capacidades `completion` y `vision`. Quedó configurado en `.env.local`. La captura del usuario fue analizada en unos 26 segundos tras la primera carga; el PDF escaneado sintético, en unos 19 segundos; el PDF con texto se procesó con `qwen2.5:3b` en unos 11 segundos. Los tiempos dependen de memoria y carga del equipo.

La captura mostró un 25% registrado, pero no el objetivo, los pasos ni los resultados del ejercicio. Se detectó una respuesta inicial contradictoria (enumeraba faltantes y devolvía SUFFICIENT). La revisión de capacitación ahora transforma ese caso en MORE_EVIDENCE antes de mostrarlo. No se trata de una garantía de exactitud visual ni reemplaza la revisión humana.

Verificación final: 124 pruebas automáticas aprobadas; tres pruebas reales de proveedor aprobadas, más repetición de la captura tras agregar la regla de consistencia. TypeScript y lint correctos. Las pruebas reales llaman al adaptador compartido: no sustituyen repetir la subida y revisión de cada rol desde el navegador.
