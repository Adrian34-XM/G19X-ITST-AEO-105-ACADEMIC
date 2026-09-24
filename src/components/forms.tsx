"use client";
/**
 * Formularios reutilizables: convierte campos a tipos de negocio, envía JSON y muestra errores. Las subidas usan FormData; la validación definitiva ocurre en el servidor.
 */
import { useState } from "react";
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "datetime-local"
    | "checkbox"
    | "select"
    | "list"
    | "email"
    | "password";
  options?: { value: string; label: string }[];
  optional?: boolean;
  min?: number;
  max?: number;
};
export type FormSpec = {
  title: string;
  op: string;
  fields: Field[];
  values?: Record<string, unknown>;
};
export async function request(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la acción.");
  return result;
}
export function EditForm({
  spec,
  onClose,
  onSaved,
}: {
  spec: FormSpec;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [minimumInterviewTime] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    if (spec.values?.id) payload.id = spec.values.id;
    for (const field of spec.fields) {
      const raw = String(form.get(field.key) ?? "");
      payload[field.key] =
        field.type === "number"
          ? Number(raw)
          : field.type === "checkbox"
            ? form.has(field.key)
            : field.type === "list"
              ? raw
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : field.type === "datetime-local"
                ? new Date(raw).toISOString()
                : raw;
    }
    try {
      await request(
        spec.op === "user.create" ? "/api/admin/users" : "/api/commands",
        spec.op === "user.create" ? payload : { op: spec.op, payload },
      );
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal"
      >
        <div className="section-head">
          <h2 id="modal-title">{spec.title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          {spec.fields.map((f) => {
            const raw = spec.values?.[f.key];
            let initial = Array.isArray(raw)
              ? raw.join(", ")
              : String(raw ?? "");
            if (f.type === "datetime-local" && initial) {
              const d = new Date(initial);
              initial = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            }
            return (
              <label key={f.key}>
                {f.label}
                {f.type === "checkbox" ? (
                  <input
                    name={f.key}
                    type="checkbox"
                    defaultChecked={raw === true}
                  />
                ) : f.type === "select" ? (
                  <select
                    name={f.key}
                    required={!f.optional}
                    defaultValue={initial}
                  >
                    <option value="">Seleccionar…</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.key}
                    required={!f.optional}
                    defaultValue={initial}
                    maxLength={14000}
                    rows={5}
                  />
                ) : (
                  <input
                    name={f.key}
                    type={f.type === "list" ? "text" : (f.type ?? "text")}
                    required={!f.optional}
                    defaultValue={initial}
                    min={
                      spec.op === "interview.save" &&
                      f.key === "scheduled_at" &&
                      !spec.values?.id
                        ? minimumInterviewTime
                        : (f.min ?? (f.type === "number" ? 0 : undefined))
                    }
                    max={f.max}
                    maxLength={f.type === "password" ? 128 : 500}
                    minLength={f.type === "password" ? 12 : undefined}
                  />
                )}
              </label>
            );
          })}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button disabled={busy}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
export function Upload({
  bucket,
  id,
  onSaved,
  itemId,
  multiple = false,
}: {
  bucket: string;
  id?: string;
  itemId?: string;
  multiple?: boolean;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="upload"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const element = e.currentTarget;
        const form = new FormData(element);
        form.set("bucket", bucket);
        if (id) form.set("id", id);
        if (itemId) form.set("item_id", itemId);
        let saved = 0;
        try {
          const files = form.getAll("file");
          if (files.length > 10)
            throw new Error(
              "Selecciona un máximo de diez archivos por entrega.",
            );
          for (const file of files) {
            form.set("file", file);
            const response = await fetch("/api/files", {
              method: "POST",
              body: form,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            saved++;
          }
          element.reset();
          onSaved();
        } catch (e) {
          setError(
            (saved
              ? `${saved} archivos guardados. Selecciona solamente los pendientes para reintentar. `
              : "") + (e instanceof Error ? e.message : "Error al subir."),
          );
          if (saved) {
            element.reset();
            onSaved();
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Archivos privados · máximo 5 MB por archivo
        <input
          name="file"
          type="file"
          multiple={multiple}
          required
          accept={bucket === "cvs" ? ".pdf,.txt" : ".pdf,.txt,.png,.jpg,.jpeg"}
        />
      </label>
      <button disabled={busy} className="secondary">
        {busy ? "Subiendo…" : multiple ? "Subir archivos" : "Subir archivo"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
