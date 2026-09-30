"use client";
/** Expediente navegable con datos autorizados, historial y resumen automático. */
import { useState } from "react";
import Link from "next/link";
import { home, isHR } from "@/lib/permissions";
import { type Snapshot, type Profile, value } from "@/modules/workspace/types";
import { profileRecords } from "@/modules/workspace/profile-records";
import { stateLabel } from "@/modules/workspace/labels";
import { ProfileSummary } from "./profile-summary";
import { ProfileCorrections } from "./profile-corrections";
const sections = {
  general: "Información general",
  onboarding: "Incorporación",
  tasks: "Tareas",
  courses: "Capacitación",
  history: "Historial",
  corrections: "Correcciones",
};
export function EmployeeProfile({
  data,
  profile,
  id,
  ownView = false,
}: {
  data: Snapshot;
  profile: Profile;
  id: string;
  ownView?: boolean;
}) {
  const [section, setSection] = useState<keyof typeof sections>("general");
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [error, setError] = useState("");
  const e = (data.employees ?? []).find(
    (e) => e.id === id && (!ownView || e.profile_id === profile.id),
  );
  if (!e)
    return (
      <section className="panel">
        <h2>Perfil no disponible</h2>
        <p>La persona no existe o no pertenece a tu alcance autorizado.</p>
      </section>
    );
  const own = e.profile_id === profile.id;
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
  const base = home[profile.role];
  const records = profileRecords(data, id, base);
  const select = (next: keyof typeof sections) => {
    setSection(next);
    setStatus("");
    setQuery("");
    setFrom("");
    setTo("");
  };
  const items = records.filter((r) =>
    section === "history" ? r.completed : r.kind === section,
  );
  const visible = items.filter(
    (r) =>
      r.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (!status || r.status === status) &&
      (!from || r.date.slice(0, 10) >= from) &&
      (!to || (!!r.date && r.date.slice(0, 10) <= to)),
  );
  async function download(bucket: string, file: string) {
    setError("");
    try {
      const response = await fetch(
        `/api/files?bucket=${encodeURIComponent(bucket)}&id=${encodeURIComponent(file)}`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo abrir el archivo.");
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo abrir el archivo.",
      );
    }
  }
  return (
    <div className="employee-dossier">
      <Link href={ownView ? base : `${base}/employees`}>
        {ownView ? "← Volver a vista general" : "← Volver al equipo"}
      </Link>
      <header className="panel profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {value(person, "full_name")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <span className="eyebrow">EXPEDIENTE DEL COLABORADOR</span>
          <h2>{value(person, "full_name") || "Colaborador"}</h2>
          <p>
            {value(position, "name") || "Puesto pendiente"} ·{" "}
            {value(department, "name") || "Área pendiente"}
          </p>
          <p>
            Jefe directo:{" "}
            {bossProfile
              ? value(bossProfile, "full_name")
              : e.manager_id
                ? "Fuera del alcance visible"
                : "Sin asignar"}
          </p>
          <small>
            Ingreso: {value(e, "hire_date") || "Sin registrar"} ·{" "}
            {e.status === "ACTIVE" ? "Activo" : "Inactivo"}
          </small>
        </div>
      </header>
      <div className="profile-metrics">
        {[
          {
            label: "Tareas pendientes",
            tab: "tasks" as const,
            count: records.filter(
              (r) =>
                r.kind === "tasks" && !r.completed && r.status !== "SUBMITTED",
            ).length,
          },
          {
            label: "Entregas por revisar",
            tab: "tasks" as const,
            count: records.filter(
              (r) => r.kind === "tasks" && r.status === "SUBMITTED",
            ).length,
          },
          {
            label: "Cursos por completar",
            tab: "courses" as const,
            count: records.filter((r) => r.kind === "courses" && !r.completed)
              .length,
          },
          {
            label: "Incorporación: actividades completadas",
            tab: "onboarding" as const,
            count: records.filter((r) => r.kind === "onboarding" && r.completed)
              .length,
          },
        ].map((m) => (
          <button
            key={m.label}
            className="profile-metric"
            onClick={() => {
              select(m.tab);
              if (m.label === "Entregas por revisar") setStatus("SUBMITTED");
            }}
          >
            <strong>{m.count}</strong>
            <span>{m.label}</span>
            <small>Ver registros →</small>
          </button>
        ))}
      </div>
      {!own && (
        <ProfileSummary
          key={`${profile.id}:${id}`}
          viewer={profile.id}
          employee={id}
          onSection={select}
        />
      )}
      <nav className="profile-tabs" aria-label="Secciones del perfil">
        {Object.entries(sections)
          .filter(([key]) => key !== "corrections" || own || isHR(profile.role))
          .map(([key, label]) => (
            <button
              className={section === key ? "active" : "secondary"}
              aria-pressed={section === key}
              key={key}
              onClick={() => select(key as keyof typeof sections)}
            >
              {label}
              {["tasks", "courses", "onboarding"].includes(key) && (
                <span>
                  {" "}
                  {records.filter((r) => r.kind === key && !r.completed).length}
                </span>
              )}
            </button>
          ))}
      </nav>
      <section className="panel profile-content">
        <h3>{sections[section]}</h3>
        {section === "general" ? (
          <>
            <p>
              {own
                ? "Tu información laboral es de solo consulta. Puedes solicitar una corrección para que RH la revise."
                : "Información disponible según tu rol y relación con esta persona."}
            </p>
            <dl className="profile-facts">
              {[
                ["Puesto", value(position, "name") || "Sin asignar"],
                ["Área", value(department, "name") || "Sin asignar"],
                ["Fecha de ingreso", value(e, "hire_date") || "Sin registrar"],
                ["Estado", e.status === "ACTIVE" ? "Activo" : "Inactivo"],
                [
                  "Jefe directo",
                  bossProfile
                    ? value(bossProfile, "full_name")
                    : "Sin información visible",
                ],
                ...(isHR(profile.role) || own
                  ? [
                      [
                        "Correo de contacto",
                        own ? profile.email : value(person, "email"),
                      ],
                    ]
                  : []),
              ].map(([label, text]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
            <div className="profile-actions">
              {(own || isHR(profile.role)) && (
                <button
                  className="secondary"
                  onClick={() => select("corrections")}
                >
                  {own
                    ? "Solicitar corrección"
                    : "Revisar solicitudes de corrección"}
                </button>
              )}
              {!own && (isHR(profile.role) || profile.role === "JEFE") && (
                <>
                  <Link href={`${base}/tasks`}>Gestionar tareas</Link>
                  <Link href={`${base}/courses`}>Gestionar capacitación</Link>
                  <Link href={`${base}/employees`}>
                    {isHR(profile.role)
                      ? "Gestionar puesto y jerarquía"
                      : "Consultar equipo"}
                  </Link>
                </>
              )}
            </div>
          </>
        ) : section === "corrections" ? (
          <ProfileCorrections
            key={id}
            employee={id}
            own={own}
            hr={isHR(profile.role)}
          />
        ) : (
          <>
            <div className="profile-filters">
              <label>
                Buscar actividad
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nombre de tarea o curso"
                />
              </label>
              <label>
                Estado
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  {[...new Set(items.map((r) => r.status))].map((s) => (
                    <option key={s} value={s}>
                      {stateLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Desde
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            <p>
              {visible.length} registros visibles
              {section === "history"
                ? " · Tareas aprobadas y actividades completadas"
                : ""}
              . Las fechas corresponden a la finalización o última fecha
              registrada disponible.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="profile-records">
              {visible.map((r) => (
                <article className="profile-record" key={`${r.kind}:${r.id}`}>
                  <div>
                    <small>
                      {sections[r.kind]} ·{" "}
                      {r.date ? r.date.slice(0, 10) : "Sin fecha registrada"}
                    </small>
                    <h4>
                      <Link href={r.href}>{r.title || "Actividad"}</Link>
                    </h4>
                    <span className="badge">{stateLabel(r.status)}</span>
                    {r.comment && <p>{r.comment}</p>}
                  </div>
                  <div className="profile-record-actions">
                    <Link href={r.href}>Ver actividad y revisión →</Link>
                    {r.files.map((f, i) => (
                      <button
                        className="secondary"
                        key={f.id}
                        onClick={() => void download(f.bucket, f.id)}
                      >
                        Abrir evidencia {i + 1}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {!visible.length && (
              <p className="profile-empty">
                No hay registros que coincidan con esta sección y sus filtros.
              </p>
            )}
          </>
        )}
      </section>
      <small>
        Información del conjunto autorizado cargado. Los comentarios anónimos de
        ambiente laboral no forman parte del expediente.
      </small>
    </div>
  );
}
