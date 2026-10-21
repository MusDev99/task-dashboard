"use client";

import { describeLink, safeUrl } from "../../lib/links";
import { LinkIcon } from "./TaskBits";
import type { TaskLink } from "./types";

interface Props {
  value: TaskLink[];
  max: number;
  onChange: (links: TaskLink[]) => void;
}

/** Rows of URL + optional label; the kind (Jira / GitLab / GitHub) is detected from the URL. */
export default function LinksEditor({ value, max, onChange }: Props) {
  const set = (i: number, patch: Partial<TaskLink>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="links-editor">
      {value.map((l, i) => {
        const valid = !l.url || !!safeUrl(l.url);
        const info = l.url && valid ? describeLink(l.url) : null;
        return (
          <div key={i} className="links-row">
            <span className="links-kind">{info ? <LinkIcon kind={info.kind} /> : <span className="link-kind link-kind-other" aria-hidden="true">↗</span>}</span>
            <input className="input" type="url" placeholder="https://jira… or merge request URL" aria-label={`Link ${i + 1} URL`} aria-invalid={!valid || undefined} value={l.url} onChange={(e) => set(i, { url: e.target.value })} />
            <input className="input links-label" placeholder={info?.short ?? "Label (optional)"} aria-label={`Link ${i + 1} label`} value={l.label} maxLength={60} onChange={(e) => set(i, { label: e.target.value })} />
            <button type="button" className="icon-btn" aria-label={`Remove link ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
          </div>
        );
      })}
      <button type="button" className="btn" style={{ justifySelf: "start", minHeight: 36 }} disabled={value.length >= max} onClick={() => onChange([...value, { url: "", label: "" }])}>
        + Add link
      </button>
    </div>
  );
}
