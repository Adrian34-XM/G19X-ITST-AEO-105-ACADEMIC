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
