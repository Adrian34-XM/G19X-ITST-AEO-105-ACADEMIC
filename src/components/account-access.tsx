"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { request } from "@/components/forms";

/** Los enlaces requieren una acción explícita: abrirlos no consume el código de un solo uso. */
export function AccountAccess({
  mode,
  token,
  type,
  code,
}: {
  mode: "recover" | "confirm" | "password";
  token?: string;
  type?: string;
  code?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [callback, setCallback] = useState<Record<string, string> | null>(
    code ? { code } : null,
  );
  useEffect(() => {
    if (mode !== "confirm") return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const access = fragment.get("access_token");
    const refresh = fragment.get("refresh_token");
    const kind = fragment.get("type");
    if (
      access &&
      refresh &&
      ["signup", "invite", "recovery"].includes(kind ?? "")
    ) {
      // El fragmento solo existe en el navegador; sincronizarlo después de hidratar evita exponerlo al servidor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallback({
        access_token: access,
        refresh_token: refresh,
        type: kind!,
      });
    }
    if (
      fragment.has("error") ||
      new URLSearchParams(window.location.search).has("error")
    )
      setError(
        "El enlace ha caducado o ya se utilizó. Intenta iniciar sesión; si no puedes entrar, solicita otro enlace.",
      );
    // Mantener query hasta confirmar evita perder el código al recargar. El fragmento
    // contiene credenciales: se conserva solo en memoria, nunca en logs ni almacenamiento.
    if (window.location.hash)
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
  }, [mode]);
  const validLink = Boolean(
    callback ||
    (token && ["invite", "recovery", "signup"].includes(type ?? "")),
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload =
        mode === "confirm"
          ? (callback ?? { token_hash: token, type })
          : Object.fromEntries(new FormData(event.currentTarget));
      const result = await request(
        `/api/auth/${mode === "confirm" && callback ? "callback" : mode}`,
        payload,
      );
      if (mode === "confirm")
        window.history.replaceState(null, "", "/auth/confirm");
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
        {mode === "confirm" && !validLink && !done ? (
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
