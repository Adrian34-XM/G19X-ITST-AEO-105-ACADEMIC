import { ApiError } from "@/lib/auth";

/** Destino controlado por despliegue; nunca utiliza Host ni una URL enviada por el visitante. */
export function authEmailRedirect() {
  const configured = process.env.APP_URL;
  if (!configured)
    throw new ApiError(503, "Configura APP_URL para enviar correos de acceso.");
  const url = new URL(configured);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password
  )
    throw new ApiError(
      503,
      "APP_URL debe usar HTTPS, excepto en desarrollo local.",
    );
  return `${url.origin}/auth/confirm`;
}

export const recoveryMessage =
  "Si el correo corresponde a una cuenta, recibirás un enlace para recuperar el acceso. Revisa también la carpeta de spam.";
export const registrationMessage =
  "Si tu correo puede registrarse, recibirás un enlace de confirmación. Si ya tienes cuenta, inicia sesión o recupera tu contraseña.";
