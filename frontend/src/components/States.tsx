// Small presentational helpers for the three states every data view needs.

export function Loading() {
  return (
    <p className="state state--loading">
      <span className="spinner" aria-hidden="true" />
      Loading…
    </p>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <p className="state state--error">
      {message}
      {onRetry && (
        <button type="button" className="btn--secondary btn--small" onClick={onRetry}>
          Retry
        </button>
      )}
    </p>
  );
}

export function Empty({ message }: { message: string }) {
  return <p className="state state--empty">{message}</p>;
}
