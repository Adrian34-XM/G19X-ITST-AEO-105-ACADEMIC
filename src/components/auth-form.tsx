"use client";
/**
 * @file Formulario de acceso y registro que envía credenciales a las rutas de autenticación.
 * Gestiona el estado de envío y los errores sin incorporar claves administrativas al navegador.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Formulario de acceso y registro. Envía las credenciales al endpoint propio y navega según su respuesta; el rol no se elige desde el registro público.
 */
import Link from "next/link";
import { useState } from "react";
import { LoginBackdrop } from "./login-backdrop";
import { PasswordInput } from "./password-input";
/** Avisos que llegan por la URL cuando el formulario se envió sin JavaScript hidratado. */
const notices: Record<string, string> = {
  error:
    "No se pudo completar la operación. Revisa los datos e intenta de nuevo.",
  registro:
    "Si tu correo puede registrarse, recibirás un enlace de confirmación. Si ya tienes cuenta, inicia sesión o recupera tu contraseña.",
  confirmar: "Revisa tu correo para confirmar tu cuenta.",
};
export function AuthForm({
  register,
  configured,
  notice = "",
}: {
  register: boolean;
  configured: boolean;
  notice?: string;
}) {
  const endpoint = "/api/auth/" + (register ? "register" : "login");
  const [error, setError] = useState(notices[notice] ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.message) setError(result.message);
      else window.location.assign(result.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout auth-layout-slats">
      <section className="auth-story">
        <LoginBackdrop />
        <Link className="brand" href="/jobs">
          <span className="brand-mark">n</span> nexo
          <span className="brand-dot">.</span>
        </Link>
        <div className="auth-story-copy">
          <span className="eyebrow">PERSONAS QUE HACEN LA DIFERENCIA</span>
          <h1>
            Conecta el talento.
            <br />
            Impulsa su futuro.
          </h1>
          <p>
            Un espacio para acompañar cada paso: desde la primera oportunidad
            hasta el desarrollo de tu equipo.
          </p>
        </div>
        <small>Gestión de talento, con las personas al centro.</small>
      </section>
      <section className="auth-form">
        <div className="panel">
          <span className="eyebrow">BIENVENIDO A NEXO</span>
          <h2>
            {register
              ? "Encuentra tu siguiente oportunidad"
              : "Qué gusto verte de nuevo"}
          </h2>
          <p>
            {register
              ? "Crea tu cuenta de candidato."
              : "Ingresa para continuar con tu espacio de trabajo."}
          </p>
          {/* method y action garantizan que un envío previo a la hidratación viaje por POST, nunca con la contraseña en la URL. */}
          <form method="post" action={endpoint} onSubmit={submit}>
            {register && (
              <label>
                Nombre completo
                <input
                  name="full_name"
                  required
                  maxLength={150}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Correo electrónico
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Contraseña
              <PasswordInput
                id="auth-password"
                name="password"
                minLength={12}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                required
              />
              <small>Mínimo 12 caracteres.</small>
            </label>
            {(!configured || error) && (
              <p role="alert" className="error">
                {error ||
                  "Configura Supabase en .env.local para habilitar el acceso."}
              </p>
            )}
            <button disabled={busy || !configured}>
              {busy
                ? "Conectando…"
                : register
                  ? "Crear cuenta"
                  : "Iniciar sesión"}{" "}
              <span>→</span>
            </button>
          </form>
          {!register && (
            <p>
              <Link href="/auth/recover">
                ¿Olvidaste tu contraseña o necesitas otro enlace?
              </Link>
            </p>
          )}
          <p>
            {register ? "¿Ya tienes cuenta?" : "¿Buscas una oportunidad?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Inicia sesión" : "Regístrate"}
            </Link>
          </p>
          <Link href="/jobs">Explorar vacantes ↗</Link>
        </div>
      </section>
    </main>
  );
}
