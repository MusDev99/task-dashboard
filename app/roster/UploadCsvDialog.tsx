"use client";

import { useRef, useState, useTransition } from "react";
import { importRoster, type ImportRow, type ImportError } from "../../lib/roster-actions";
import { useFocusTrap } from "../components/ui/useFocusTrap";
import { parseCsv } from "./csv";

interface Props {
  onDone: (message: string) => void;
  onCancel: () => void;
}

export default function UploadCsvDialog({ onDone, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onCancel);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<{ count: number; errors: ImportError[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFile = async (file: File | undefined) => {
    setReport(null); setRows(null); setProblem(null);
    if (!file) return;
    setFileName(file.name);
    const table = parseCsv(await file.text());
    const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    if (idx("date") < 0 || idx("code") < 0 || (idx("email") < 0 && idx("employeeid") < 0)) {
      return setProblem("Header must include date, code and email (or employeeId).");
    }
    const parsed: ImportRow[] = table.slice(1).map((r) => ({
      email: idx("email") >= 0 ? r[idx("email")] : undefined,
      employeeId: idx("employeeid") >= 0 ? r[idx("employeeid")] : undefined,
      date: r[idx("date")] ?? "",
      code: r[idx("code")] ?? "",
    }));
    setRows(parsed);
    start(async () => {
      const res = await importRoster(parsed, false);
      if (res.ok) setReport(res.data);
      else setProblem(res.message ?? "Couldn't check the file.");
    });
  };

  const apply = () =>
    rows &&
    start(async () => {
      const res = await importRoster(rows, true);
      if (res.ok && res.data.errors.length === 0) onDone(`Imported ${res.data.count} roster ${res.data.count === 1 ? "entry" : "entries"}`);
      else if (res.ok) setReport(res.data);
      else setProblem(res.message ?? "Import failed.");
    });

  return (
    <>
      <div className="overlay" style={{ zIndex: 110 }} onClick={pending ? undefined : onCancel} />
      <div ref={ref} className="modal" style={{ zIndex: 120, width: "min(520px, calc(100vw - 2rem))" }} role="dialog" aria-modal="true" aria-labelledby="up-title">
        <h2 id="up-title">Upload CSV</h2>
        <p>Columns: <code>email</code> or <code>employeeId</code>, <code>date</code> (YYYY-MM-DD), <code>code</code>. Existing days are overwritten. Nothing is saved if any row has an error.</p>
        <div className="field" style={{ marginBottom: "1rem" }}>
          <label htmlFor="csv-file">CSV file</label>
          <input id="csv-file" className="input" type="file" accept=".csv,text/csv" style={{ paddingTop: 10 }} onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {problem && <div className="alert alert-danger" role="alert">{problem}</div>}
        {report && (
          <div role="status" style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
            <b>{fileName}</b>: <span style={{ color: "var(--accent-emerald)" }}>{report.count} valid</span>
            {report.errors.length > 0 && <>, <span style={{ color: "var(--danger)" }}>{report.errors.length} with errors</span></>}
            {report.errors.length > 0 && (
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", maxHeight: 140, overflowY: "auto", color: "var(--text-secondary)" }}>
                {report.errors.slice(0, 50).map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
              </ul>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={pending}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={pending || !report || report.errors.length > 0 || report.count === 0} onClick={apply}>
            {pending ? "Working…" : report ? `Import ${report.count} ${report.count === 1 ? "entry" : "entries"}` : "Import"}
          </button>
        </div>
      </div>
    </>
  );
}
