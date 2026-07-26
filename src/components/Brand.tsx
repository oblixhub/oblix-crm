export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} aria-label="OBLIX">
      <img
        className="brand-symbol"
        src="/brand/oblix-symbol.png"
        width="1622"
        height="565"
        alt=""
        aria-hidden="true"
      />
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
