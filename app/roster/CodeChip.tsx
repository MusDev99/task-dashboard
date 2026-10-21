import type { ShiftCode } from "../../lib/shifts";

/** Code label with a tinted background; text always shows the code so colour is never the only cue. */
export default function CodeChip({ def, code }: { def?: ShiftCode; code: string }) {
  const color = def?.color ?? "#8b8da3";
  return (
    <span
      className="code-chip"
      style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)`, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
      title={def ? `${def.label}${def.hours ? ` · ${def.hours}h` : ""}` : code}
    >
      {code}
    </span>
  );
}
