/**
 * @file Entrada de páginas públicas y espacios privados. Resuelve la ruta, obtiene identidad y
 * datos de la sesión y entrega el contexto al componente Workspace; los recursos privados no se
 * cargan con la clave administrativa.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Entrada de páginas del sistema. Distingue acceso público, autenticación y áreas privadas, carga el conjunto de datos autorizado y entrega la vista al componente Workspace.
 */
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { db, configured } from "@/lib/supabase/server";
import { authenticate } from "@/lib/auth";
import { home, mayEnter } from "@/lib/permissions";
import { snapshot } from "@/modules/workspace/queries";
import { ownManagerName } from "@/modules/workspace/own-manager";
import { Workspace } from "@/components/workspace";
import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const pathname = "/" + path.join("/");
  if (path[0] === "login" || path[0] === "register")
    return (
      <AuthForm register={path[0] === "register"} configured={configured()} />
    );
  if (!configured())
    return (
      <main className="center">
        <section className="panel setup">
          <span className="eyebrow">NEXO · CONFIGURACIÓN</span>
          <h1>Tu plataforma de talento empieza aquí.</h1>
          <p>
            Configura Supabase para habilitar las vacantes, las cuentas y los
            datos del equipo.
          </p>
          <ol>
            <li>
              Inicia Docker y ejecuta <code>npx supabase start</code>.
            </li>
            <li>
              Copia <code>.env.example</code> a <code>.env.local</code> y
              configura las claves locales.
            </li>
            <li>
              Ejecuta <code>npx supabase db reset</code> y{" "}
              <code>npm run seed</code>.
            </li>
            <li>
              Reinicia <code>npm run dev</code>.
            </li>
          </ol>
          <Link className="button" href="/login">
            Ir al acceso
          </Link>
        </section>
      </main>
    );
  if (path[0] === "jobs") {
    let auth;
    try {
      auth = await authenticate();
    } catch {
      /* Los visitantes pueden consultar vacantes publicadas. */
    }
    if (auth)
      return (
        <Workspace
          key={path.join("/")}
          data={await snapshot(auth.client)}
          path={path}
          profile={auth.profile}
        />
      );
    const client = await db();
    const { data, error } = await client
      .from("vacancies")
      .select("*")
      .eq("status", "PUBLISHED");
    if (error) throw new Error("DATA_UNAVAILABLE");
    return (
      <Workspace
        key={path.join("/")}
        data={{ vacancies: data ?? [] }}
        path={path}
        profile={null}
      />
    );
  }
  if (!path.length) redirect("/login");
  if (!["admin", "rh", "manager", "employee", "candidate"].includes(path[0]))
    notFound();
  let auth;
  try {
    auth = await authenticate();
  } catch {
    redirect("/login");
  }
  if (!mayEnter(auth.profile.role, pathname)) redirect(home[auth.profile.role]);
  if (path[1] === "recommendations") redirect(`${home[auth.profile.role]}/applications`);
  const data = await snapshot(auth.client);
  if (path[1] === "profile")
    data.own_manager_names = await ownManagerName(auth.client);
  return (
    <Workspace
      key={path.join("/")}
      data={data}
      path={path}
      profile={auth.profile}
    />
  );
}
