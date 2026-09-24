# Recursos y evidencias de capacitación

Para activar en el Supabase conectado, ejecutar `supabase/migrations/202609230003_course_evidence.sql` una vez en SQL Editor, o el archivo acumulativo `supabase/activar-mejoras-rh.sql` (repetible). No se aplicó automáticamente al servidor remoto.

## Uso

- En cada curso, abrir **Videos y recursos recomendados con IA**, describir el tema y generar sugerencias. Los enlaces abren búsquedas de videos o material; no son contenidos verificados por la aplicación. El usuario comprueba su gratuidad y pertinencia.
- El colaborador abre **Evidencias de avance y opinión de IA**, declara el porcentaje que respalda el archivo y adjunta hasta diez archivos por envío, máximo 5 MB cada uno. Se admiten PDF, TXT, PNG y JPG.
- Después registra su avance. Sin evidencia suficiente para ese porcentaje, el servidor rechaza la operación. Llegar a 100% significa **En revisión**, no curso completado.
- RH o el jefe autorizado abre los documentos y puede pedir una opinión a la IA. Se describen aprendizajes demostrados y faltantes; esta acción no cambia el estado.
- En **Seguimiento y revisión de capacitaciones**, el responsable confirma finalización o solicita correcciones con comentarios. Una corrección exige nueva evidencia antes de reenviar. Nadie valida su propia capacitación.

Las evidencias son privadas, con permisos de propietario, RH o jerarquía autorizada y enlaces de descarga de 60 segundos. La opinión IA es orientativa y permanece en la vista durante la sesión; los archivos, avances y revisión humana se conservan en la base. PDF con texto y TXT funcionan con Ollama; imágenes y PDF escaneados necesitan un proveedor/modelo con capacidad visual. La revisión manual sigue disponible.

Las capacitaciones ya completadas conservan su historial. Las entregas antiguas sin evidencia deben devolverse para corrección antes de poder aprobarse con la nueva regla. No se convierte retroactivamente una capacitación completada en pendiente.

La IA recibe el contenido del curso y de la evidencia seleccionada, sin nombres/correos del colaborador ni otros expedientes. Si se usa Gemini, ese contenido se procesa en el proveedor externo; con Ollama depende de la URL configurada. No adjuntar información personal innecesaria.
