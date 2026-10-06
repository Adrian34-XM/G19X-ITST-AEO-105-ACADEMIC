/**
 * Recorridos de navegador con registros ficticios preparados por check-real-flows.
 * La confirmación de correo queda fuera: las cuentas de prueba se preparan confirmadas.
 */
import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createCanvas } from "@napi-rs/canvas";
test("acceso responsive y registro", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Qué gusto verte de nuevo" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await page.getByRole("link", { name: "Regístrate" }).click();
  await expect(page.getByLabel("Nombre completo")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
const fixturePath = ".local/real-flow-fixture.json";
type Fixture = {
  label: string;
  password: string;
  users: Record<string, { id: string; email: string }>;
};
function fixture(): Fixture {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}
async function login(page: Page, data: Fixture, role: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(data.users[role].email);
  await page.getByLabel(/^Contraseña/).fill(data.password);
  await page.getByRole("button", { name: /^Iniciar sesión/ }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
}
test("el empleado ve el nombre de su jefe sin acceso a su expediente", async ({
  page,
}) => {
  test.skip(!existsSync(fixturePath), "Requiere cuentas ficticias preparadas.");
  const data = fixture();
  await login(page, data, "employee");
  await page.goto("/employee/profile");
  await expect(page.locator(".profile-hero")).toContainText(
    `Jefe directo: ${data.label} manager`,
  );
  await expect(page.locator(".profile-facts")).toContainText(
    `${data.label} manager`,
  );
  await expect(page.locator(".profile-hero")).not.toContainText(
    "Fuera del alcance visible",
  );
});

test("modo oscuro persistente y acceso al perfil desde el nombre", async ({
  page,
}) => {
  test.skip(!existsSync(fixturePath), "Requiere cuentas ficticias preparadas.");
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("nexo-theme", "light"));
  await login(page, fixture(), "manager");
  const toggle = page.getByRole("button", { name: "Modo oscuro", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Ir a Mi perfil", exact: true }).click();
  await expect(page).toHaveURL(/\/manager\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Mi perfil", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/perfil-modo-oscuro.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toggle).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir a Mi perfil", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("foto de perfil: vista previa y visualización privada en el organigrama", async ({
  page,
}) => {
  test.skip(!existsSync(fixturePath), "Requiere cuentas ficticias preparadas.");
  const data = fixture();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const schema = await db.from("profiles").select("photo_path").limit(0);
  const canvas = createCanvas(256, 256),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "#176b58";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "white";
  ctx.font = "bold 72px sans-serif";
  ctx.fillText("QA", 72, 152);
  await login(page, data, "employee");
  await page.goto("/employee/profile");
  const editor = () =>
    page.getByRole("region", { name: "Foto de perfil", exact: true });
  await editor()
    .getByLabel("Seleccionar foto")
    .setInputFiles({
      name: "foto-ficticia.png",
      mimeType: "image/png",
      buffer: await canvas.encode("png"),
    });
  await expect(
    editor().getByRole("img", { name: "Vista previa de tu nueva foto" }),
  ).toHaveJSProperty("naturalWidth", 256);
  await editor().screenshot({
    path: "test-results/foto-perfil-preview.png",
  });
  await editor()
    .getByRole("button", { name: "Guardar foto", exact: true })
    .click();
  if (schema.error) {
    await expect(editor().getByRole("alert")).toContainText(
      "202610060001_profile_photos.sql",
      { timeout: 20000 },
    );
    test.info().annotations.push({
      type: "limitación",
      description:
        "La vista previa y el aviso se verificaron; guardar y organigrama esperan la migración en Supabase.",
    });
    return;
  }
  await expect(editor().getByRole("status")).toContainText("actualizada");
  await expect(
    editor().getByRole("img", {
      name: `Foto de ${data.label} employee`,
      exact: true,
    }),
  ).toHaveJSProperty("naturalWidth", 512);
  await logout(page);
  await login(page, data, "manager");
  await page.goto("/manager/employees");
  await expect(
    page.locator(".org-person").getByRole("img", {
      name: `Foto de ${data.label} employee`,
      exact: true,
    }),
  ).toHaveJSProperty("naturalWidth", 512);
  await page.screenshot({
    path: "test-results/foto-organigrama.png",
    fullPage: true,
  });
  await logout(page);
  await login(page, data, "outside");
  expect(
    (
      await page.request.get(`/api/profile-photo?id=${data.users.employee.id}`)
    ).status(),
  ).toBe(404);
  await logout(page);
  await login(page, data, "employee");
  await page.goto("/employee/profile");
  await editor().getByRole("button", { name: "Quitar foto" }).click();
  await expect(editor().getByRole("status")).toContainText("eliminada");
  await expect(
    editor().getByRole("img", {
      name: `Foto de ${data.label} employee`,
      exact: true,
    }),
  ).toHaveCount(0);
});
test("asignación, entrega, corrección y aprobación desde la interfaz", async ({
  page,
}) => {
  test.skip(
    !existsSync(fixturePath),
    "Requiere scripts/check-real-flows.mjs y registros ficticios autorizados.",
  );
  const data = fixture(),
    title = `PRUEBA UI entrega ${Date.now()}`;
  await login(page, data, "manager");
  await page.goto("/manager/tasks");
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Asignar tarea a personas" });
  await modal
    .getByLabel("Buscar persona por nombre")
    .fill(data.label + " employee");
  await modal.getByRole("checkbox").check();
  await modal.getByLabel("Título de la tarea").fill(title);
  await modal
    .getByLabel("Descripción y criterios de aceptación")
    .fill("Documenta objetivo, pasos y resultado de la prueba ficticia.");
  await modal.getByLabel("Fecha límite").fill("2027-05-08");
  await modal.getByRole("button", { name: "Confirmar asignación (1)" }).click();
  await expect(modal.getByRole("alert")).toContainText("día hábil de México");
  await modal.getByLabel("Fecha límite").fill("2027-05-10");
  await modal.getByRole("button", { name: "Confirmar asignación (1)" }).click();
  await expect(modal).toBeHidden();
  await logout(page);
  const card = () =>
    page
      .locator("article.task-priority-card")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  const open = async () => {
    const link = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
      .getByRole("link");
    await expect(link).toBeVisible();
    await link.click();
  };
  const upload = async (name: string, text: string) => {
    await card()
      .locator("input[type=file]")
      .setInputFiles({
        name,
        mimeType: "text/plain",
        buffer: Buffer.from(text),
      });
    await card()
      .getByRole("button", { name: "Subir archivo", exact: true })
      .click();
    await expect(card()).toContainText("En revisión");
  };
  await login(page, data, "employee");
  await page.goto("/employee/tasks");
  await open();
  await card().getByRole("button", { name: "Iniciar tarea" }).click();
  await upload(
    "entrega.txt",
    "Objetivo: probar entregas. Pasos: subir archivo. Resultado: archivo recibido. Prueba ficticia.",
  );
  await expect(
    card().getByRole("button", { name: "Aprobar entrega" }),
  ).toHaveCount(0);
  await logout(page);
  await login(page, data, "manager");
  await page.goto("/manager/tasks");
  await page.getByRole("button", { name: /Entregadas por revisar/ }).click();
  await open();
  await card()
    .getByRole("button", { name: "Solicitar corrección", exact: true })
    .click();
  await card()
    .getByLabel("Motivo y correcciones necesarias")
    .fill("Agrega el resultado esperado de la prueba ficticia.");
  await card()
    .getByRole("button", { name: "Enviar correcciones", exact: true })
    .click();
  await logout(page);
  await login(page, data, "employee");
  await page.goto("/employee/tasks");
  await open();
  await expect(card()).toContainText("Agrega el resultado esperado");
  await card().getByRole("button", { name: "Iniciar tarea" }).click();
  await upload(
    "correccion.txt",
    "Objetivo: probar entregas. Pasos: subir. Resultado esperado: archivo recibido. Resultado obtenido: archivo visible. Prueba ficticia.",
  );
  await logout(page);
  await login(page, data, "manager");
  await page.goto("/manager/tasks");
  await page.getByRole("button", { name: /Entregadas por revisar/ }).click();
  await open();
  await card().getByRole("button", { name: "Aprobar entrega" }).click();
  await expect(card()).toContainText("Aprobado");
  await page.screenshot({
    path: "test-results/recorrido-tarea-aprobada.png",
    fullPage: true,
  });
});
test("candidato carga CV, se postula, retira y vuelve a postularse", async ({
  page,
}) => {
  test.skip(
    !existsSync(fixturePath),
    "Requiere registros ficticios preparados.",
  );
  const data = fixture();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const vacancy = await db
    .from("vacancies")
    .select("id,title,status")
    .eq("title", data.label)
    .single();
  expect(vacancy.error).toBeNull();
  expect(vacancy.data?.status).toBe("PUBLISHED");
  const email = `qa-ui-candidate-${Date.now()}@nexo.test`;
  const created = await db.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: "PRUEBA UI candidato" },
  });
  expect(created.error).toBeNull();
  const candidateData = {
    ...data,
    users: { ...data.users, candidate: { id: created.data.user!.id, email } },
  };
  await login(page, candidateData, "candidate");
  await page.goto("/candidate/jobs");
  const vacancyCard = () =>
    page.locator("article").filter({
      has: page.getByRole("heading", { name: data.label, exact: true }),
    });
  await expect(
    page.getByRole("heading", { name: "Falta cargar tu CV" }),
  ).toBeVisible();
  await expect(
    vacancyCard().getByRole("button", { name: /Postularme/ }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Ir a mi perfil y cargar CV" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "cv-ficticio.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Currículum ficticio: TypeScript, dos años de experiencia general.",
    ),
  });
  await page
    .getByRole("button", { name: "Subir archivo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Consultar mi CV" }),
  ).toBeVisible();
  await page.goto("/candidate/jobs");
  await vacancyCard()
    .getByRole("button", { name: /Postularme/ })
    .click();
  await expect(vacancyCard()).toHaveCount(0);
  await page.goto("/candidate/applications");
  await expect(
    page.getByRole("button", { name: /Historial de contratados/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Consultar evaluación de IA", { exact: true }),
  ).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Retirar postulación", exact: true })
    .click();
  await page.getByRole("button", { name: /Historial de retiradas/ }).click();
  await expect(page.locator("article.application-card")).toContainText(
    data.label,
  );
  await page.goto("/candidate/jobs");
  await vacancyCard()
    .getByRole("button", { name: /Postularme/ })
    .click();
  await expect(vacancyCard()).toHaveCount(0);
  await page.goto("/candidate/applications");
  await expect(
    page.getByRole("button", { name: "Retirar postulación", exact: true }),
  ).toBeVisible();
  await page.goto("/candidate");
  await expect(
    page.getByRole("heading", { name: "Resumen de novedades con IA" }),
  ).toHaveCount(0);
  // La cuenta del recorrido API fue contratada: su antigua ruta redirige a empleado.
  await logout(page);
  await login(page, data, "candidate");
  await page.goto("/candidate/applications");
  await expect(page).toHaveURL(/\/employee/);
});

for (const [role, modules] of Object.entries({
  admin: [
    "audit",
    "applications",
    "interviews",
    "positions",
    "departments",
    "employees",
    "analytics",
    "climate",
  ],
  rh: [
    "applications",
    "interviews",
    "onboarding",
    "courses",
    "tasks",
    "performance",
    "analytics",
    "climate",
    "employees",
    "positions",
    "departments",
  ],
  manager: [
    "onboarding",
    "courses",
    "tasks",
    "performance",
    "climate",
    "employees",
    "profile",
  ],
  employee: [
    "onboarding",
    "courses",
    "tasks",
    "performance",
    "climate",
    "profile",
  ],
}))
  test(`navegación y permisos del rol ${role}`, async ({ page }) => {
    test.skip(
      !existsSync(fixturePath),
      "Requiere el recorrido ficticio preparado.",
    );
    const data = fixture();
    await login(page, data, role);
    for (const section of modules) {
      await page.goto(`/${role}/${section}`);
      await expect(
        page.locator("main h1").filter({ hasNotText: "Cargando" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Cargando tu espacio…",
          exact: true,
        }),
      ).toBeHidden();
      await expect(page.locator("main").last()).not.toContainText(
        "No se pudo cargar",
      );
    }
    if (role !== "admin") {
      await page.goto("/admin/audit");
      await expect(page).not.toHaveURL(/\/admin/);
    }
    await page.goto(`/${role}/profile`);
    await expect(
      page.getByText("Resumen de la persona con IA", { exact: true }),
    ).toHaveCount(0);
  });
