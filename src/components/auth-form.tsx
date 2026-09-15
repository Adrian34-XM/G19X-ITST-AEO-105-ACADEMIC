"use client";
import Link from "next/link";
import { useState } from "react";
export function AuthForm({
  register,
  configured,
}: {
  register: boolean;
  configured: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        "/api/auth/" + (register ? "register" : "login"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(form)),
        },
      );
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
    <main className="auth-layout">
      <section className="auth-story">
        <Link className="brand" href="/jobs">
          <span className="brand-mark">n</span> nexo
          <span className="brand-dot">.</span>
        </Link>
        <div>
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
          <form onSubmit={submit}>
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
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
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
