"use client";
import { WorkforceAI } from "./workforce-tools";
import { stateLabel } from "@/modules/workspace/labels";
import Link from "next/link";
import { home, isHR } from "@/lib/permissions";
import { type Snapshot, type Profile, value } from "@/modules/workspace/types";
export function EmployeeProfile({
  data,
  profile,
  id,
}: {
  data: Snapshot;
  profile: Profile;
  id: string;
}) {
  const e = (data.employees ?? []).find((e) => e.id === id);
  if (!e)
    return (
      <section className="panel">
        <h2>Perfil no disponible</h2>
        <p>La persona no existe o no pertenece a tu alcance autorizado.</p>
      </section>
    );
  const person = (data.profiles ?? []).find((p) => p.id === e.profile_id) ?? {
    id: "",
  };
  const position = (data.positions ?? []).find(
    (p) => p.id === e.position_id,
  ) ?? { id: "" };
  const department = (data.departments ?? []).find(
    (d) => d.id === position.department_id,
  ) ?? { id: "" };
  const boss = (data.employees ?? []).find((b) => b.id === e.manager_id);
  const bossProfile = (data.profiles ?? []).find(
    (p) => p.id === boss?.profile_id,
  );
  const tasks = (data.tasks ?? []).filter((t) => t.employee_id === id),
    courses = (data.course_assignments ?? []).filter(
      (c) => c.employee_id === id,
    );
  return (
    <section className="panel employee-profile">
      <Link href={`${home[profile.role]}/employees`}>
        ← Volver al organigrama
      </Link>
      <h2>{value(person, "full_name") || "Integrante"}</h2>
      <dl>
        <dt>Puesto</dt>
        <dd>{value(position, "name")}</dd>
        <dt>Área</dt>
        <dd>{value(department, "name")}</dd>
        <dt>Fecha de ingreso</dt>
        <dd>{value(e, "hire_date") || "Sin dato"}</dd>
        <dt>Estado</dt>
        <dd>{e.status === "ACTIVE" ? "Activo" : "Inactivo"}</dd>
        <dt>Jefe directo</dt>
        <dd>
          {bossProfile
            ? value(bossProfile, "full_name")
            : e.manager_id
              ? "Fuera del alcance visible"
              : "Sin jefe asignado"}
        </dd>
        {isHR(profile.role) && (
          <>
            <dt>Correo de contacto</dt>
            <dd>{value(person, "email")}</dd>
          </>
        )}
      </dl>
      <WorkforceAI mode="profile" employeeId={id} />
      <h3>Seguimiento laboral</h3>
      <p>
        {tasks.length} tareas ·{" "}
        {tasks.filter((t) => t.status === "APPROVED").length} aprobadas ·{" "}
        {courses.length} cursos ·{" "}
        {courses.filter((c) => c.status === "COMPLETED").length} completados
      </p>
      <div className="record-grid">
        <article className="record">
          <h3>Historial de tareas aprobadas</h3>
          {tasks
            .filter((t) => t.status === "APPROVED")
            .map((t) => (
              <p key={t.id}>
                <Link href={`${home[profile.role]}/tasks/${t.id}`}>
                  {value(t, "title")}
                </Link>{" "}
                · {value(t, "comments")}
              </p>
            ))}
          <h3>Tareas activas y entregas por revisar</h3>
          {tasks
            .filter((t) => t.status !== "APPROVED")
            .map((t) => (
              <p key={t.id}>
                <Link href={`${home[profile.role]}/tasks/${t.id}`}>
                  {value(t, "title")}
                </Link>{" "}
                · {stateLabel(value(t, "status"))}
              </p>
            ))}
          {!tasks.length && <p>Sin tareas asignadas.</p>}
        </article>
        <article className="record">
          <h3>Capacitación</h3>
          {courses.map((c) => (
            <p key={c.id}>
              <Link href={`${home[profile.role]}/courses/${c.course_id}`}>
                {value(
                  (data.courses ?? []).find(
                    (row) => row.id === c.course_id,
                  ) ?? { id: "" },
                  "title",
                ) || "Curso"}
              </Link>{" "}
              · {value(c, "progress")}% · {stateLabel(value(c, "status"))}
            </p>
          ))}
          {!courses.length && <p>Sin cursos asignados.</p>}
        </article>
      </div>
    </section>
  );
}
