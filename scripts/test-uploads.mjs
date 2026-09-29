/**
 * @file Pruebas de integración de documentos con servicios reales. Puede crear registros y
 * archivos; ejecutar únicamente contra un entorno destinado a pruebas con credenciales apropiadas.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Prueba de integración que inicia sesiones de demostración, sube documentos ficticios y verifica descargas y rechazos. Crea una tarea y conserva archivos para revisión; requiere contraseñas de prueba en variables de entorno.
 */
// Pruebas con la aplicación en ejecución. Crea documentos identificados como pruebas.
// Quien ejecuta debe configurar UPLOAD_EMPLOYEE_PASSWORD y UPLOAD_MANAGER_PASSWORD.
const base = "http://127.0.0.1:3000";
const remote = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const stamp = new Date().toISOString();
let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${detail}`);
  if (!ok) failures++;
}
async function login(email, password) {
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login ${email}: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const auth = await fetch(remote + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await auth.json();
  return { cookie, token: data.access_token, id: data.user.id };
}
async function rows(session, path) {
  const r = await fetch(remote + "/rest/v1/" + path, {
    headers: { apikey: key, Authorization: "Bearer " + session.token },
  });
  if (!r.ok) throw new Error(`Read: ${r.status}`);
  return r.json();
}
async function command(session, op, payload) {
  const r = await fetch(base + "/api/commands", {
    method: "POST",
    headers: {
      Origin: base,
      Cookie: session.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ op, payload }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(`${op}: ${JSON.stringify(b)}`);
  return b;
}
async function upload(session, bucket, id, file, expected, label) {
  const form = new FormData();
  form.set("bucket", bucket);
  if (id) form.set("id", id);
  form.set("file", file);
  const r = await fetch(base + "/api/files", {
    method: "POST",
    headers: { Origin: base, ...(session ? { Cookie: session.cookie } : {}) },
    body: form,
  });
  const b = await r.json();
  check(label, r.status === expected, `${r.status} ${b.error || ""}`);
  return b;
}
async function download(session, bucket, id, expectedBytes) {
  const r = await fetch(base + `/api/files?bucket=${bucket}&id=${id}`, {
    headers: { Cookie: session.cookie },
  });
  const b = await r.json();
  if (!b.url) {
    check("Enlace de descarga", false, r.status);
    return;
  }
  const file = await fetch(b.url);
  const bytes = Buffer.from(await file.arrayBuffer());
  check(
    "Descarga conserva contenido",
    file.ok && bytes.equals(Buffer.from(expectedBytes)),
    file.status,
  );
}
const employee = await login(
  "empleado1@nexo.test",
  process.env.UPLOAD_EMPLOYEE_PASSWORD,
);
const manager = await login(
  "jefe@nexo.test",
  process.env.UPLOAD_MANAGER_PASSWORD,
);
const [person] = await rows(
  employee,
  `employees?select=id&profile_id=eq.${employee.id}`,
);
const [onboarding] = await rows(
  employee,
  `onboarding?select=id&employee_id=eq.${person.id}`,
);
if (!onboarding) throw new Error("Falta onboarding del empleado de prueba");
const txt = new File(
  [`Documento de prueba de subida ${stamp}`],
  "prueba-subida.txt",
  { type: "text/plain" },
);
await upload(
  null,
  "onboarding-documents",
  onboarding.id,
  txt,
  401,
  "Sin sesión",
);
await upload(employee, "cvs", null, txt, 403, "Empleado no puede subir CV");
await upload(
  employee,
  "onboarding-documents",
  onboarding.id,
  new File([""], "vacio.txt", { type: "text/plain" }),
  422,
  "Archivo vacío",
);
await upload(
  employee,
  "onboarding-documents",
  onboarding.id,
  new File(["fake"], "falso.pdf", { type: "application/pdf" }),
  422,
  "PDF falso",
);
await upload(
  employee,
  "onboarding-documents",
  onboarding.id,
  new File(["x"], "archivo.exe", { type: "application/octet-stream" }),
  422,
  "Extensión prohibida",
);
await upload(
  employee,
  "onboarding-documents",
  onboarding.id,
  new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.txt", {
    type: "text/plain",
  }),
  422,
  "Más de 5 MB",
);
await upload(
  manager,
  "onboarding-documents",
  onboarding.id,
  txt,
  403,
  "Jefe no adjunta onboarding ajeno",
);
const doc = await upload(
  employee,
  "onboarding-documents",
  onboarding.id,
  txt,
  201,
  "TXT onboarding",
);
if (doc.id)
  await download(
    employee,
    "onboarding-documents",
    doc.id,
    await txt.arrayBuffer(),
  );
const stream = "BT /F1 12 Tf 50 700 Td (Documento de prueba PDF) Tj ET";
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [i, obj] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf +=
  "xref\n0 6\n0000000000 65535 f \n" +
  offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("") +
  `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
for (const file of [
  new File([pdf], "prueba.pdf", { type: "application/pdf" }),
  new File([png], "prueba.png", { type: "image/png" }),
]) {
  const result = await upload(
    employee,
    "onboarding-documents",
    onboarding.id,
    file,
    201,
    `Documento válido ${file.type}`,
  );
  if (result.id)
    await download(
      employee,
      "onboarding-documents",
      result.id,
      await file.arrayBuffer(),
    );
}
const task = await command(manager, "task.save", {
  title: `Prueba de subida ${stamp}`,
  description: "Tarea creada para verificar documentos, sin datos personales.",
  employee_id: person.id,
  priority: "LOW",
  due_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
});
await command(employee, "task.status", { id: task.id, status: "IN_PROGRESS" });
const evidence = await upload(
  employee,
  "task-evidence",
  task.id,
  txt,
  201,
  "TXT evidencia de tarea",
);
if (evidence.id)
  await download(
    employee,
    "task-evidence",
    evidence.id,
    await txt.arrayBuffer(),
  );
const [saved] = await rows(employee, `tasks?select=status&id=eq.${task.id}`);
check("Tarea pasa a SUBMITTED", saved.status === "SUBMITTED", saved.status);
console.log(
  "Los documentos y la tarea etiquetados como prueba permanecen para revisión.",
);
process.exitCode = failures ? 1 : 0;
