"use client";
/**
 * @file Límite de errores de la interfaz con opción de reintentar. Evita exponer al usuario
 * detalles internos de excepciones del servidor.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Límite de errores de la interfaz. Permite intentar recuperar la página sin mostrar detalles internos de la excepción.
 */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center">
      <div className="panel">
        <h1>No pudimos cargar esta página</h1>
        <p>Comprueba tu conexión e inténtalo de nuevo.</p>
        <button onClick={reset}>Reintentar</button>
      </div>
    </main>
  );
}
