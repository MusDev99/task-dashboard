"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { deleteTeam } from "../../lib/team-actions";
import TeamTable, { type Sort, type SortKey } from "./TeamTable";
import TeamGrid from "./TeamGrid";
import TeamDrawer from "./TeamDrawer";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination, { PAGE_SIZES } from "../components/ui/Pagination";
import ToastRegion from "../components/ui/Toast";
import { useToasts } from "../components/ui/useToasts";
import { SearchIcon, PlusIcon, TableIcon, GridIcon, UsersIcon, AlertIcon, UserCheckIcon, UserXIcon, SparkIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import type { TeamPerson, TeamRow } from "./types";
import StatCard from "../components/ui/StatCard";

type View = "table" | "grid";

const oneOf = <T extends string>(v: string | null, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

export default function TeamsClient({ teams, people, loadError }: { teams: TeamRow[]; people: TeamPerson[]; loadError: boolean }) {
  // Filter/sort/page state is mirrored to the URL with history.replaceState (shareable, no server round-trip).
  const params = useSearchParams();
  const { toasts, notify } = useToasts();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(q);
  const [member, setMember] = useState(params.get("member") ?? "");
  const [sort, setSort] = useState<Sort>(() => {
    const [key, dir] = (params.get("sort") ?? "name:asc").split(":");
    return { key: oneOf(key, ["name", "members", "lead", "updated"] as const, "name"), dir: dir === "desc" ? "desc" : "asc" };
  });
  const [size, setSize] = useState(Number(params.get("size")) || PAGE_SIZES[0]);
  const [page, setPage] = useState(Math.max(1, Number(params.get("page")) || 1));
  const [view, setView] = useState<View>(oneOf(params.get("view"), ["table", "grid"] as const, "grid"));
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; team?: TeamRow } | null>(null);
  const [deleting, setDeleting] = useState<TeamRow | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (q === search) return;
    const t = setTimeout(() => { setSearch(q); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (member) next.set("member", member);
    if (sort.key !== "name" || sort.dir !== "asc") next.set("sort", `${sort.key}:${sort.dir}`);
    if (size !== PAGE_SIZES[0]) next.set("size", String(size));
    if (page > 1) next.set("page", String(page));
    if (view !== "grid") next.set("view", view);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [search, member, sort, size, page, view]);

  const peopleMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const stats = useMemo(() => {
    const inTeam = new Set(teams.flatMap((t) => t.memberIds));
    const active = people.filter((p) => p.isActive);
    const avg = teams.length ? teams.reduce((n, t) => n + t.memberIds.length, 0) / teams.length : 0;
    return {
      inTeam: active.filter((p) => inTeam.has(p.id)).length,
      without: active.filter((p) => !inTeam.has(p.id)).length,
      active: active.length,
      avg: Math.round(avg * 10) / 10,
    };
  }, [teams, people]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const leadName = (t: TeamRow) => (t.leadId && peopleMap.has(t.leadId) ? displayName(peopleMap.get(t.leadId)!.name) : "~");
    const list = teams.filter((t) => {
      if (member && !t.memberIds.includes(member)) return false;
      if (!needle) return true;
      const names = t.memberIds.map((id) => peopleMap.get(id)?.name ?? "");
      return [t.name, t.description, ...names].some((v) => v.toLowerCase().includes(needle));
    });
    const cmp: Record<SortKey, (a: TeamRow, b: TeamRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      members: (a, b) => a.memberIds.length - b.memberIds.length,
      lead: (a, b) => leadName(a).localeCompare(leadName(b)),
      updated: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
    };
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => dir * cmp[sort.key](a, b));
  }, [teams, search, member, sort, peopleMap]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);
  const hasFilters = !!(search || member);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "lead" ? "asc" : "desc" }));
    setPage(1);
  };
  const clearFilters = () => { setQ(""); setSearch(""); setMember(""); setPage(1); };

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const res = await deleteTeam(target.id);
      setDeleting(null);
      if (res.ok) notify("success", `Deleted ${target.name}`);
      else notify("error", res.message ?? "Couldn't delete this team.");
    });
  };

  const actions = { onEdit: (t: TeamRow) => setDrawer({ mode: "edit", team: t }), onDelete: (t: TeamRow) => setDeleting(t) };
  const memberChoices = people.filter((p) => p.isActive || teams.some((t) => t.memberIds.includes(p.id)));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">Group registered people into teams. A person can be in several teams.</p>
        </div>
        <button type="button" className="btn btn-primary fab" onClick={() => setDrawer({ mode: "add" })}>
          <PlusIcon size={16} /> New team
        </button>
      </div>

      {loadError && (
        <div className="alert alert-danger" role="alert">
          <AlertIcon /> Couldn&apos;t load teams. Please refresh. If it keeps happening, contact an administrator.
        </div>
      )}

      <div className="stats-grid stats-compact" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatCard label="Teams" value={teams.length} hint="All teams" color="var(--accent-indigo)" icon={<UsersIcon size={20} />} />
        <StatCard label="In a team" value={stats.inTeam} hint={`of ${stats.active} active people`} color="var(--accent-emerald)" icon={<UserCheckIcon size={20} />} />
        <StatCard label="Without a team" value={stats.without} hint="Active people not in any team" color="var(--accent-amber)" icon={<UserXIcon size={20} />} />
        <StatCard label="Average size" value={stats.avg} hint="Members per team" color="var(--accent-pink)" icon={<SparkIcon size={20} />} />
      </div>

      <div className="toolbar" role="search">
        <div className="search-wrap">
          <SearchIcon size={16} />
          <input className="search-input" type="search" placeholder="Search team, description or member" aria-label="Search teams" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" aria-label="Filter by member" value={member} onChange={(e) => { setMember(e.target.value); setPage(1); }}>
          <option value="">All members</option>
          {memberChoices.map((p) => <option key={p.id} value={p.id}>{displayName(p.name)}</option>)}
        </select>
        <div className="toolbar-spacer" />
        <span className="sr-only" aria-live="polite">{filtered.length} team{filtered.length === 1 ? "" : "s"}</span>
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "grid"} aria-label="Card view" title="Card view" onClick={() => setView("grid")}><GridIcon size={16} /></button>
          <button type="button" aria-pressed={view === "table"} aria-label="Table view" title="Table view" onClick={() => setView("table")}><TableIcon size={16} /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div style={{ color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><UsersIcon size={36} /></div>
            {teams.length === 0 ? (
              <>
                <h3>No teams yet</h3>
                <p>Create a team and pick its members from the people registered in Users.</p>
                <button type="button" className="btn btn-primary" onClick={() => setDrawer({ mode: "add" })}><PlusIcon size={16} /> New team</button>
              </>
            ) : (
              <>
                <h3>No teams match your filters</h3>
                <p>Try a different search term or clear the filters.</p>
                {hasFilters && <button type="button" className="btn" onClick={clearFilters}>Clear filters</button>}
              </>
            )}
          </div>
        </div>
      ) : view === "grid" ? (
        <>
          <TeamGrid teams={visible} people={peopleMap} {...actions} />
          <div className="table-card" style={{ marginTop: "1rem" }}>
            <Pagination page={safePage} size={size} total={filtered.length} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />
          </div>
        </>
      ) : (
        <div className="table-card">
          <TeamTable teams={visible} people={peopleMap} sort={sort} onSort={toggleSort} {...actions} />
          <TeamGrid teams={visible} people={peopleMap} mobileOnly {...actions} />
          <Pagination page={safePage} size={size} total={filtered.length} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />
        </div>
      )}

      {drawer && (
        <TeamDrawer
          key={drawer.team?.id ?? "new"}
          mode={drawer.mode}
          team={drawer.team}
          allTeams={teams}
          people={people}
          onClose={() => setDrawer(null)}
          onSaved={(message) => { setDrawer(null); notify("success", message); }}
        />
      )}

      {deleting && (
        <ConfirmDialog title={`Delete ${deleting.name}?`} confirmLabel="Delete team" danger pending={pending} onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
          This permanently removes the team and its {deleting.memberIds.length} membership{deleting.memberIds.length === 1 ? "" : "s"}. The people themselves,
          their roster and their tasks are not affected. This can&apos;t be undone.
        </ConfirmDialog>
      )}

      <ToastRegion toasts={toasts} />
    </div>
  );
}
