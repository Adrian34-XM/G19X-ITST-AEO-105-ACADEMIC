/** Continúa el recorrido ficticio guardado después de una falla de IA; no envía correos. */
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const fixture = JSON.parse(
  await readFile(".local/real-flow-fixture.json", "utf8"),
);
const report = JSON.parse(
  await readFile("docs/RESULTADOS_RECORRIDOS_REALES.json", "utf8"),
);
if (report.label !== fixture.label)
  throw Error("La cuenta de prueba no coincide con el informe.");
const base = "http://127.0.0.1:3000";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const sessions = {};
const results = [];
function checked(name, valid) {
  if (!valid) throw Error(name);
  results.push({ name, ok: true, detail: "" });
  console.log("PASS " + name);
}
async function api(role, path, body, expected = 200) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: base,
      Cookie: sessions[role],
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(180000),
  });
  const value = await response.json().catch(() => ({}));
  if (response.status !== expected)
    throw Error(
      `${path}: esperado ${expected}, recibido ${response.status}: ${value.error || ""}`,
    );
  return value;
}
const cmd = (role, op, payload, status) =>
  api(role, "/api/commands", { op, payload }, status);
async function single(table, field, id, select = "*") {
  const response = await db.from(table).select(select).eq(field, id).single();
  if (response.error) throw Error("Falta la precondición " + table);
  return response.data;
}
try {
  for (const [role, user] of Object.entries(fixture.users)) {
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: fixture.password }),
    });
    if (!response.ok)
      throw Error("Falló el acceso de la cuenta ficticia " + role);
    sessions[role] = response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  }
  const candidate = await single(
    "candidates",
    "profile_id",
    fixture.users.candidate.id,
  );
  const vacancy = await single("vacancies", "title", fixture.label);
  // Corrige únicamente la precondición ficticia ambigua del antiguo recorrido.
  if (vacancy.requirements === "Experiencia de prueba con TypeScript") {
    await cmd("rh", "vacancy.save", {
      id: vacancy.id,
      position_id: vacancy.position_id,
      title: vacancy.title,
      description: vacancy.description,
      requirements:
        "Conocimiento de TypeScript y al menos un año de experiencia general.",
      skills: vacancy.skills,
      experience_required: vacancy.experience_required,
      status: vacancy.status,
    });
    const form = new FormData();
    form.set("bucket", "cvs");
    form.set(
      "file",
      new File(
        [
          "Documento sintético de prueba. Currículum ficticio: declaro dos años desarrollando aplicaciones con TypeScript. Sin información personal.",
        ],
        "cv-ficticio.txt",
        { type: "text/plain" },
      ),
    );
    const response = await fetch(base + "/api/files", {
      method: "POST",
      headers: { Origin: base, Cookie: sessions.candidate },
      body: form,
    });
    checked(
      "CV ficticio describe experiencia profesional explícita",
      response.status === 201,
    );
  }
  const { data: application, error } = await db
    .from("applications")
    .select("id,status")
    .eq("candidate_id", candidate.id)
    .eq("vacancy_id", vacancy.id)
    .single();
  if (error) throw Error("Falta la postulación ficticia.");
  const answer = await api("rh", "/api/ai/recruitment", { id: application.id });
  checked(
    "IA real evalúa postulación",
    Number.isInteger(answer.result.score) && answer.result.summary.length > 0,
  );
  await cmd("candidate", "application.hire", { id: application.id }, 403);
  checked("Candidato no se contrata a sí mismo", true);
  if (application.status === "POSTULADO")
    await cmd("rh", "application.status", {
      id: application.id,
      status: "EN_REVISION",
    });
  if (["POSTULADO", "EN_REVISION"].includes(application.status))
    await cmd("rh", "application.status", {
      id: application.id,
      status: "PRESELECCIONADO",
    });
  const scheduled = new Date();
  scheduled.setUTCDate(scheduled.getUTCDate() + 14);
  while ([0, 6].includes(scheduled.getUTCDay()))
    scheduled.setUTCDate(scheduled.getUTCDate() + 1);
  scheduled.setUTCHours(18, 0, 0, 0);
  const payload = {
    application_id: application.id,
    scheduled_at: scheduled.toISOString(),
    interviewer_id: fixture.users.rh.id,
    notes: "Entrevista ficticia del recorrido",
    status: "SCHEDULED",
  };
  const interview = await cmd("rh", "interview.save", payload);
  await cmd("rh", "interview.save", payload, 409);
  checked("Impide segunda entrevista del mismo candidato", true);
  await cmd("rh", "interview.save", {
    ...payload,
    id: interview.id,
    status: "COMPLETED",
  });
  const position = await single("positions", "id", vacancy.position_id);
  const boss = await single(
    "employees",
    "profile_id",
    fixture.users.manager.id,
  );
  const hired = await cmd("rh", "application.hire", {
    id: application.id,
    department_id: position.department_id,
    position_id: position.id,
    manager_id: boss.id,
  });
  checked(
    "Contratación cambia el rol y asigna jefe y área",
    (await single("profiles", "id", fixture.users.candidate.id)).role ===
      "EMPLEADO" &&
      (await single("employees", "id", hired.id)).manager_id === boss.id,
  );
  checked(
    "Postulación contratada queda en historial",
    (await single("applications", "id", application.id)).status ===
      "CONTRATADO",
  );
  const employee = await single(
    "employees",
    "profile_id",
    fixture.users.employee.id,
  );
  const outside = await single(
    "employees",
    "profile_id",
    fixture.users.outside.id,
  );
  const climate = (role, op, payload, expected) =>
    api(role, "/api/climate", { op, payload }, expected);
  const survey = await climate("manager", "save", {
    title: fixture.label + " continuación",
    description: "Encuesta ficticia",
    questions: [
      "Las instrucciones son claras",
      "Tengo recursos suficientes",
      "La carga es razonable",
    ],
  });
  await climate(
    "manager",
    "publish",
    { id: survey.id, employees: [outside.id] },
    403,
  );
  checked("Jefe no encuesta a personas ajenas", true);
  await climate("manager", "publish", {
    id: survey.id,
    employees: [employee.id],
  });
  await climate("employee", "respond", {
    id: survey.id,
    ratings: [4, 4, 5],
    comment: "Comentario ficticio",
  });
  await climate(
    "employee",
    "respond",
    { id: survey.id, ratings: [4, 4, 5], comment: "" },
    409,
  );
  checked("No permite responder dos veces", true);
  await climate(
    "manager",
    "publish",
    { id: survey.id, employees: [employee.id] },
    422,
  );
  checked("No reasigna una encuesta ya respondida", true);
  await climate("manager", "close", { id: survey.id });
  const aggregates = await api("manager", "/api/climate?survey=" + survey.id);
  checked(
    "Grupo pequeño no expone comentarios ni promedios",
    !aggregates.comments?.length &&
      !aggregates.feedback?.length &&
      !aggregates.averages?.length,
  );
  await climate("manager", "ai.summary", { id: survey.id }, 422);
  checked("IA respeta mínimo anónimo", true);
  for (const role of ["admin", "rh", "manager", "employee"]) {
    const response = await fetch(base + "/" + role, {
      headers: { Cookie: sessions[role] },
      redirect: "manual",
    });
    checked("Pantalla autenticada " + role, response.status === 200);
  }
  checked(
    "RH no entra a auditoría",
    [307, 308].includes(
      (
        await fetch(base + "/admin/audit", {
          headers: { Cookie: sessions.rh },
          redirect: "manual",
        })
      ).status,
    ),
  );
  checked(
    "Superadministrador abre auditoría",
    (
      await fetch(base + "/admin/audit", {
        headers: { Cookie: sessions.admin },
        redirect: "manual",
      })
    ).status === 200,
  );
} catch (error) {
  results.push({ name: "Continuación", ok: false, detail: error.message });
  console.error("DETENIDO:", error.message);
  process.exitCode = 1;
} finally {
  await writeFile(
    "docs/RESULTADOS_RECORRIDOS_REALES.json",
    JSON.stringify(
      {
        ...report,
        date: new Date().toISOString(),
        previous_failures: report.results.filter((item) => !item.ok),
        results: [...report.results.filter((item) => item.ok), ...results],
      },
      null,
      2,
    ),
  );
}
