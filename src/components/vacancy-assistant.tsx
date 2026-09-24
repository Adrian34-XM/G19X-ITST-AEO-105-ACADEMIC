"use client";
/** Borrador revisable: generar no publica la vacante ni cambia sus datos. */
import { useState } from "react";
import { type Snapshot, value } from "@/modules/workspace/types";
export function VacancyAssistant({
  data,
  onDraft,
}: {
  data: Snapshot;
  onDraft: (values: Record<string, unknown>) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <details className="panel vacancy-assistant">
      <summary>✧ Crear propuesta de vacante con IA</summary>
      <p>
        Selecciona el puesto y adjunta información de referencia. Podrás
        corregir título, descripción, requisitos, habilidades y experiencia
        antes de guardar.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/ai/vacancy", {
              method: "POST",
              body,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            onDraft(result.draft);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "No se pudo generar el borrador.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Puesto
          <select name="position_id" required>
            <option value="">Selecciona un puesto</option>
            {(data.positions ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {value(p, "name")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Datos y necesidades de la vacante
          <textarea
            name="context"
            required
            minLength={10}
            maxLength={6000}
            placeholder="Responsabilidades, modalidad, herramientas, objetivos y requisitos del puesto."
          />
        </label>
        <label>
          Documento de referencia para IA (PDF o TXT, opcional, máximo 5 MB)
          <input type="file" name="file" accept=".pdf,.txt" />
        </label>
        <p className="muted">
          El texto del documento se envía al proveedor configurado para preparar
          la propuesta; no se guarda el original en esta acción. Usa información
          del puesto sin datos personales. Puedes conservar documentos privados
          en una vacante ya guardada.
        </p>
        <button className="ai-button" disabled={busy}>
          {busy ? "Preparando propuesta…" : "Generar y revisar propuesta"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
