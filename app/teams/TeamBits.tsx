"use client";

import type { CSSProperties } from "react";
import ActionMenu from "../components/ui/ActionMenu";
import Avatar from "../components/ui/Avatar";
import { EditIcon, TrashIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import type { TeamPerson, TeamRow } from "./types";

/** Sets the team colour as a CSS variable used by .team-dot / .team-card. */
export const teamColor = (color: string) => ({ "--team-color": color }) as CSSProperties;

/** Colour dot + name (never colour alone). */
export function TeamChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="team-chip" style={teamColor(color)}>
      <span className="team-dot" aria-hidden="true" />
      <span className="team-chip-name">{name}</span>
    </span>
  );
}

export function AvatarStack({ people, max = 5 }: { people: TeamPerson[]; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="avatar-stack" title={people.map((p) => displayName(p.name)).join(", ")}>
      {shown.map((p) => <Avatar key={p.id} id={p.id} name={p.name} src={p.avatar} size="sm" />)}
      {people.length > max && <span className="avatar-stack-more">+{people.length - max}</span>}
      <span className="sr-only">{people.length} member{people.length === 1 ? "" : "s"}</span>
    </span>
  );
}

export function TeamMenu({ team, onEdit, onDelete }: { team: TeamRow; onEdit: () => void; onDelete: () => void }) {
  return (
    <ActionMenu
      label={`Actions for ${team.name}`}
      items={[
        { label: "Edit", icon: <EditIcon size={16} />, onSelect: onEdit },
        { label: "Delete…", icon: <TrashIcon size={16} />, onSelect: onDelete, danger: true, separatorBefore: true },
      ]}
    />
  );
}
