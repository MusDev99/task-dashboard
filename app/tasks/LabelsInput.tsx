"use client";

import { useState } from "react";
import { LabelChips } from "./TaskBits";

interface Props {
  value: string[];
  suggestions: string[];
  max: number;
  onChange: (labels: string[]) => void;
  invalid?: boolean;
}

/** Chip input: Enter or comma adds, Backspace on empty removes the last label. */
export default function LabelsInput({ value, suggestions, max, onChange, invalid }: Props) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const label = raw.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!label || value.some((v) => v.toLowerCase() === label.toLowerCase()) || value.length >= max) return setDraft("");
    onChange([...value, label]);
    setDraft("");
  };
  return (
    <div className={`labels-input input ${invalid ? "is-invalid" : ""}`}>
      {value.map((l) => (
        <span key={l} className="labels-input-chip">
          <LabelChips labels={[l]} />
          <button type="button" aria-label={`Remove label ${l}`} onClick={() => onChange(value.filter((v) => v !== l))}>×</button>
        </span>
      ))}
      <input
        id="f-labels"
        list="label-suggestions"
        value={draft}
        placeholder={value.length ? "" : "e.g. backend, urgent"}
        aria-label="Add label"
        disabled={value.length >= max}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value.slice(0, -1)) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft); }
          else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
      />
      <datalist id="label-suggestions">
        {suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
