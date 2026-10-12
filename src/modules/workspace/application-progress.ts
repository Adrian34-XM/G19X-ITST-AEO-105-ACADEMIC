import type { Row } from "./types";

export const applicationStages = [
  { status: "POSTULADO", label: "Recibida" },
  { status: "EN_REVISION", label: "En revisión" },
  { status: "PRESELECCIONADO", label: "Preselección" },
  { status: "ENTREVISTA", label: "Entrevista" },
  { status: "CONTRATADO", label: "Contratación" },
] as const;
export const applicationProgressCopy: Record<string, string> = {
  POSTULADO:
    "Recibimos tu solicitud. El equipo de selección podrá revisar tu perfil.",
  EN_REVISION: "El equipo de selección está revisando tu postulación.",
  PRESELECCIONADO:
    "Tu perfil fue preseleccionado. Mantente pendiente de los siguientes pasos.",
  ENTREVISTA:
    "Tu postulación está en etapa de entrevista. Consulta tu agenda para ver las citas registradas.",
  CONTRATADO: "El proceso de esta postulación concluyó con una contratación.",
  RECHAZADO:
    "El proceso terminó para esta vacante. Puedes explorar otras oportunidades.",
  RETIRADO: "Retiraste esta postulación. Se conserva en tu historial.",
};
export type ApplicationUpdate = {
  id: string;
  application_id: string;
  previous_status: string | null;
  status: string;
  created_at: string;
  initial: boolean;
};
export type TrackedApplication = {
  id: string;
  vacancy_id: string;
  title: string;
  status: string;
  applied_at: string;
  updated_at: string;
};

/** Proyección de auditoría: solo estados de postulaciones propias, sin actores ni evaluaciones. */
export function ownApplicationUpdates(
  logs: Row[],
  ownIds: Set<string>,
): ApplicationUpdate[] {
  return logs
    .flatMap((log) => {
      const id = String(log.resource_id ?? "");
      if (
        !ownIds.has(id) ||
        log.resource_type !== "applications" ||
        !["INSERT", "UPDATE"].includes(String(log.action))
      )
        return [];
      const metadata = log.metadata as {
        new_status?: unknown;
        previous_status?: unknown;
      } | null;
      const status = String(metadata?.new_status ?? "");
      const previous =
        metadata?.previous_status == null
          ? null
          : String(metadata.previous_status);
      if (
        !Object.hasOwn(applicationProgressCopy, status) ||
        (log.action === "UPDATE" && (!previous || status === previous))
      )
        return [];
      if (previous && !Object.hasOwn(applicationProgressCopy, previous))
        return [];
      const date = String(log.created_at ?? "");
      if (!date || Number.isNaN(Date.parse(date))) return [];
      return [
        {
          id: log.id,
          application_id: id,
          previous_status: previous,
          status,
          created_at: date,
          initial: log.action === "INSERT",
        },
      ];
    })
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
}

/** Una etapa anterior solo se marca registrada si hay evidencia de ese estado. */
export function progressStages(status: string, events: ApplicationUpdate[]) {
  const recorded = new Set(
    events.flatMap((event) => [
      event.status,
      ...(event.previous_status ? [event.previous_status] : []),
    ]),
  );
  return applicationStages.map((stage) => ({
    ...stage,
    current: status === stage.status,
    recorded: recorded.has(stage.status),
  }));
}
