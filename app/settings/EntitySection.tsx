"use client";

import { useState, useTransition } from "react";
import { deleteSetting, setSettingActive } from "../../lib/settings-actions";
import { keyOf, type SettingRecord } from "../../lib/settings-validation";
import ActionMenu from "../components/ui/ActionMenu";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { EditIcon, PauseIcon, CheckIcon, PlusIcon, TrashIcon } from "../components/ui/Icons";
import EntityDrawer from "./EntityDrawer";
import type { EntityDef } from "./entities";

interface Props {
  def: EntityDef;
  records: SettingRecord[];
  siblings: SettingRecord[];
  usage: Record<string, number>;
  usageNoun: (n: number) => string;
  notify: (kind: "success" | "error", text: string) => void;
}

export default function EntitySection({ def, records, siblings, usage, usageNoun, notify }: Props) {
  const [drawer, setDrawer] = useState<{ record: SettingRecord | null } | null>(null);
  const [deleting, setDeleting] = useState<SettingRecord | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const res = await fn();
      notify(res.ok ? "success" : "error", res.message ?? (res.ok ? "Done" : "Something went wrong."));
    });

  const used = (r: SettingRecord) => usage[keyOf(def.kind, r)] ?? 0;

  return (
    <section className="settings-section" aria-labelledby={`sec-${def.kind}`}>
      <div className="settings-section-head">
        <div>
          <h2 id={`sec-${def.kind}`}>{def.title}</h2>
          <p className="page-subtitle">{def.description}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDrawer({ record: null })}><PlusIcon size={16} /> {def.addLabel}</button>
      </div>

      <div className="table-card">
        {records.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing here yet</h3>
            <p>{def.description}</p>
            <button type="button" className="btn btn-primary" onClick={() => setDrawer({ record: null })}><PlusIcon size={16} /> {def.addLabel}</button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table settings-table" aria-busy={pending || undefined}>
              <thead>
                <tr>
                  {def.columns.map((c) => <th key={c.label} scope="col" className={c.className}>{c.label}</th>)}
                  <th scope="col">In use</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ width: 52 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const n = used(r);
                  const active = r.active !== false;
                  return (
                    <tr key={keyOf(def.kind, r)} className={active ? undefined : "is-inactive"}>
                      {def.columns.map((c) => <td key={c.label} data-label={c.label} className={c.className}>{c.render(r)}</td>)}
                      <td data-label="In use" className={n ? undefined : "muted"}>{n ? usageNoun(n) : "Not used"}</td>
                      <td data-label="Status"><span className={`status ${active ? "status-active" : "status-inactive"}`}>{active ? "Active" : "Inactive"}</span></td>
                      <td className="settings-actions">
                        <ActionMenu
                          label={`Actions for ${def.name(r)}`}
                          items={[
                            { label: "Edit", icon: <EditIcon size={16} />, onSelect: () => setDrawer({ record: r }) },
                            active
                              ? { label: "Deactivate", icon: <PauseIcon size={16} />, onSelect: () => run(() => setSettingActive(def.kind, keyOf(def.kind, r), false)) }
                              : { label: "Activate", icon: <CheckIcon size={16} />, onSelect: () => run(() => setSettingActive(def.kind, keyOf(def.kind, r), true)) },
                            { label: "Delete…", icon: <TrashIcon size={16} />, danger: true, separatorBefore: true, onSelect: () => setDeleting(r) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer && (
        <EntityDrawer
          key={drawer.record ? keyOf(def.kind, drawer.record) : "new"}
          def={def}
          record={drawer.record}
          siblings={siblings}
          onClose={() => setDrawer(null)}
          onSaved={(m) => { setDrawer(null); notify("success", m); }}
        />
      )}

      {deleting && (() => {
        const n = used(deleting);
        return n > 0 ? (
          // In use: offer the safe alternative instead of a destructive action.
          <ConfirmDialog
            title={`Can't delete ${def.name(deleting)}`}
            confirmLabel={deleting.active !== false ? "Deactivate instead" : "OK"}
            onConfirm={() => { const r = deleting; setDeleting(null); if (r.active !== false) run(() => setSettingActive(def.kind, keyOf(def.kind, r), false)); }}
            onCancel={() => setDeleting(null)}
          >
            It&apos;s used by {usageNoun(n)}. Deactivate it to stop it being picked while keeping existing records intact.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog
            title={`Delete ${def.name(deleting)}?`}
            confirmLabel="Delete"
            danger
            onConfirm={() => { const r = deleting; setDeleting(null); run(() => deleteSetting(def.kind, keyOf(def.kind, r))); }}
            onCancel={() => setDeleting(null)}
          >
            This permanently removes it from Settings. Nothing uses it right now. This can&apos;t be undone.
          </ConfirmDialog>
        );
      })()}
    </section>
  );
}
