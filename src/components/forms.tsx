"use client";
/**
 * @file Renderiza formularios descritos por el módulo de negocio y normaliza sus valores.
 * Centraliza peticiones y errores visibles; el servidor vuelve a validar todo contenido enviado.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
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
  positionDepartments?: { value: string; label: string }[];
  values?: Record<string, unknown>;
};
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function request(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok)
    throw new RequestError(
      result.error || "No se pudo completar la acción.",
      response.status,
      result.code,
    );
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
  const [invitationSent, setInvitationSent] = useState(false);
  const [positionOptions, setPositionOptions] = useState(
    () =>
      spec.fields.find((field) => field.key === "position_id")?.options ?? [],
  );
  const [quickPositionOpen, setQuickPositionOpen] = useState(false);
  const [quickPositionName, setQuickPositionName] = useState("");
  const [quickPositionDepartment, setQuickPositionDepartment] = useState("");
  const [quickPositionBusy, setQuickPositionBusy] = useState(false);
  const [quickPositionMessage, setQuickPositionMessage] = useState("");
  const [positionValue, setPositionValue] = useState(() =>
    String(spec.values?.position_id ?? ""),
  );
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
      if (spec.op === "user.create") setInvitationSent(true);
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function createPosition() {
    setQuickPositionBusy(true);
    setQuickPositionMessage("");
    try {
      const result = await request("/api/commands", {
        op: "position.save",
        payload: {
          name: quickPositionName.trim(),
          department_id: quickPositionDepartment,
        },
      });
      const id = String(
        typeof result === "string"
          ? result
          : (result?.id ?? result?.result?.id ?? ""),
      );
      if (!id)
        throw new Error(
          "El puesto se creó, pero no se recibió su identificador.",
        );
      setPositionOptions((options) => [
        ...options,
        { value: id, label: quickPositionName.trim() },
      ]);
      setPositionValue(id);
      setQuickPositionName("");
      setQuickPositionMessage(
        "Puesto creado y seleccionado. Guarda la vacante para terminar.",
      );
      setQuickPositionOpen(false);
      onSaved();
    } catch (e) {
      setQuickPositionMessage(
        e instanceof Error ? e.message : "No se pudo crear el puesto.",
      );
    } finally {
      setQuickPositionBusy(false);
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
        {spec.op === "user.create" && (
          <p role="status">
            {invitationSent
              ? "Invitación enviada. La persona definirá su contraseña desde el correo."
              : "Enviaremos una invitación para que la persona confirme su correo y defina su contraseña."}
          </p>
        )}
        {invitationSent ? (
          <button onClick={onClose}>Cerrar</button>
        ) : (
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
                    <>
                      <select
                        name={f.key}
                        required={!f.optional}
                        value={
                          f.key === "position_id" && spec.op === "vacancy.save"
                            ? positionValue
                            : undefined
                        }
                        defaultValue={
                          f.key === "position_id" && spec.op === "vacancy.save"
                            ? undefined
                            : initial
                        }
                        onChange={
                          f.key === "position_id" && spec.op === "vacancy.save"
                            ? (event) => setPositionValue(event.target.value)
                            : undefined
                        }
                      >
                        <option value="">Seleccionar…</option>
                        {(f.key === "position_id" && spec.op === "vacancy.save"
                          ? positionOptions
                          : f.options
                        )?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </>
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
            {spec.op === "vacancy.save" && (
              <details
                className="quick-position"
                open={quickPositionOpen}
                onToggle={(event) =>
                  setQuickPositionOpen(event.currentTarget.open)
                }
              >
                <summary>¿No encuentras el puesto? Crear puesto</summary>
                {quickPositionOpen && (
                  <div className="quick-position-fields">
                    <label>
                      Nombre del puesto
                      <input
                        maxLength={100}
                        value={quickPositionName}
                        onChange={(event) =>
                          setQuickPositionName(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Área
                      <select
                        value={quickPositionDepartment}
                        onChange={(event) =>
                          setQuickPositionDepartment(event.target.value)
                        }
                      >
                        <option value="">Seleccionar área…</option>
                        {spec.positionDepartments?.map((department) => (
                          <option
                            key={department.value}
                            value={department.value}
                          >
                            {department.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        quickPositionBusy ||
                        !quickPositionName.trim() ||
                        !quickPositionDepartment
                      }
                      onClick={() => void createPosition()}
                    >
                      {quickPositionBusy ? "Creando…" : "Crear puesto"}
                    </button>
                  </div>
                )}
                {quickPositionMessage && (
                  <p
                    className={
                      quickPositionMessage.startsWith("Puesto creado")
                        ? "success"
                        : "error"
                    }
                    role="status"
                  >
                    {quickPositionMessage}
                  </p>
                )}
              </details>
            )}
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
        )}
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
