"use client";
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
