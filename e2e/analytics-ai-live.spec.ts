/** Recorrido optativo: cuenta ficticia existente, proveedor real y sin cambios de negocio. */
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
test("compara procesos por área con IA real", async ({ page }) => {
  test.skip(
    process.env.NEXO_AI_LIVE !== "1" ||
      !existsSync(".local/real-flow-fixture.json"),
  );
  test.setTimeout(240000);
  const fixture = JSON.parse(
    readFileSync(".local/real-flow-fixture.json", "utf8"),
  );
  await page.route("**/api/ai/orchestrate", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Resumen automático omitido durante esta prueba." },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(fixture.users.rh.email);
  await page.getByLabel(/^Contraseña/).fill(fixture.password);
  await page.getByRole("button", { name: /^Iniciar sesión/ }).click();
  await expect(page).toHaveURL(/\/rh$/, { timeout: 30000 });
  await page.goto("/rh/analytics");
  await page.getByRole("button", { name: /Análisis con IA/ }).click();
  await expect(
    page.getByRole("button", { name: /Generar recomendaciones IA/ }),
  ).toBeVisible({ timeout: 15000 });
  const result = await page.request.post("/api/ai/orchestrate", {
    headers: { Origin: "http://127.0.0.1:3000" },
    timeout: 210000,
    data: {
      area: "analytics",
      filters: { module: "analytics" },
      mode: "analyze",
      prompt:
        "Compara las tareas, capacitaciones e incorporaciones de las áreas visibles. Para cada proceso, muestra el total y el porcentaje que corresponde a cada área. No confundas cantidades de actividades con cantidades de personas. Explica qué información falta y propone próximos pasos.",
    },
  });
  const body = await result.json();
  console.log(
    JSON.stringify({
      status: result.status(),
      error: body.error,
      summary: body.result?.summary,
    }),
  );
  expect(result.status()).toBe(200);
  expect(body.result.summary.length).toBeGreaterThan(30);
  expect(body.result.summary).not.toMatch(/[0-9]/);
  expect(body.result.summary).toMatch(/tareas/i);
  expect(body.result.summary).toMatch(/incorporaci[oó]n/i);
  expect(body.result.summary).toMatch(/capacitaci[oó]n/i);
  expect(
    body.metrics.map((metric: { process: string }) => metric.process),
  ).toEqual(["Tareas", "Capacitaciones asignadas", "Incorporaciones"]);
  for (const metric of body.metrics) {
    expect(metric.breakdown).toBe("department");
    expect(
      metric.groups.reduce(
        (sum: number, group: { count: number }) => sum + group.count,
        0,
      ),
    ).toBe(metric.total);
  }
  expect(body.result.summary).not.toMatch(
    /vacantes|postulaciones|entrevistas/i,
  );
  // Comprueba que la interfaz presenta la respuesta real recién obtenida, sin repetir llamadas al modelo.
  await page.unroute("**/api/ai/orchestrate");
  await page.route("**/api/ai/orchestrate", (route) =>
    route.fulfill({ status: 200, json: body }),
  );
  await page
    .getByRole("button", { name: "Generar recomendaciones IA" })
    .click();
  await expect(
    page.getByText("Cifras calculadas con los datos filtrados.", {
      exact: false,
    }),
  ).toHaveCount(3);
});
