/** Instrucciones y contexto del orquestador; recibe datos previamente autorizados.
 * @see docs/CODIGO.md y docs/MAPA_CODIGO.md.
 */
import type { insightContext, InsightArea } from "@/modules/workspace/insights";
import type { overviewContext } from "@/modules/workspace/overview";
import type { currentWeek } from "@/modules/workspace/current-week";
import type { analyticsFacts } from "@/modules/workspace/analytics-summary";
import type { WorkspaceFilters } from "@/modules/workspace/filters";
import type { Profile, Snapshot } from "@/modules/workspace/types";

export type OrchestrationContext =
  ReturnType<typeof insightContext> | ReturnType<typeof overviewContext>;
export type OperationalMetrics = ReturnType<typeof analyticsFacts>;
export type AnalysisInput = {
  context: OrchestrationContext;
  filters: WorkspaceFilters;
  prompt: string;
};
export type OrchestrationRequest = AnalysisInput & {
  area: InsightArea;
  mode: "analyze" | "prompt";
  profile: Profile;
  authorized: Snapshot;
  selected: Snapshot;
  week?: ReturnType<typeof currentWeek>;
  operationalMetrics: OperationalMetrics | null;
};
