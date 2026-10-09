/**
 * @file Recorridos integrados con cuentas y registros identificados como pruebas. Usa servicios
 * reales y puede modificar datos; sus resultados corresponden al entorno y a los casos
 * efectivamente ejecutados.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Integración real con registros aislados. Ejecutar solo con autorización para crear datos de prueba. */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
const base = "http://127.0.0.1:3000";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const stamp = Date.now().toString();
const label = `PRUEBA RECORRIDOS ${stamp}`;
const password = process.env.NEXO_FLOW_PASSWORD || `Prueba!${randomUUID()}`;
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
  if (!ok) throw new Error(name);
}
function data(r) {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function api(s, path, body, expected = 200) {
  const form = body instanceof FormData;
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: base,
      ...(s ? { Cookie: s.cookie } : {}),
      ...(!form && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(90000),
  });
  const b = await r.json().catch(() => ({}));
  if (r.status !== expected)
    throw new Error(
      `${path}: esperado ${expected}, recibido ${r.status} ${b.error || ""}`,
    );
  return b;
}
async function cmd(s, op, payload, expected = 200) {
  return api(s, "/api/commands", { op, payload }, expected);
}
async function login(email) {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok)
    throw new Error("No se pudo iniciar sesión de prueba: " + r.status);
  return {
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
async function row(table, id) {
  return data(await db.from(table).select("*").eq("id", id).single());
}
async function upload(
  s,
  bucket,
  id,
  item,
  content = "Documento sintético de prueba. Sin información personal.",
) {
  const f = new FormData();
  f.set("bucket", bucket);
  if (bucket === "course-evidence") f.set("progress", "100");
  if (id) f.set("id", id);
  if (item) f.set("item_id", item);
  f.set("file", new File([content], `${stamp}.txt`, { type: "text/plain" }));
  return api(s, "/api/files", f, 201);
}
async function download(s, bucket, id) {
  const b = await api(s, `/api/files?bucket=${bucket}&id=${id}`);
  const r = await fetch(b.url);
  check(
    "Descarga privada " + bucket,
    r.ok && (await r.text()).includes("sintético"),
  );
}
const users = {};
try {
  // Precondición del recorrido: cuentas ficticias confirmadas, sin enviar correos.
  // El flujo de invitación/confirmación se verifica por separado.
  const root = data(
    await db.auth.admin.createUser({
      email: `qa-${stamp}-admin@nexo.test`,
      password,
      email_confirm: true,
      user_metadata: { full_name: label + " ADMIN" },
    }),
  ).user;
  data(
    await db.from("profiles").update({ role: "SUPERUSER" }).eq("id", root.id),
  );
  users.admin = { id: root.id, ...(await login(root.email)) };
  check("Login superadministrador", true);
  for (const [key, role] of [
    ["rh", "RH_ADMIN"],
    ["manager", "JEFE"],
    ["employee", "EMPLEADO"],
    ["outside", "EMPLEADO"],
    ["candidate", "CANDIDATO"],
  ]) {
    const email = `qa-${stamp}-${key}@nexo.test`;
    const created = data(
      await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: label + " " + key },
      }),
    ).user;
    await cmd(users.admin, "profile.admin", {
      id: created.id,
      role,
      active: true,
    });
    users[key] = { id: created.id, ...(await login(email)) };
    check("Login de cuenta confirmada " + role, true);
  }
  const dep = await cmd(users.admin, "department.save", { name: label });
  const pos = await cmd(users.admin, "position.save", {
    name: label,
    department_id: dep.id,
  });
  const boss = await cmd(users.rh, "employee.enroll", {
    profile_id: users.manager.id,
    position_id: pos.id,
    manager_id: "",
  });
  const employee = await cmd(users.rh, "employee.enroll", {
    profile_id: users.employee.id,
    position_id: pos.id,
    manager_id: boss.id,
  });
  const outside = await cmd(users.rh, "employee.enroll", {
    profile_id: users.outside.id,
    position_id: pos.id,
    manager_id: "",
  });
  check("RH configura equipo y jefe", true);
  await api(
    users.rh,
    "/api/admin/users",
    {
      email: `qa-denied-${stamp}@nexo.test`,
      password,
      full_name: label,
      role: "RH_ADMIN",
    },
    403,
  );
  check("RH no crea cuentas privilegiadas", true);
  const taskPayload = {
    title: label,
    description: "Validar una entrega sintética",
    employee_id: employee.id,
    priority: "HIGH",
    due_date: "2026-12-01",
  };
  await cmd(
    users.manager,
    "task.save",
    { ...taskPayload, employee_id: outside.id },
    403,
  );
  check("Jefe no asigna fuera de su jerarquía", true);
  const task = await cmd(users.manager, "task.save", taskPayload);
  check("Jefe asigna tarea a subordinado", true);
  await cmd(users.employee, "task.status", {
    id: task.id,
    status: "IN_PROGRESS",
  });
  await upload(users.employee, "task-evidence", task.id);
  check(
    "Evidencia deja tarea pendiente de revisión",
    (await row("tasks", task.id)).status === "SUBMITTED",
  );
  await cmd(
    users.employee,
    "task.status",
    { id: task.id, status: "APPROVED" },
    403,
  );
  check("Colaborador no autoaprueba tarea", true);
  const ev = data(
    await db.from("task_evidence").select("id").eq("task_id", task.id),
  )[0];
  await download(users.manager, "task-evidence", ev.id);
  const evidenceAI = await api(users.manager, "/api/ai/evidence", {
    id: ev.id,
  });
  check("IA real analiza evidencia", !!evidenceAI);
  check(
    "IA no aprueba automáticamente la tarea",
    (await row("tasks", task.id)).status === "SUBMITTED",
  );
  await api(
    users.outside,
    `/api/files?bucket=task-evidence&id=${ev.id}`,
    undefined,
    404,
  );
  check("Archivo inaccesible a otro colaborador", true);
  await cmd(users.manager, "task.status", {
    id: task.id,
    status: "REJECTED",
    comments: "Corregir entrega de prueba",
  });
  await cmd(users.employee, "task.status", {
    id: task.id,
    status: "IN_PROGRESS",
  });
  await upload(users.employee, "task-evidence", task.id);
  await cmd(users.manager, "task.status", {
    id: task.id,
    status: "APPROVED",
    comments: "Entrega de prueba revisada",
  });
  check(
    "Corrección y aprobación por jefe",
    (await row("tasks", task.id)).status === "APPROVED",
  );
  const course = await cmd(users.rh, "course.save", {
    title: label,
    description: "Curso sintético",
    content: "Material de prueba gratuito",
    duration_minutes: 10,
    required: false,
    department_id: dep.id,
    position_id: pos.id,
  });
  const assignment = await cmd(users.rh, "course.assign", {
    id: course.id,
    employee_id: employee.id,
    due_date: "2026-12-01",
  });
  await upload(users.employee, "course-evidence", assignment.id);
  await cmd(users.employee, "course.progress", {
    id: assignment.id,
    progress: 50,
  });
  await cmd(users.employee, "course.progress", {
    id: assignment.id,
    progress: 100,
  });
  check(
    "Curso entregado requiere revisión",
    (await row("course_assignments", assignment.id)).status === "SUBMITTED",
  );
  await cmd(
    users.employee,
    "course.review",
    { id: assignment.id, status: "COMPLETED", comments: "Intento propio" },
    403,
  );
  check("Colaborador no autoaprueba curso", true);
  await cmd(users.rh, "course.review", {
    id: assignment.id,
    status: "COMPLETED",
    comments: "Curso verificado",
  });
  check(
    "RH confirma curso",
    (await row("course_assignments", assignment.id)).status === "COMPLETED",
  );
  const on = (op, payload, expected = 200) =>
    api(users.rh, "/api/onboarding-plans", { op, payload }, expected);
  const plan = await on("plan.start", { employee_id: employee.id });
  await on("plan.apply", {
    id: plan.id,
    start_date: "2026-09-23",
    steps: [
      {
        title: label,
        description: "Adjunta dos archivos ficticios",
        owner_role: "EMPLOYEE",
        days: 7,
        requires_document: true,
      },
    ],
  });
  const item = data(
    await db.from("onboarding_items").select("id").eq("onboarding_id", plan.id),
  )[0];
  await api(
    users.employee,
    "/api/onboarding-plans",
    { op: "item.complete", payload: { id: item.id } },
    422,
  );
  check("Onboarding exige documento solicitado", true);
  await upload(users.employee, "onboarding-documents", plan.id, item.id);
  await upload(users.employee, "onboarding-documents", plan.id, item.id);
  const docs = data(
    await db.from("onboarding_documents").select("id").eq("item_id", item.id),
  );
  check("Actividad admite múltiples documentos", docs.length === 2);
  await api(users.employee, "/api/onboarding-plans", {
    op: "item.complete",
    payload: { id: item.id },
  });
  await on(
    "item.review",
    {
      id: item.id,
      status: "COMPLETED",
      comments: "Intento antes de revisar archivos",
    },
    422,
  );
  check("RH debe revisar documentos antes de aprobar", true);
  for (const doc of docs) {
    await download(users.rh, "onboarding-documents", doc.id);
    await on("document.review", {
      id: doc.id,
      status: "APPROVED",
      comments: "Archivo ficticio verificado",
    });
  }
  await on("item.review", {
    id: item.id,
    status: "COMPLETED",
    comments: "Incorporación verificada",
  });
  check(
    "Onboarding completado tras revisión",
    (await row("onboarding", plan.id)).status === "COMPLETED",
  );
  const vacancy = await cmd(users.rh, "vacancy.save", {
    position_id: pos.id,
    title: label,
    description: "Vacante sintética",
    requirements:
      "Conocimiento de TypeScript y al menos un año de experiencia general.",
    skills: ["TypeScript"],
    experience_required: 1,
    status: "PUBLISHED",
  });
  await cmd(users.candidate, "candidate.save", {
    phone: "",
    skills: ["TypeScript"],
    experience_years: 2,
  });
  await upload(
    users.candidate,
    "cvs",
    undefined,
    undefined,
    "Documento sintético de prueba. Currículum ficticio: declaro dos años desarrollando aplicaciones con TypeScript. Sin información personal.",
  );
  const candidate = data(
    await db
      .from("candidates")
      .select("id")
      .eq("profile_id", users.candidate.id),
  )[0];
  await download(users.rh, "cvs", candidate.id);
  const application = await cmd(users.candidate, "application.create", {
    vacancy_id: vacancy.id,
  });
  check("Candidato sube CV y se postula", true);
  const candidatePage = await fetch(base + "/candidate", {
    headers: { Cookie: users.candidate.cookie },
    redirect: "manual",
  });
  check("Pantalla de candidato accesible", candidatePage.status === 200);
  const deniedCandidate = await fetch(base + "/rh", {
    headers: { Cookie: users.candidate.cookie },
    redirect: "manual",
  });
  check("Candidato no entra a RH", [307, 308].includes(deniedCandidate.status));
  await api(users.rh, "/api/ai/recruitment", { id: application.id });
  check("IA real evalúa postulación", true);
  await cmd(users.candidate, "application.hire", { id: application.id }, 403);
  check("Candidato no se contrata a sí mismo", true);
  await cmd(users.rh, "application.status", {
    id: application.id,
    status: "EN_REVISION",
  });
  await cmd(users.rh, "application.status", {
    id: application.id,
    status: "PRESELECCIONADO",
  });
  const interviewPayload = {
    application_id: application.id,
    scheduled_at: "2026-12-10T15:00:00Z",
    interviewer_id: users.rh.id,
    notes: label,
    status: "SCHEDULED",
  };
  const interview = await cmd(users.rh, "interview.save", interviewPayload);
  await cmd(
    users.rh,
    "interview.save",
    { ...interviewPayload, scheduled_at: "2026-12-11T15:00:00Z" },
    409,
  );
  check("Impide segunda entrevista del mismo candidato", true);
  await cmd(users.rh, "interview.save", {
    ...interviewPayload,
    id: interview.id,
    status: "COMPLETED",
  });
  const hired = await cmd(users.rh, "application.hire", { id: application.id });
  check(
    "Contratación crea empleado y actualiza rol",
    (await row("profiles", users.candidate.id)).role === "EMPLEADO" &&
      !!hired.id,
  );
  check(
    "Postulación queda en historial contratado",
    (await row("applications", application.id)).status === "CONTRATADO",
  );
  const climate = (s, op, payload, expected = 200) =>
    api(s, "/api/climate", { op, payload }, expected);
  const survey = await climate(users.manager, "save", {
    title: label,
    description: "Encuesta sintética",
    questions: [
      "Tengo recursos adecuados",
      "La comunicación es clara",
      "La carga es razonable",
    ],
  });
  await climate(
    users.manager,
    "publish",
    { id: survey.id, employees: [outside.id] },
    403,
  );
  check("Jefe no encuesta a personas ajenas", true);
  await climate(users.manager, "publish", {
    id: survey.id,
    employees: [employee.id],
  });
  check("Encuesta permite un destinatario", true);
  await climate(users.employee, "respond", {
    id: survey.id,
    ratings: [4, 4, 5],
    comment: "Comentario sintético de prueba",
  });
  await climate(
    users.employee,
    "respond",
    { id: survey.id, ratings: [4, 4, 5], comment: "" },
    409,
  );
  check("No permite responder dos veces", true);
  await climate(users.manager, "close", { id: survey.id });
  const aggregate = await api(
    users.manager,
    "/api/climate?survey=" + survey.id,
  );
  check(
    "Grupo pequeño no expone comentarios",
    (aggregate.comments?.length ?? 0) === 0 &&
      (aggregate.feedback?.length ?? 0) === 0 &&
      (aggregate.averages?.length ?? 0) === 0,
  );
  await api(
    users.manager,
    "/api/climate",
    { op: "ai.summary", payload: { id: survey.id } },
    422,
  );
  check("IA respeta mínimo anónimo", true);
  for (const [key, home] of [
    ["admin", "admin"],
    ["rh", "rh"],
    ["manager", "manager"],
    ["employee", "employee"],
  ]) {
    const r = await fetch(base + "/" + home, {
      headers: { Cookie: users[key].cookie },
      redirect: "manual",
    });
    check("Pantalla autenticada " + key, r.status === 200);
  }
  const denied = await fetch(base + "/admin/audit", {
    headers: { Cookie: users.rh.cookie },
    redirect: "manual",
  });
  check("Auditoría bloqueada para RH", [307, 308].includes(denied.status));
  const audit = await fetch(base + "/admin/audit", {
    headers: { Cookie: users.admin.cookie },
    redirect: "manual",
  });
  check("Superadmin abre auditoría", audit.status === 200);
} catch (e) {
  console.error("DETENIDO:", e.message);
  results.push({ name: "Ejecución", ok: false, detail: e.message });
  process.exitCode = 1;
} finally {
  await mkdir(".local", { recursive: true });
  await mkdir("docs", { recursive: true });
  await writeFile(
    ".local/real-flow-fixture.json",
    JSON.stringify({
      label,
      password,
      users: Object.fromEntries(
        Object.entries(users).map(([key, user]) => [
          key,
          { id: user.id, email: `qa-${stamp}-${key}@nexo.test` },
        ]),
      ),
    }),
  );
  await writeFile(
    "docs/RESULTADOS_RECORRIDOS_REALES.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        label,
        users: Object.fromEntries(
          Object.entries(users).map(([k, v]) => [k, v.id]),
        ),
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    "Informe guardado. No contiene contraseñas ni sesiones. Registros de prueba conservados con prefijo " +
      label,
  );
}
