"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { request } from "@/components/forms";

/** Los enlaces requieren una acción explícita: abrirlos no consume el código de un solo uso. */
export function AccountAccess({
  mode,
  token,
  type,
}: {
  mode: "recover" | "confirm" | "password";
  token?: string;
  type?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (mode === "confirm")
      window.history.replaceState(null, "", "/auth/confirm");
  }, [mode]);
  const validLink = Boolean(
    token && ["invite", "recovery", "signup"].includes(type ?? ""),
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload =
        mode === "confirm"
          ? { token_hash: token, type }
          : Object.fromEntries(new FormData(event.currentTarget));
      const result = await request(`/api/auth/${mode}`, payload);
      if (result.message) {
        setMessage(result.message);
        setDone(true);
      } else if (result.redirect) window.location.assign(result.redirect);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la solicitud.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="center">
      <section className="panel setup">
        <span className="eyebrow">NEXO · ACCESO A TU CUENTA</span>
        <h1>
          {mode === "recover"
            ? "Recuperar acceso"
            : mode === "password"
              ? "Define tu contraseña"
              : "Confirma tu correo"}
        </h1>
        <p>
          {mode === "recover"
            ? "Te enviaremos un enlace para que puedas elegir una nueva contraseña."
            : mode === "password"
              ? "Solo tú conocerás tu contraseña. Utiliza al menos 12 caracteres."
              : "Continúa para validar el enlace que recibiste por correo."}
        </p>
        {mode === "confirm" && !validLink ? (
          <p role="alert">
            El enlace está incompleto. Abre de nuevo el enlace del correo o
            solicita uno nuevo.
          </p>
        ) : (
          !done && (
            <form onSubmit={submit}>
              {mode === "recover" && (
                <label>
                  Correo electrónico
                  <input
                    name="email"
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    required
                  />
                </label>
              )}
              {mode === "password" && (
                <>
                  <label>
                    Nueva contraseña
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <label>
                    Repite la contraseña
                    <input
                      name="confirm_password"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                </>
              )}
              <button disabled={busy}>
                {busy
                  ? "Procesando…"
                  : mode === "recover"
                    ? "Enviar enlace"
                    : mode === "password"
                      ? "Guardar contraseña"
                      : "Continuar"}
              </button>
            </form>
          )
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <p>
          <Link href="/login">Volver al acceso</Link>
          {mode !== "recover" && (
            <>
              {" "}
              · <Link href="/auth/recover">Solicitar otro enlace</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
