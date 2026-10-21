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
}

/** Edit / add subtask / move to status / delete. "Move to" is the keyboard + touch alternative to Kanban drag. */
export default function TaskMenu({ task, config, actions }: { task: WorkTask; config: TaskConfig; actions: TaskActions }) {
  const items: MenuItem[] = [
    { label: "Edit", icon: <EditIcon size={16} />, onSelect: () => actions.onOpen(task.id) },
    ...(!task.parentId ? [{ label: "Add subtask", icon: <PlusIcon size={16} />, onSelect: () => actions.onAddSubtask(task.id) }] : []),
    ...config.statuses
      .filter((s) => s.active && s.key !== task.status)
      .map((s, i) => ({
        label: `Move to ${s.label}`,
        icon: <span className="menu-dot" style={{ background: s.color }} />,
        onSelect: () => actions.onStatus(task, s.key),
        separatorBefore: i === 0,
      })),
    { label: "Delete…", icon: <TrashIcon size={16} />, onSelect: () => actions.onDelete(task), danger: true, separatorBefore: true },
  ];
  return <ActionMenu label={`Actions for ${task.code}`} items={items} />;
}
