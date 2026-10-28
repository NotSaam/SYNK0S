import { initials } from "@/lib/identity";

export function Avatar({ name, color, size = 28, ring }: { name: string; color: string; size?: number; ring?: boolean }) {
  return (
    <span
      title={name}
      className="inline-grid shrink-0 place-items-center rounded-full font-mono font-bold text-void"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: color,
        boxShadow: ring ? `0 0 0 2px var(--color-surface)` : undefined,
      }}
    >
      {initials(name)}
    </span>
  );
}
