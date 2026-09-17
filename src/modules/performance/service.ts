/**
 * Calcula indicadores deterministas: 60 % de tareas aprobadas y 40 % de cursos completados. Sin registros, cada porcentaje vale cero; el resultado no es una evaluación de IA.
 */
export function performance(
  tasks: { status: string }[],
  courses: { status: string }[],
) {
  const task_completion = tasks.length
    ? (tasks.filter((t) => t.status === "APPROVED").length / tasks.length) * 100
    : 0;
  const course_completion = courses.length
    ? (courses.filter((c) => c.status === "COMPLETED").length /
        courses.length) *
      100
    : 0;
  const overall_score =
    Math.round((task_completion * 0.6 + course_completion * 0.4) * 100) / 100;
  return {
    task_completion,
    course_completion,
    overall_score,
    signal:
      overall_score >= 80 ? "GREEN" : overall_score >= 60 ? "YELLOW" : "RED",
  };
}
