"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";

/** El diálogo nativo mantiene el foco dentro de la ventana y permite cerrarla con Escape. */
export function ApplicationAccess({ title }: { title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button onClick={() => dialog.current?.showModal()}>
        Postularme <ArrowUpRight size={16} />
      </button>
      <dialog ref={dialog} className="application-access-dialog" aria-label="Regístrate o inicia sesión">
        <div className="section-head">
          <h2>Regístrate o inicia sesión</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <p>Para postularte a <strong>{title}</strong>, necesitas una cuenta de candidato.</p>
        <p>Si ya tienes cuenta, inicia sesión. Si es tu primera visita, regístrate para completar tu perfil y enviar tu postulación.</p>
        <div className="actions">
          <Link className="button" href="/register">Registrarse</Link>
          <Link className="button secondary" href="/login">Iniciar sesión</Link>
          <button className="quiet" onClick={() => dialog.current?.close()}>Seguir viendo vacantes</button>
        </div>
      </dialog>
    </>
  );
}
