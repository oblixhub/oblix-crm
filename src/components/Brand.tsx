export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} aria-label="OBLIX">
      <span className="brand-symbol-frame" aria-hidden="true">
        <img
          className="brand-symbol"
          src="/brand/oblix-symbol-xx.svg"
          width="96"
          height="48"
          alt=""
        />
      </span>
      {!compact && (
        <img
          className="brand-wordmark"
          src="/brand/oblix-wordmark.png"
          width="1918"
          height="313"
          alt=""
          aria-hidden="true"
        />
      )}
    </div>
  );
}
