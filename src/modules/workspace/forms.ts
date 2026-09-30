/**
 * @file Describe formularios por operación, opciones y valores iniciales. La interfaz consume estas
 * definiciones; los contratos Zod y SQL siguen siendo la autoridad para aceptar una escritura.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Define los campos y opciones de edición para cada recurso. Vincula formularios con operaciones conocidas; no otorga permisos ni escribe directamente en la base de datos.
 */
import { stateLabel } from "@/modules/workspace/labels";
import type { FormSpec, Field } from "@/components/forms";
import type { Snapshot, Row } from "./types";
import { value } from "./types";
const field = (
  key: string,
  label: string,
  type: Field["type"] = "text",
): Field => ({ key, label, type });
export function formFor(kind: string, data: Snapshot, row?: Row): FormSpec {
  const options = (table: string, key = "name") =>
    (data[table] ?? []).map((r) => ({
      value: r.id,
      label: value(r, key) || r.id.slice(0, 8),
    }));
  const names = (id: string) =>
    value(
      (data.profiles ?? []).find((p) => p.id === id) ?? { id },
      "full_name",
    );
  const employees = (data.employees ?? []).map((e) => ({
    value: e.id,
    label: names(value(e, "profile_id")),
  }));
  const select = (
    key: string,
    label: string,
    opts: { value: string; label: string }[],
  ): Field => ({ key, label, type: "select", options: opts });
  const states = (key: string, label: string, list: string[]) =>
    select(
      key,
      label,
      list.map((s) => ({ value: s, label: stateLabel(s) })),
    );
  const bookedCandidates = new Set(
    (data.interviews ?? [])
      .filter((i) => i.status === "SCHEDULED" && i.id !== row?.id)
      .map(
        (i) =>
          (data.applications ?? []).find((a) => a.id === i.application_id)
            ?.candidate_id,
      ),
  );
  const specs: Record<string, Omit<FormSpec, "values">> = {
    departments: {
      title: "Área",
      op: "department.save",
      fields: [field("name", "Nombre del área")],
    },
    positions: {
      title: "Puesto",
      op: "position.save",
      fields: [
        field("name", "Nombre del puesto"),
        select("department_id", "Área", options("departments")),
      ],
    },
    profiles: {
      title: "Administrar acceso",
      op: "profile.admin",
      fields: [
        states("role", "Rol", [
          "SUPERUSER",
          "RH_ADMIN",
          "JEFE",
          "EMPLEADO",
          "CANDIDATO",
        ]),
        field("active", "Cuenta activa", "checkbox"),
      ],
    },
    users: {
      title: "Invitar usuario por correo",
      op: "user.create",
      fields: [
        field("full_name", "Nombre completo"),
        field("email", "Correo", "email"),
        states("role", "Rol", [
          "SUPERUSER",
          "RH_ADMIN",
          "JEFE",
          "EMPLEADO",
          "CANDIDATO",
        ]),
      ],
    },
    candidates: {
      title: "Perfil profesional",
      op: "candidate.save",
      fields: [
        { ...field("phone", "Teléfono"), optional: true },
        field("skills", "Habilidades separadas por comas", "list"),
        {
          ...field("experience_years", "Años de experiencia", "number"),
          max: 80,
        },
      ],
    },
    vacancies: {
      title: row ? "Editar vacante" : "Nueva vacante",
      op: "vacancy.save",
      fields: [
        field("title", "Título"),
        select("position_id", "Puesto", options("positions")),
        field("description", "Descripción", "textarea"),
        field("requirements", "Requisitos", "textarea"),
        field("skills", "Habilidades separadas por comas", "list"),
        {
          ...field(
            "experience_required",
            "Años de experiencia requeridos",
            "number",
          ),
          max: 80,
        },
        states("status", "Estado", ["DRAFT", "PUBLISHED", "CLOSED"]),
      ],
    },
    interviews: {
      title: "Entrevista",
      op: "interview.save",
      fields: [
        select(
          "application_id",
          "Candidato y vacante",
          (data.applications ?? [])
            .filter(
              (a) =>
                ["PRESELECCIONADO", "ENTREVISTA"].includes(
                  value(a, "status"),
                ) && !bookedCandidates.has(a.candidate_id),
            )
            .map((a) => ({
              value: a.id,
              label:
                names(
                  value(
                    (data.candidates ?? []).find(
                      (c) => c.id === a.candidate_id,
                    ) ?? { id: "" },
                    "profile_id",
                  ),
                ) +
                " · " +
                value(
                  (data.vacancies ?? []).find((v) => v.id === a.vacancy_id) ?? {
                    id: "",
                  },
                  "title",
                ),
            })),
        ),
        field("scheduled_at", "Fecha y hora local", "datetime-local"),
        select(
          "interviewer_id",
          "Entrevistador",
          (data.profiles ?? [])
            .filter(
              (p) =>
                p.active &&
                ["RH_ADMIN", "SUPERUSER"].includes(value(p, "role")),
            )
            .map((p) => ({ value: p.id, label: value(p, "full_name") })),
        ),
        { ...field("notes", "Notas", "textarea"), optional: true },
        states("status", "Estado", ["SCHEDULED", "COMPLETED", "CANCELLED"]),
      ],
    },
    employees: {
      title: "Datos del empleado",
      op: "employee.save",
      fields: [
        select("position_id", "Puesto", options("positions")),
        {
          ...select(
            "manager_id",
            "Jefe directo",
            employees.filter((option) => {
              const e = (data.employees ?? []).find(
                (e) => e.id === option.value,
              );
              const p = (data.profiles ?? []).find(
                (p) => p.id === e?.profile_id,
              );
              return (
                option.value !== row?.id &&
                e?.status === "ACTIVE" &&
                p?.active &&
                ["JEFE", "RH_ADMIN"].includes(value(p, "role"))
              );
            }),
          ),
          optional: true,
        },
        states("status", "Estado", ["ACTIVE", "INACTIVE"]),
      ],
    },
    courses: {
      title: "Plantilla de capacitación",
      op: "course.save",
      fields: [
        field("title", "Título"),
        field("description", "Descripción", "textarea"),
        field("content", "Contenido del curso", "textarea"),
        {
          ...field("duration_minutes", "Duración en minutos", "number"),
          min: 1,
          max: 10000,
        },
        {
          ...select(
            "department_id",
            "Área de la plantilla",
            options("departments"),
          ),
          optional: true,
        },
        {
          ...select(
            "position_id",
            "Puesto de la plantilla",
            options("positions"),
          ),
          optional: true,
        },
        field(
          "required",
          "Asignar automáticamente al contratar en este ámbito",
          "checkbox",
        ),
      ],
    },
    assignment: {
      title: "Asignar curso",
      op: "course.assign",
      fields: [
        select("employee_id", "Empleado", employees),
        field("due_date", "Fecha límite", "date"),
      ],
    },
    tasks: {
      title: "Tarea",
      op: "task.save",
      fields: [
        field("title", "Título"),
        field(
          "description",
          "Descripción y criterios de aceptación",
          "textarea",
        ),
        select("employee_id", "Empleado", employees),
        field("due_date", "Fecha límite", "date"),
        states("priority", "Prioridad", ["LOW", "MEDIUM", "HIGH"]),
      ],
    },
  };
  const spec = specs[kind];
  if (!spec) throw new Error("UNKNOWN_FORM");
  const defaults: Record<string, unknown> = {
    status:
      kind === "interviews"
        ? "SCHEDULED"
        : kind === "employees"
          ? "ACTIVE"
          : "DRAFT",
    priority: "MEDIUM",
    experience_years: 0,
    experience_required: 0,
    duration_minutes: 30,
    active: true,
  };
  const values = { ...defaults, ...row };
  if (kind === "candidates") delete values.id;
  return { ...spec, values };
}
