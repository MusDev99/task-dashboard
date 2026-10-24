"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AppSettings } from "../../lib/settings";
import type { EntityKind, SettingRecord } from "../../lib/settings-validation";
import ToastRegion from "../components/ui/Toast";
import { useToasts } from "../components/ui/useToasts";
import { AlertIcon } from "../components/ui/Icons";
import EntitySection from "./EntitySection";
import GeneralForm from "./GeneralForm";
import { ENTITIES, SECTION_LABEL, SECTION_ORDER } from "./entities";

type Section = EntityKind | "general";

interface Props {
  general: AppSettings;
  records: Record<EntityKind, SettingRecord[]>;
  usage: Record<EntityKind, Record<string, number>>;
  loadError: boolean;
}

const usageNoun = (kind: EntityKind) => (n: number) =>
  kind === "shift" || kind === "leave" ? `${n} roster day${n === 1 ? "" : "s"}` : kind === "location" || kind === "role" ? (n === 1 ? "1 person" : `${n} people`) : `${n} task${n === 1 ? "" : "s"}`;

export default function SettingsClient({ general, records, usage, loadError }: Props) {
  const params = useSearchParams();
  const initial = params.get("tab");
  const [section, setSection] = useState<Section>(SECTION_ORDER.includes(initial as Section) ? (initial as Section) : "general");
  const { toasts, notify } = useToasts();

  useEffect(() => {
    window.history.replaceState(null, "", section === "general" ? window.location.pathname : `?tab=${section}`);
  }, [section]);

  const count = (s: Section) => (s === "general" ? null : records[s].length);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operational Settings</h1>
          <p className="page-subtitle">Configure shifts, leave, locations, roles and the task workflow. Changes apply to everyone immediately.</p>
        </div>
      </div>

      {loadError && <div className="alert alert-danger" role="alert"><AlertIcon /> Couldn&apos;t load settings. Showing defaults. Please refresh; if it keeps happening, contact an administrator.</div>}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTION_ORDER.map((s) => (
            <button key={s} type="button" aria-current={section === s ? "page" : undefined} onClick={() => setSection(s)}>
              <span>{SECTION_LABEL[s]}</span>
              {count(s) != null && <span className="seg-count">{count(s)}</span>}
            </button>
          ))}
        </nav>
        <div className="settings-main">
          {section === "general" ? (
            <GeneralForm settings={general} notify={notify} />
          ) : (
            <EntitySection
              key={section}
              def={ENTITIES[section]}
              records={records[section]}
              siblings={section === "shift" || section === "leave" ? [...records.shift, ...records.leave] : records[section]}
              usage={usage[section]}
              usageNoun={usageNoun(section)}
              notify={notify}
            />
          )}
        </div>
      </div>
      <ToastRegion toasts={toasts} />
    </div>
  );
}
