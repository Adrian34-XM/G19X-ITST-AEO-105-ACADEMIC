/**
 * @file Estado visual transitorio durante la carga de rutas. No representa ausencia de datos ni un
 * error de autenticación.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Estado de espera que Next.js muestra mientras prepara una página.
 */
export default function Loading() {
  return (
    <main className="center">
      <div className="panel">
        <span className="eyebrow">NEXO</span>
        <h1>Cargando tu espacio…</h1>
        <p>Estamos consultando tus datos.</p>
      </div>
    </main>
  );
}
