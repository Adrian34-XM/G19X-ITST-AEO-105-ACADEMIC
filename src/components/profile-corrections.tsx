"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "./forms";
import { type Row, value } from "@/modules/workspace/types";
import { stateLabel } from "@/modules/workspace/labels";
export function ProfileCorrections({
  employee,
  own,
  hr,
}: {
  employee: string;
  own: boolean;
  hr: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [field, setField] = useState("full_name"),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(`/api/profile-corrections?employee=${employee}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active) setRows(result.rows);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [employee, revision]);
  async function send(payload: unknown) {
    setBusy(true);
    setError("");
    try {
      await request("/api/profile-corrections", payload);
      setRevision((n) => n + 1);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p>
        Solicita corregir tu nombre o fecha de ingreso. RH debe revisar y
        justificar su decisión. El puesto, área y jefe se gestionan desde el
        equipo; las credenciales de acceso no se modifican aquí.
      </p>
      {error && <p role="alert">{error}</p>}
      {own && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            if (
              await send({
                action: "request",
                employee,
                field,
                value: f.get("value"),
                reason: f.get("reason"),
              })
            )
              form.reset();
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Dato a corregir
              <select value={field} onChange={(e) => setField(e.target.value)}>
                <option value="full_name">Nombre completo</option>
                <option value="hire_date">Fecha de ingreso</option>
              </select>
            </label>
            <label>
              Valor correcto
              <input
                name="value"
                key={field}
                type={field === "hire_date" ? "date" : "text"}
                required
                maxLength={150}
              />
            </label>
            <label>
              Motivo de la corrección
              <textarea name="reason" required maxLength={1000} />
            </label>
            <button>Enviar solicitud a RH</button>
          </fieldset>
        </form>
      )}
      <h4>Solicitudes y respuestas</h4>
      {!rows.length && !error && <p>No hay solicitudes registradas.</p>}
      {rows.map((r) => (
        <article className="profile-record" key={r.id}>
          <div>
            <h4>
              {r.field === "full_name" ? "Nombre completo" : "Fecha de ingreso"}
              : {value(r, "proposed_value")}
            </h4>
            <span>
              {stateLabel(value(r, "status"))} ·{" "}
              {value(r, "created_at").slice(0, 10)}
            </span>
            <p>{value(r, "reason")}</p>
            {!!r.review_comment && (
              <p>
                <strong>Respuesta de RH:</strong> {value(r, "review_comment")}
              </p>
            )}
          </div>
          {hr && !own && r.status === "PENDING" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await send({
                  action: "review",
                  id: r.id,
                  approve: f.get("decision") === "approve",
                  comment: f.get("comment"),
                });
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Decisión
                  <select name="decision">
                    <option value="approve">
                      Aprobar y aplicar corrección
                    </option>
                    <option value="reject">Rechazar solicitud</option>
                  </select>
                </label>
                <label>
                  Respuesta para el colaborador
                  <textarea name="comment" required maxLength={1000} />
                </label>
                <button>Guardar revisión</button>
              </fieldset>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
