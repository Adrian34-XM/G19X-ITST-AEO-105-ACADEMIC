import { test, expect as baseExpect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
const expect = baseExpect.configure({ timeout: 20000 });
test("paneles en columnas y detalle amplio, con una columna en móvil", async ({
  page,
}) => {
  test.skip(
    !existsSync(".local/real-flow-fixture.json"),
    "Requiere las cuentas ficticias existentes.",
  );
  const fixture = JSON.parse(
    readFileSync(".local/real-flow-fixture.json", "utf8"),
  );
  await page.route("**/api/ai/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "IA desactivada durante la prueba visual." },
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(fixture.users.rh.email);
  await page.getByLabel(/^Contraseña/).fill(fixture.password);
  await page.getByRole("button", { name: /^Iniciar sesión/ }).click();
  await expect(page).toHaveURL(/\/rh$/);
  for (const [section, title] of [
    ["vacancies", "Vacantes"],
    ["tasks", "Tareas y evidencias"],
    ["onboarding", "Onboarding"],
    ["courses", "Capacitación"],
    ["climate", "Ambiente laboral"],
  ]) {
    await page.goto(`/rh/${section}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }).first(),
    ).toBeVisible();
    const grid =
      section === "vacancies"
        ? ".vacancies-layout"
        : section === "tasks"
          ? ".tasks-workspace"
          : section === "onboarding"
            ? ".onboarding-process-list"
            : section === "climate"
              ? ".climate-workspace"
              : ".record-grid";
    await expect(page.locator(grid).first()).toHaveCSS("display", "grid");
    expect(
      await page
        .locator(grid)
        .first()
        .evaluate(
          (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
        ),
    ).toBeGreaterThan(1);
    if (section === "vacancies") {
      await page.locator(".vacancy-assistant > summary").click();
      await expect(page.locator(".vacancy-assistant")).toHaveAttribute(
        "open",
        "",
      );
      const width = await page
        .locator(".vacancy-assistant")
        .evaluate((e) => e.getBoundingClientRect().width);
      const total = await page
        .locator(".vacancies-layout")
        .evaluate((e) => e.getBoundingClientRect().width);
      expect(Math.abs(width - total)).toBeLessThan(2);
      await page.locator(".vacancy-assistant > summary").click();
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/paneles-${section}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});
