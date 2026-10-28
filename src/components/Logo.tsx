export function ChipIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M11 4v5M16 4v5M21 4v5M11 23v5M16 23v5M21 23v5M4 11h5M4 16h5M4 21h5M23 11h5M23 16h5M23 21h5" />
      </g>
      <rect x="9" y="9" width="14" height="14" rx="2.5" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-accent">
      <ChipIcon />
      <span className="font-mono text-[15px] font-bold tracking-[0.18em] text-ink">
        SYNK<span className="text-accent">0</span>S
      </span>
    </span>
  );
}
