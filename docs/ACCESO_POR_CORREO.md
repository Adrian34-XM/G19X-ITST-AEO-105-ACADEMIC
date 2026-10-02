# Invitaciones y recuperación de acceso

El superusuario usa **Usuarios → Invitar usuario por correo**. Indica nombre, correo y rol; ya no establece contraseñas. El servidor reserva una cuenta sin contraseña ni correo confirmado, asigna el rol con los permisos del superusuario y solicita a Supabase enviar la invitación. La reserva rechaza correos duplicados, incluidos registros todavía sin confirmar. Si falla la asignación o el envío, se intenta eliminar únicamente la cuenta recién creada. Auth y los perfiles no forman una transacción: si falla esa compensación, el administrador debe revisar la cuenta antes de reintentar.

La persona abre el enlace, pulsa Continuar y define su contraseña (12–128 caracteres, repetida para confirmar). Después inicia sesión. El cambio solicita cerrar todas las sesiones en Supabase; los tokens de acceso ya emitidos pueden durar hasta su expiración. Los roles no se eligen en el registro público: ese flujo sigue creando candidatos.

Desde el acceso se puede solicitar recuperación. La respuesta pública no indica si existe el correo. El registro público tampoco revela duplicados: Supabase puede simular una respuesta exitosa cuando el correo ya existe, pero no crea una segunda cuenta. El administrador sí recibe un rechazo explícito al intentar duplicar una cuenta.

## Configuración necesaria en Supabase alojado

1. Define `APP_URL` en el servidor (por ejemplo, `https://nexo.empresa.mx`). En local utiliza `http://127.0.0.1:3000`. Reinicia Next después de cambiar el entorno.
2. En Authentication → URL Configuration, establece Site URL con el origen y agrega la URL exacta `APP_URL/auth/confirm` a Redirect URLs. No uses comodines en producción.
3. Activa Confirm email en el proveedor de correo. La aplicación no puede sustituir esa configuración: si se desactiva, Supabase puede confirmar automáticamente el registro.
4. Copia los archivos de `supabase/templates/` a las plantillas correspondientes: Invite user, Reset password y Confirm signup. Conserva `TokenHash`, `RedirectTo` y el tipo de cada enlace. También se admiten las plantillas predeterminadas: sus códigos PKCE requieren el mismo navegador y origen donde se solicitó el correo; los tokens en el fragmento se validan con Auth antes de continuar.
5. Configura SMTP para enviar a destinatarios reales, remitente verificado y los límites de envío. No guardes credenciales SMTP en variables públicas. Configura expiración de códigos y límites de solicitudes en Auth. Si habilitas CAPTCHA, integra además la respuesta del desafío en los formularios antes de activarlo.

La configuración en `supabase/config.toml` aplica al Supabase local, no modifica el proyecto alojado. Los cambios de este flujo no requieren migración SQL.

## Recorrido de aceptación con un correo de prueba autorizado

- Invita un correo nuevo desde un superusuario. Comprueba recepción, rol asignado y ausencia de acceso mediante contraseña antes de aceptar.
- Abre el enlace: abrirlo no consume el código; pulsa Continuar, establece contraseña e inicia sesión. Comprueba el área de su rol.
- Reabre el mismo enlace y prueba uno vencido: ambos deben fallar al confirmarlos. Pide otro enlace mediante Recuperar acceso.
- Registra un candidato nuevo: antes de confirmar no debe entrar. Confirma el correo y comprueba el acceso como candidato.
- Solicita recuperación, cambia la contraseña y verifica que la antigua ya no permite iniciar sesión.
- Intenta duplicar el correo desde Usuarios: debe rechazarse sin cambiar el perfil existente. Repite el registro público: debe conservar una sola cuenta sin revelar su existencia.
- Desde una cuenta sin privilegios, intenta invitar: debe denegarse.

Las pruebas automatizadas simulan Auth y verifican contratos y permisos. No acreditan entrega SMTP, enlaces reales de un solo uso ni configuración del proyecto remoto: completa este recorrido antes de publicar. No registres tokens, enlaces completos ni contraseñas en logs.
