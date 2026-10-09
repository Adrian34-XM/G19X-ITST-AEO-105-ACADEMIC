/** Placeholders sin datos ficticios, compartidos por rutas y consultas asíncronas. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`nexo-skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingStatus({ label }: { label: string }) {
  return (
    <p className="loading-status" role="status" aria-live="polite">
      <span className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {label}
    </p>
  );
}

function TextLines() {
  return (
    <div className="skeleton-lines">
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  );
}

export function ContentSkeleton({
  label = "Cargando información…",
  variant = "text",
}: {
  label?: string;
  variant?: "text" | "cards" | "messages" | "charts";
}) {
  return (
    <div
      className={`content-skeleton content-skeleton-${variant}`}
      aria-busy="true"
    >
      <LoadingStatus label={label} />
      <div className="skeleton-content" aria-hidden="true">
        {variant === "text" ? (
          <TextLines />
        ) : variant === "messages" ? (
          <div className="skeleton-messages">
            {[0, 1, 2].map((n) => (
              <div className="skeleton-message" key={n}>
                <Skeleton className="skeleton-short" />
                <TextLines />
              </div>
            ))}
          </div>
        ) : (
          <div className="skeleton-card-grid">
            {[0, 1, 2].slice(0, variant === "charts" ? 2 : 3).map((n) => (
              <div className="skeleton-card" key={n}>
                <div className="skeleton-card-heading">
                  <Skeleton className="skeleton-avatar" />
                  <Skeleton className="skeleton-title" />
                </div>
                {variant === "charts" ? (
                  <div className="skeleton-chart">
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <Skeleton key={bar} />
                    ))}
                  </div>
                ) : (
                  <TextLines />
                )}
                <Skeleton className="skeleton-action" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="app-layout skeleton-workspace" aria-busy="true">
      <aside className="sidebar skeleton-sidebar" aria-hidden="true">
        <div className="brand">
          nexo<span>.</span>
        </div>
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-search" />
        <div className="skeleton-navigation">
          {Array.from({ length: 8 }, (_, n) => (
            <div key={n}>
              <Skeleton className="skeleton-icon" />
              <Skeleton />
            </div>
          ))}
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar" aria-hidden="true">
          <Skeleton className="skeleton-title" />
          <div className="skeleton-card-heading">
            <Skeleton className="skeleton-short" />
            <Skeleton className="skeleton-avatar" />
          </div>
        </header>
        <main className="content">
          <LoadingStatus label="Cargando tu espacio…" />
          <div className="skeleton-page-heading" aria-hidden="true">
            <Skeleton className="skeleton-page-title" />
            <Skeleton className="skeleton-subtitle" />
          </div>
          <div className="panel skeleton-filters" aria-hidden="true">
            <Skeleton className="skeleton-title" />
            <Skeleton className="skeleton-action" />
          </div>
          <div className="skeleton-metrics" aria-hidden="true">
            {[0, 1, 2, 3].map((n) => (
              <div className="panel" key={n}>
                <Skeleton className="skeleton-icon" />
                <Skeleton className="skeleton-number" />
                <Skeleton />
              </div>
            ))}
          </div>
          <div className="panel skeleton-module" aria-hidden="true">
            <Skeleton className="skeleton-title" />
            <div className="skeleton-tabs">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
            <div className="skeleton-card-grid">
              {[0, 1, 2].map((n) => (
                <div className="skeleton-card" key={n}>
                  <div className="skeleton-card-heading">
                    <Skeleton className="skeleton-avatar" />
                    <Skeleton className="skeleton-title" />
                  </div>
                  <TextLines />
                  <Skeleton className="skeleton-action" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
