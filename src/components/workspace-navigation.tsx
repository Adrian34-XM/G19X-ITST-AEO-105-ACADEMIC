"use client";
import Link from "next/link";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  CalendarDays,
  BookOpen,
  CheckSquare,
  ClipboardList,
  ChartNoAxesCombined,
  ShieldCheck,
  Building2,
  ContactRound,
  UserRound,
  HeartHandshake,
  ArrowUpRight,
} from "lucide-react";
import { ModuleBadge } from "./module-badge";
import type { Profile, Snapshot } from "@/modules/workspace/types";

const icons: Record<string, typeof Users> = {
  overview: LayoutDashboard,
  jobs: BriefcaseBusiness,
  vacancies: BriefcaseBusiness,
  applications: ClipboardList,
  interviews: CalendarDays,
  employees: Users,
  onboarding: HeartHandshake,
  courses: BookOpen,
  tasks: CheckSquare,
  performance: ChartNoAxesCombined,
  analytics: ChartNoAxesCombined,
  climate: HeartHandshake,
  audit: ShieldCheck,
  users: ContactRound,
  positions: BriefcaseBusiness,
  departments: Building2,
  profile: UserRound,
};
type Entry = { key: string; label: string; href: string };
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Recibe únicamente las rutas autorizadas por el contenedor; agrupar no amplía permisos. */
export function WorkspaceNavigation({
  entries,
  view,
  query,
  profile,
  data,
  onNavigate,
}: {
  entries: Entry[];
  view: string;
  query: string;
  profile: Profile | null;
  data: Snapshot;
  onNavigate: () => void;
}) {
  const candidate = profile?.role === "CANDIDATO";
  const employee = profile?.role === "EMPLEADO";
  const groups = [
    { label: "Inicio", keys: ["overview"] },
    {
      label: candidate ? "Mi candidatura" : "Reclutamiento",
      keys: ["jobs", "vacancies", "applications", "interviews", "candidates"],
    },
    {
      label: employee ? "Mi trabajo y desarrollo" : "Personas y desarrollo",
      keys: ["employees", "tasks", "onboarding", "courses"],
    },
    {
      label: employee ? "Mi bienestar y progreso" : "Seguimiento",
      keys: ["performance", "analytics", "climate"],
    },
    {
      label: "Administración",
      keys: ["users", "departments", "positions", "audit"],
    },
    { label: "Mi cuenta", keys: ["profile"] },
  ];
  const matches = entries.filter((e) =>
    normalize(e.label).includes(normalize(query)),
  );
  return (
    <nav
      id="workspace-navigation"
      aria-label="Módulos del sistema"
      className="grouped-navigation"
    >
      {groups.map((group) => {
        const items = group.keys.flatMap((key) =>
          matches.filter((e) => e.key === key),
        );
        if (!items.length) return null;
        return (
          <div className="navigation-group" key={group.label}>
            <span className="navigation-group-label">{group.label}</span>
            {items.map((entry) => {
              const Icon = icons[entry.key] ?? ClipboardList;
              return (
                <Link
                  key={entry.key}
                  href={entry.href}
                  aria-current={view === entry.key ? "page" : undefined}
                  className={view === entry.key ? "active" : ""}
                  onClick={onNavigate}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{entry.label}</span>
                  {profile && (
                    <ModuleBadge
                      module={entry.key}
                      data={data}
                      profile={profile}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
      {!matches.length && (
        <p className="navigation-empty" role="status">
          No encontramos ese módulo. Prueba con otro nombre.
        </p>
      )}
    </nav>
  );
}

export function WorkspaceShortcuts({ entries }: { entries: Entry[] }) {
  return (
    <nav className="workspace-shortcuts" aria-label="Accesos rápidos">
      {entries.map((entry) => {
        const Icon = icons[entry.key] ?? ClipboardList;
        return (
          <Link key={entry.key} href={entry.href}>
            <span className="shortcut-icon">
              <Icon size={21} aria-hidden="true" />
            </span>
            <span>{entry.label}</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
