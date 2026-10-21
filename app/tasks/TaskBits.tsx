import { describeLink, type LinkKind } from "../../lib/links";
import type { TaskConfig } from "../../lib/task-config";
import Avatar from "../components/ui/Avatar";
import { displayName } from "../lib/ui";
import type { Person, TaskLink } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "10 Sep" (adds the year when it differs from `today`'s year). */
export function fmtDay(date: string, today?: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${today && Number(today.slice(0, 4)) !== y ? ` ${y}` : ""}`;
}

export function dateRange(start: string | null, due: string | null, today?: string) {
  if (start && due) return start === due ? fmtDay(due, today) : `${fmtDay(start, today)} – ${fmtDay(due, today)}`;
  if (due) return `Due ${fmtDay(due, today)}`;
  if (start) return `From ${fmtDay(start, today)}`;
  return null;
}

export function StatusPill({ status, config }: { status: string; config: TaskConfig }) {
  const s = config.statuses.find((x) => x.key === status);
  const color = s?.color ?? "var(--text-muted)";
  return (
    <span className="status-pill" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
      <span className="status-pill-dot" style={{ background: color }} />
      {s?.label ?? status}
    </span>
  );
}

export function PointsChip({ points, config }: { points: number | null; config: TaskConfig }) {
  if (points == null) return null;
  const p = config.storyPoints.find((x) => x.value === points);
  return (
    <span className="points-chip" title={p ? `${points} story points · ${p.label}` : `${points} story points`}>
      {points}<span className="sp">SP</span>{p && <b>{p.complexity}</b>}
    </span>
  );
}

/** Stable hue per label so the same label always looks the same. */
function labelHue(label: string) {
  let h = 0;
  for (const c of label.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function LabelChips({ labels, max = 3 }: { labels: string[]; max?: number }) {
  if (!labels.length) return null;
  const shown = labels.slice(0, max);
  return (
    <span className="label-chips">
      {shown.map((l) => (
        <span key={l} className="label-chip" style={{ color: `hsl(${labelHue(l)} 80% 75%)`, background: `hsl(${labelHue(l)} 70% 50% / 0.14)` }}>{l}</span>
      ))}
      {labels.length > max && <span className="label-chip label-more">+{labels.length - max}</span>}
    </span>
  );
}

const KIND_TEXT: Record<LinkKind, string> = { jira: "Jira", gitlab: "GitLab", github: "GitHub", other: "Link" };

export function LinkIcon({ kind }: { kind: LinkKind }) {
  return <span className={`link-kind link-kind-${kind}`} aria-hidden="true">{kind === "jira" ? "J" : kind === "gitlab" ? "GL" : kind === "github" ? "GH" : "↗"}</span>;
}

export function LinkChips({ links }: { links: TaskLink[] }) {
  if (!links.length) return null;
  return (
    <span className="link-chips">
      {links.map((l, i) => {
        const info = describeLink(l.url);
        return (
          <a
            key={`${l.url}-${i}`}
            className="link-chip"
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            title={l.url}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            draggable={false}
          >
            <LinkIcon kind={info.kind} />
            <span>{l.label || info.short}</span>
            <span className="sr-only"> ({KIND_TEXT[info.kind]}, opens in a new tab)</span>
          </a>
        );
      })}
    </span>
  );
}

export function AssigneeChip({ person, compact }: { person: Person | undefined; compact?: boolean }) {
  if (!person) return <span className="assignee-chip unassigned">{compact ? "—" : "Unassigned"}</span>;
  return (
    <span className="assignee-chip" title={displayName(person.name)}>
      <Avatar id={person.id} name={person.name} src={person.avatar} size="sm" />
      {!compact && <span className="assignee-name">{displayName(person.name)}{!person.isActive && " (inactive)"}</span>}
    </span>
  );
}
