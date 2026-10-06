/** Revisión de navegación y disposición con cuentas ficticias, sin modificar registros. */
import { test, expect as baseExpect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const path = ".local/real-flow-fixture.json";
const expect = baseExpect.configure({ timeout: 20000 });
test("interfaz candidato: candidatura, oportunidades y perfil en móvil", async ({
  page,
}) => {
  test.skip(!existsSync(path), "Requiere cuentas de prueba existentes.");
  const fixture = JSON.parse(readFileSync(path, "utf8"));
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: profiles } = await db
    .from("profiles")
    .select("id")
    .eq("role", "CANDIDATO");
  const { data: accounts } = await db.auth.admin.listUsers({ perPage: 1000 });
  const candidate = accounts?.users.find(
    (u) =>
      u.email?.startsWith("qa-ui-candidate-") &&
      u.email.endsWith("@nexo.test") &&
      profiles?.some((p) => p.id === u.id),
  );
  test.skip(
    !candidate,
    "No hay un candidato ficticio confirmado para esta prueba.",
  );
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(candidate!.email!);
  await page.getByLabel(/^Contraseña/).fill(fixture.password);
  await page.getByRole("button", { name: /^Iniciar sesión/ }).click();
  await expect(page).toHaveURL(/\/candidate$/);
  await expect(
    page.getByRole("navigation", { name: "Accesos rápidos" }).getByRole("link"),
  ).toHaveCount(3);
  await expect(
    page.getByText("Resumen de novedades con IA", { exact: true }),
  ).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Módulos del sistema" });
  for (const moduleName of [
    "Oportunidades abiertas",
    "Postulaciones",
    "Entrevistas",
    "Mi perfil",
  ]) {
    await nav.getByRole("link", { name: new RegExp(`^${moduleName}`) }).click();
    await expect(
      page.getByRole("heading", { name: moduleName, exact: true }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/interfaz-candidato-perfil.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await nav.getByRole("link", { name: /^Postulaciones/ }).click();
  await expect(page.locator(".sidebar")).not.toHaveClass(/visible/);
  await expect(
    page.getByRole("heading", { name: "Postulaciones", exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/interfaz-candidato-movil.png",
    fullPage: true,
  });
});
for (const role of ["admin", "rh", "manager", "employee"]) {
  test(`interfaz ${role}: navegación, filtros y móvil`, async ({ page }) => {
    test.skip(!existsSync(path), "Requiere cuentas de prueba existentes.");
    const fixture = JSON.parse(readFileSync(path, "utf8"));
    // La prueba es de interfaz: evita disparar nuevas solicitudes a modelos locales.
    await page.route("**/api/ai/**", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "IA desactivada en esta prueba visual." },
      }),
    );
    await page.goto("/login");
    await page.evaluate(() => localStorage.setItem("nexo-theme", "light"));
    await page.getByLabel("Correo electrónico").fill(fixture.users[role].email);
    await page.getByLabel(/^Contraseña/).fill(fixture.password);
    await page.getByRole("button", { name: /^Iniciar sesión/ }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
    await expect(
      page
        .getByRole("navigation", { name: "Accesos rápidos" })
        .getByRole("link"),
    ).toHaveCount(3, { timeout: 20000 });
    await expect(page.locator(".navigation-group-label").first()).toHaveText(
      "Inicio",
    );
    if (role === "employee") {
      await expect(page.locator(".kpi-grid")).toContainText(
        "Mis tareas pendientes",
      );
      await expect(page.locator(".kpi-grid")).not.toContainText(
        "Empleados activos",
      );
    }
    await page.screenshot({
      path: `test-results/interfaz-${role}-inicio.png`,
      fullPage: true,
    });
    const nav = page.getByRole("navigation", { name: "Módulos del sistema" });
    for (const moduleName of [
      "Tareas y evidencias",
      "Onboarding",
      "Capacitación",
      "Ambiente laboral",
    ]) {
      await nav
        .getByRole("link", { name: new RegExp(`^${moduleName}`) })
        .click();
      await expect(
        page.getByRole("heading", { name: moduleName, exact: true }).first(),
      ).toBeVisible();
      if (moduleName === "Tareas y evidencias") {
        await expect(page.getByLabel("Buscar registros")).toBeHidden();
        await page.getByRole("button", { name: /^Mostrar filtros/ }).click();
        await expect(page.getByLabel("Buscar registros")).toBeVisible();
        await page.getByRole("button", { name: /^Ocultar filtros/ }).click();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (role === "employee") {
      await nav.getByRole("link", { name: /^Mi perfil/ }).click();
    } else await nav.getByRole("link", { name: /^Equipo/ }).click();
    await expect(
      page
        .getByRole("heading", {
          name: role === "employee" ? "Mi perfil" : "Equipo",
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Modo oscuro", exact: true })
      .click();
    await page.screenshot({
      path: `test-results/interfaz-${role}-oscuro.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Abrir navegación" }).click();
    await expect(page.locator(".sidebar")).toHaveClass(/visible/);
    await nav.getByRole("link", { name: /^Mi perfil/ }).click();
    await expect(page.locator(".sidebar")).not.toHaveClass(/visible/);
    await expect(
      page.getByRole("heading", { name: "Mi perfil", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/interfaz-${role}-movil.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Abrir navegación" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".sidebar")).not.toHaveClass(/visible/);
  });
}

test("catálogos, reclutamiento y reportes: disposición y filtros", async ({
  page,
}) => {
  test.skip(!existsSync(path), "Requiere cuentas de prueba existentes.");
  const fixture = JSON.parse(readFileSync(path, "utf8"));
  await page.route("**/api/ai/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "IA desactivada en esta prueba visual." },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(fixture.users.admin.email);
  await page.getByLabel(/^Contraseña/).fill(fixture.password);
  await page.getByRole("button", { name: /^Iniciar sesión/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const nav = page.getByRole("navigation", { name: "Módulos del sistema" });
  for (const moduleName of [
    "Usuarios",
    "Áreas",
    "Puestos",
    "Vacantes",
    "Postulaciones",
    "Entrevistas",
    "Desempeño",
    "Analíticas",
    "Auditoría",
  ]) {
    await nav.getByRole("link", { name: new RegExp(`^${moduleName}`) }).click();
    await expect(
      page.getByRole("heading", { name: moduleName, exact: true }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    ) {
      await page.screenshot({ path: ".local/interface-extra-mobile.png" });
      console.log(
        "Desbordamiento",
        moduleName,
        await page.evaluate(() =>
          Array.from(document.querySelectorAll("main *, header *"))
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.right > innerWidth + 1;
            })
            .slice(0, 10)
            .map((e) => ({
              tag: e.tagName,
              class: e.className,
              width: Math.round(e.getBoundingClientRect().width),
            })),
        ),
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
});
