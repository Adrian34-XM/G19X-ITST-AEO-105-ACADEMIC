# Capacitación: avances y evidencias

## Revisión de avances parciales
RH y el jefe autorizado reciben una alerta en la vista general cuando hay un avance o una nueva evidencia pendiente. En Capacitación > Seguimiento y revisión, el filtro inicial reúne estos pendientes. El responsable puede aceptar el porcentaje respaldado por evidencias o ajustarlo; para rechazar debe indicar el último porcentaje aprobado o uno menor. Las observaciones son obligatorias y se muestran al colaborador. Solo aceptar el 100% completa la capacitación.

Se requiere ejecutar el activador actualizado o la migración `202609250004_training_progress_reviews.sql`. La migración incluye avances existentes sin completar para su revisión. Los avisos se actualizan al cargar/actualizar la vista; no son correos ni notificaciones push.

## Comprobación visual del 25 de septiembre de 2026
Se envió la captura de prueba del usuario al modelo local `qwen2.5:3b`. Ollama declaró capacidades `completion` y `tools` y rechazó la solicitud con HTTP 400 porque el modelo no admite entradas multimodales. El sistema ya admite adjuntos visuales con un modelo de visión configurado en `OLLAMA_VISION_MODEL` (o Gemini), pero no se configuró ni descargó un modelo nuevo durante esta prueba. Una captura que muestra un porcentaje y una entrega no prueba por sí sola la ejecución del ejercicio. El prompt exige contrastar lo visible con los entregables y solicitar más evidencia cuando no se pueda comprobar.

Actualización posterior: se instaló y configuró `gemma3:4b`; imágenes y PDF escaneados ya se probaron con el proveedor real. Consulta `IA_VISION_LOCAL.md` para el alcance, límites y resultados actuales.
