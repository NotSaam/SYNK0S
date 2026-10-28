import type { Label } from "@/shared/protocol";

export const LABEL_COLORS: Record<Label, string> = {
  feature: "#2BC4B2",
  bug: "#FF6B8A",
  urgente: "#F2B84B",
  idea: "#7C5CFF",
  diseño: "#4C9EFF",
};

export function LabelPill({ label, active = true }: { label: Label; active?: boolean }) {
  const c = LABEL_COLORS[label];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider"
      style={{ color: active ? c : "var(--color-muted)", background: active ? `${c}1f` : "transparent" }}
    >
      <span className="size-1.5 rounded-full" style={{ background: c }} />
      {label}
    </span>
  );
}
