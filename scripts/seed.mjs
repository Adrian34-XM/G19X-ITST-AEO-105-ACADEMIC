/**
 * Carga usuarios y escenarios de demostración con acceso administrativo. Requiere configuración explícita para usar un proyecto remoto; no debe ejecutarse sobre datos reales como si fuera una migración.
 */
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  !url ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.DEMO_PASSWORD ||
  process.env.DEMO_PASSWORD.length < 12
)
  throw new Error(
    "Configura Supabase y DEMO_PASSWORD de al menos 12 caracteres en .env.local.",
  );
if (
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname) &&
  process.env.ALLOW_REMOTE_DEMO !== "true"
)
  throw new Error(
    "Seed limitado a Supabase local. Para un proyecto de demostración remoto configura ALLOW_REMOTE_DEMO=true.",
  );
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const check = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
const accounts = [
  ["admin", "SUPERUSER", "Administración Nexo"],
  ["rh", "RH_ADMIN", "Mariana Torres"],
  ["jefe", "JEFE", "Diego Herrera"],
  ...Array.from({ length: 5 }, (_, i) => [
    "empleado" + (i + 1),
    "EMPLEADO",
    [
      "Lucía Martínez",
      "Carlos Ruiz",
      "Valeria Soto",
      "Mateo López",
      "Ana García",
    ][i],
  ]),
  ...Array.from({ length: 5 }, (_, i) => [
    "candidato" + (i + 1),
    "CANDIDATO",
    [
      "Sofía Ramírez",
      "Daniel Pérez",
      "Paula Cruz",
      "Andrés Díaz",
      "Elena Ramos",
    ][i],
  ]),
];
const existing = check(await db.auth.admin.listUsers({ perPage: 1000 })).users;
if (existing.some((u) => accounts.some((a) => u.email === a[0] + "@nexo.test")))
  throw new Error(
    "Ya existen cuentas demo. No se modificaron datos. Usa una base local nueva para repetir el seed.",
  );
const users = {};
for (const [name, role, full_name] of accounts) {
  const email = name + "@nexo.test";
  let user = existing.find((u) => u.email === email);
  if (!user)
    user = check(
      await db.auth.admin.createUser({
        email,
        password: process.env.DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name },
      }),
    ).user;
  users[name] = user.id;
  check(
    await db.from("profiles").update({ role, active: true }).eq("id", user.id),
  );
  if (role !== "CANDIDATO")
    check(await db.from("candidates").delete().eq("profile_id", user.id));
}
const positions = check(await db.from("positions").select("*"));
if (!positions.length)
  throw new Error("Ejecuta supabase db reset antes del seed.");
const manager = check(
  await db
    .from("employees")
    .upsert(
      {
        profile_id: users.jefe,
        position_id: positions.find((p) => p.name === "Líder de ingeniería").id,
      },
      { onConflict: "profile_id" },
    )
    .select()
    .single(),
);
for (let n = 1; n <= 5; n++) {
  const employee = check(
    await db
      .from("employees")
      .upsert(
        {
          profile_id: users["empleado" + n],
          position_id: positions[(n - 1) % positions.length].id,
          manager_id: manager.id,
        },
        { onConflict: "profile_id" },
      )
      .select()
      .single(),
  );
  const onboarding = check(
    await db
      .from("onboarding")
      .upsert({ employee_id: employee.id }, { onConflict: "employee_id" })
      .select()
      .single(),
  );
  if (
    !check(
      await db
        .from("onboarding_items")
        .select("id")
        .eq("onboarding_id", onboarding.id),
    ).length
  )
    check(
      await db.from("onboarding_items").insert(
        [
          "Entregar documentos",
          "Conocer al equipo",
          "Leer reglamento",
          "Configurar herramientas",
        ].map((title) => ({
          onboarding_id: onboarding.id,
          title,
          due_date: "2026-12-01",
        })),
      ),
    );
  const courses = check(await db.from("courses").select());
  for (const c of courses)
    check(
      await db.from("course_assignments").upsert(
        {
          employee_id: employee.id,
          course_id: c.id,
          progress: n <= 2 ? 100 : 25,
          status: n <= 2 ? "COMPLETED" : "IN_PROGRESS",
          due_date: "2026-12-15",
        },
        { onConflict: "course_id,employee_id" },
      ),
    );
  if (
    !check(await db.from("tasks").select("id").eq("employee_id", employee.id))
      .length
  ) {
    for (let t = 1; t <= 2; t++) {
      const task = check(
        await db
          .from("tasks")
          .insert({
            employee_id: employee.id,
            created_by: users.rh,
            title:
              t === 1
                ? "Documentar proceso de trabajo"
                : "Completar entrega de inducción",
            description:
              "Describe los pasos realizados, los resultados obtenidos y las verificaciones aplicadas.",
            due_date: "2026-12-01",
            status: "SUBMITTED",
            priority: n % 2 ? "HIGH" : "MEDIUM",
          })
          .select()
          .single(),
      );
      const file_path = `${employee.profile_id}/${crypto.randomUUID()}.txt`;
      const text =
        "Evidencia de demostración: configuré las herramientas, documenté el proceso y revisé el resultado con el equipo.";
      check(
        await db.storage
          .from("task-evidence")
          .upload(file_path, text, { contentType: "text/plain" }),
      );
      check(
        await db.from("task_evidence").insert({
          task_id: task.id,
          employee_id: employee.id,
          file_path,
          evidence_text: text,
        }),
      );
    }
  }
}
let vacancies = check(await db.from("vacancies").select());
if (!vacancies.length)
  vacancies = check(
    await db
      .from("vacancies")
      .insert(
        [
          "Desarrollador Full Stack",
          "Diseñador de producto",
          "Analista de operaciones",
        ].map((title, i) => ({
          title,
          position_id: positions[i].id,
          description:
            "Construye soluciones que mejoren la experiencia de nuestro equipo.",
          requirements:
            "Comunicación clara, experiencia relevante y trabajo colaborativo.",
          skills: ["React", "PostgreSQL", "Comunicación"],
          experience_required: 2,
          status: "PUBLISHED",
          created_by: users.rh,
        })),
      )
      .select(),
  );
for (let n = 1; n <= 5; n++) {
  const c = check(
    await db
      .from("candidates")
      .update({ skills: ["React", "TypeScript"], experience_years: 3 })
      .eq("profile_id", users["candidato" + n])
      .select()
      .single(),
  );
  if (!c.cv_path) {
    const cv_path = `${c.profile_id}/${crypto.randomUUID()}.txt`;
    const cv_text =
      "Experiencia profesional: tres años construyendo aplicaciones React y TypeScript, pruebas automatizadas y colaboración en equipos de producto. Conocimientos básicos de PostgreSQL.";
    check(
      await db.storage
        .from("cvs")
        .upload(cv_path, cv_text, { contentType: "text/plain" }),
    );
    check(
      await db.from("candidates").update({ cv_path, cv_text }).eq("id", c.id),
    );
  }
  const application = check(
    await db
      .from("applications")
      .upsert(
        {
          candidate_id: c.id,
          vacancy_id: vacancies[(n - 1) % vacancies.length].id,
          status: n >= 4 ? "ENTREVISTA" : "POSTULADO",
        },
        { onConflict: "candidate_id,vacancy_id" },
      )
      .select()
      .single(),
  );
  if (
    n >= 4 &&
    !check(
      await db
        .from("interviews")
        .select("id")
        .eq("application_id", application.id),
    ).length
  )
    check(
      await db.from("interviews").insert({
        application_id: application.id,
        interviewer_id: users.rh,
        created_by: users.rh,
        scheduled_at: `2026-12-0${n}T16:00:00Z`,
        notes: "Conversación sobre experiencia y expectativas.",
      }),
    );
}
if (!check(await db.from("surveys").select("id")).length)
  check(
    await db.from("surveys").insert([
      {
        title: "Pulso del equipo",
        description: "Encuesta reservada para P1",
        created_by: users.rh,
      },
      {
        title: "Experiencia de onboarding",
        description: "Encuesta reservada para P1",
        created_by: users.rh,
      },
    ]),
  );
console.log(
  "Seed completado. Usuarios: " +
    accounts.map((a) => a[0] + "@nexo.test").join(", "),
);
console.log(
  "La contraseña es el valor de DEMO_PASSWORD. No se imprime ni se guarda en el repositorio.",
);
