"use client";
/**
 * @file Indicadores de pendientes o registros recientes en la navegación. El significado depende
 * del módulo; no todos son mensajes sin leer ni se descartan automáticamente al visitar la
 * pantalla.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { useEffect, useState } from "react";
import type { Snapshot, Profile } from "@/modules/workspace/types";
/**
 * Calcula señales sobre el conjunto visible. Para clima consulta asignaciones y recibos
 * del usuario; una consulta fallida conserva la distinción entre desconocido y cero.
 */
export function ModuleBadge({
  module,
  data,
  profile,
}: {
  module: string;
  data: Snapshot;
  profile: Profile;
}) {
  const [now] = useState(() => Date.now());
  const [climate, setClimate] = useState<number | null>(null);
  useEffect(() => {
    if (module !== "climate") return;
    let active = true;
    const refresh = () => {
      void fetch("/api/climate", { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((b) => {
          const own = new Set(
            (data.employees ?? [])
              .filter((e) => e.profile_id === profile.id)
              .map((e) => e.id),
          );
          const count = b.surveys.filter(
            (s: { id: string; status: string }) =>
              s.status === "OPEN" &&
              b.assignments.some(
                (a: { survey_id: string; employee_id: string }) =>
                  a.survey_id === s.id && own.has(a.employee_id),
              ) &&
              !b.participation.some(
                (a: { survey_id: string; employee_id: string }) =>
                  a.survey_id === s.id && own.has(a.employee_id),
              ),
          ).length;
          if (active) setClimate(count);
        })
        .catch(() => {
          if (active) setClimate(null);
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("climate-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("climate-updated", refresh);
    };
  }, [module, data, profile.id]);
  let count = 0,
    label = "pendientes";
  const pending = (table: string, done: string[]) =>
    (data[table] ?? []).filter((r) => !done.includes(String(r.status))).length;
  if (module === "applications")
    count = pending("applications", ["CONTRATADO", "RECHAZADO"]);
  else if (module === "tasks")
    count = pending("tasks", ["APPROVED", "CANCELLED"]);
  else if (module === "courses")
    count = pending("course_assignments", ["COMPLETED", "CANCELLED"]);
  else if (module === "onboarding")
    count = pending("onboarding_items", ["COMPLETED"]);
  else if (module === "interviews") {
    count = (data.interviews ?? []).filter(
      (r) => r.status === "SCHEDULED",
    ).length;
    label = "entrevistas agendadas";
  } else if (module === "climate") {
    count = climate ?? 0;
    label = "encuestas por responder";
  } else {
    const tables: Record<string, string> = {
      users: "profiles",
      employees: "employees",
      positions: "positions",
      departments: "departments",
      vacancies: "vacancies",
      jobs: "vacancies",
      audit: "audit_logs",
    };
    if (tables[module]) {
      const since = now - 7 * 86400000;
      count = (data[tables[module]] ?? []).filter((r) => {
        const date = Date.parse(String(r.updated_at ?? r.created_at ?? ""));
        return date >= since && date <= now;
      }).length;
      label = "registros creados o actualizados en los últimos 7 días";
    }
  }
  return count > 0 ? (
    <em title={`${count} ${label}`} aria-label={`${count} ${label}`}>
      {count > 99 ? "99+" : count}
    </em>
  ) : null;
}
