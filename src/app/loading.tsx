/**
 * @file Estado visual transitorio durante la carga de rutas. No representa ausencia de datos ni un
 * error de autenticación.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Estado de espera que Next.js muestra mientras prepara una página.
 */
import { ContentSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <main className="center">
      <div className="panel workspace-loading">
        <span className="eyebrow">NEXO</span>
        <ContentSkeleton label="Cargando tu espacio…" />
      </div>
    </main>
  );
}
