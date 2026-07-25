export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="OBLIX">
      <svg
        className="brand-mark"
        viewBox="0 0 40 40"
        role="img"
        aria-hidden="true"
      >
        <path
          d="M20 3.8 32.8 11v18L20 36.2 7.2 29V11L20 3.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
        />
        <path
          d="m20 3.8 2.5 8.5 10.3-1.3-7.9 7.2 7.9 10.8-10.3-3.1-2.5 10.3-2.5-10.3L7.2 29l7.9-10.8L7.2 11l10.3 1.3L20 3.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity=".75"
        />
      </svg>
      {!compact && <span>OBLIX</span>}
    </div>
  );
}
