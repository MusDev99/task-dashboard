"use client";

import ActionMenu from "../components/ui/ActionMenu";
import { EditIcon, EyeIcon, TrashIcon } from "../components/ui/Icons";
import type { UserRow } from "./types";

export default function RowMenu({ user, onEdit, onDelete }: { user: UserRow; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <ActionMenu
      label={`Actions for ${user.name}`}
      items={[
        ...(onEdit ? [{ label: "Edit", icon: <EditIcon size={16} />, onSelect: onEdit }] : []),
        { label: "View profile", icon: <EyeIcon size={16} />, href: `/users/${user.id}` },
        ...(onDelete ? [{ label: "Delete…", icon: <TrashIcon size={16} />, onSelect: onDelete, danger: true, separatorBefore: true }] : []),
      ]}
    />
  );
}
