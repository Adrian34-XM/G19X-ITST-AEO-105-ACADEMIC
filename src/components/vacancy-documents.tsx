"use client";
import { useState } from "react";
/** La lista se carga al abrir el panel; no expone rutas de Storage en el listado. */
export function VacancyDocuments({ vacancy }: { vacancy: string }) {
  const [documents, setDocuments] = useState<
      { id: string; filename: string }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch(`/api/vacancy-documents?vacancy=${vacancy}`, {
        cache: "no-store",
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setDocuments(b.documents);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los archivos.",
      );
    }
  }
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>Documentos privados de referencia</summary>
      <p>
        PDF o TXT, hasta 5 MB. Solo RH y el superadministrador pueden
        consultarlos.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const body = new FormData(form);
          body.set("vacancy", vacancy);
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/vacancy-documents", {
              method: "POST",
              body,
            });
            const b = await r.json();
            if (!r.ok) throw new Error(b.error);
            form.reset();
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo adjuntar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Adjuntar documento
          <input type="file" name="file" accept=".pdf,.txt" required />
        </label>
        <button disabled={busy}>
          {busy ? "Subiendo…" : "Guardar adjunto"}
        </button>
      </form>
      {documents.map((d) => (
        <button
          className="quiet"
          disabled={busy}
          key={d.id}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await fetch(
                `/api/vacancy-documents?vacancy=${vacancy}&id=${d.id}`,
              );
              const b = await r.json();
              if (!r.ok) throw new Error(b.error);
              window.open(b.url, "_blank", "noopener,noreferrer");
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo abrir.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {d.filename} ↗
        </button>
      ))}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
