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
      list.map((s) => ({ value: s, label: s })),
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
      title: "Crear usuario",
      op: "user.create",
      fields: [
        field("full_name", "Nombre completo"),
        field("email", "Correo", "email"),
        field("password", "Contraseña inicial", "password"),
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
          "Postulación",
          (data.applications ?? [])
            .filter((a) =>
              ["PRESELECCIONADO", "ENTREVISTA"].includes(value(a, "status")),
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
            .filter((p) => p.role === "RH_ADMIN")
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
            employees.filter((e) => e.value !== row?.id),
          ),
          optional: true,
        },
        states("status", "Estado", ["ACTIVE", "INACTIVE"]),
      ],
    },
    courses: {
      title: "Curso",
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
        field("required", "Asignar automáticamente al contratar", "checkbox"),
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
