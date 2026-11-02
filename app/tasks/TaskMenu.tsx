"use client";

import ActionMenu, { type MenuItem } from "../components/ui/ActionMenu";
import { EditIcon, PlusIcon, TrashIcon } from "../components/ui/Icons";
import type { TaskConfig } from "../../lib/task-config";
import type { WorkTask } from "./types";

export interface TaskActions {
  onOpen: (id: string) => void;
  onAddSubtask: (parentId: string) => void;
  onStatus: (task: WorkTask, status: string) => void;
  onDelete: (task: WorkTask) => void;
  onToggleDone: (task: WorkTask) => void;
  /** Create / edit / delete (UX only; the server checks again). */
  canEdit: boolean;
  /** Whether this task's status may be changed (members: only tasks assigned to them). */
  canStatus: (task: WorkTask) => boolean;
}

/** Edit / add subtask / move to status / delete. "Move to" is the keyboard + touch alternative to Kanban drag. */
export default function TaskMenu({ task, config, actions }: { task: WorkTask; config: TaskConfig; actions: TaskActions }) {
  const items: MenuItem[] = [
    ...(actions.canEdit ? [{ label: "Edit", icon: <EditIcon size={16} />, onSelect: () => actions.onOpen(task.id) }] : []),
    ...(actions.canEdit && !task.parentId ? [{ label: "Add subtask", icon: <PlusIcon size={16} />, onSelect: () => actions.onAddSubtask(task.id) }] : []),
    ...(!actions.canStatus(task) ? [] : config.statuses
      .filter((s) => s.active && s.key !== task.status)
      .map((s, i) => ({
        label: `Move to ${s.label}`,
        icon: <span className="menu-dot" style={{ background: s.color }} />,
        onSelect: () => actions.onStatus(task, s.key),
        separatorBefore: i === 0 && actions.canEdit,
      }))),
    ...(actions.canEdit ? [{ label: "Delete…", icon: <TrashIcon size={16} />, onSelect: () => actions.onDelete(task), danger: true, separatorBefore: true }] : []),
  ];
  if (items.length === 0) return null;
  return <ActionMenu label={`Actions for ${task.code}`} items={items} />;
}
