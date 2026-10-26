"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { deleteUser } from "../../lib/user-actions";
import StatCards from "./StatCards";
import UserTable, { type Sort, type SortKey } from "./UserTable";
import UserGrid from "./UserGrid";
import UserDrawer from "./UserDrawer";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination, { PAGE_SIZES } from "../components/ui/Pagination";
import ToastRegion, { type ToastItem } from "../components/ui/Toast";
import { SearchIcon, PlusIcon, TableIcon, GridIcon, UsersIcon, AlertIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import type { UserOptions, UserRow } from "./types";

type StatusFilter = "all" | "active" | "inactive";
type View = "table" | "grid";

const SORTERS: Record<SortKey, (a: UserRow, b: UserRow) => number> = {
  name: (a, b) => displayName(a.name).localeCompare(displayName(b.name)),
  location: (a, b) => (a.locationName ?? "~").localeCompare(b.locationName ?? "~"),
  role: (a, b) => (a.roleName ?? "~").localeCompare(b.roleName ?? "~"),
  joined: (a, b) => a.joinedDate.localeCompare(b.joinedDate),
};

const oneOf = <T extends string>(v: string | null, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

export default function UsersClient({ users, options, loadError }: { users: UserRow[]; options: UserOptions; loadError: boolean }) {
  // Filter/sort/page state lives in the URL (shareable, back-button safe) but is
  // updated with history.replaceState so changing it never triggers a server round-trip.
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(q);
  const [status, setStatus] = useState<StatusFilter>(oneOf(params.get("status"), ["all", "active", "inactive"] as const, "all"));
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [sort, setSort] = useState<Sort>(() => {
    const [key, dir] = (params.get("sort") ?? "name:asc").split(":");
    return { key: oneOf(key, ["name", "location", "role", "joined"] as const, "name"), dir: dir === "desc" ? "desc" : "asc" };
  });
  const [size, setSize] = useState(Number(params.get("size")) || PAGE_SIZES[0]);
  const [page, setPage] = useState(Math.max(1, Number(params.get("page")) || 1));
  const [view, setView] = useState<View>(oneOf(params.get("view"), ["table", "grid"] as const, "table"));

  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; user?: UserRow } | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, startTransition] = useTransition();
  const toastId = useRef(0);

  // Debounce typing (250ms) so filtering feels instant without re-filtering on every keystroke.
  useEffect(() => {
    if (q === search) return;
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q, search]);

  // Remember the preferred view across visits (best effort; storage can be unavailable).
  useEffect(() => {
    if (params.get("view")) return;
    try {
      const saved = localStorage.getItem("users:view");
      if (saved === "grid" || saved === "table") setView(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status !== "all") next.set("status", status);
    if (location) next.set("location", location);
    if (sort.key !== "name" || sort.dir !== "asc") next.set("sort", `${sort.key}:${sort.dir}`);
    if (size !== PAGE_SIZES[0]) next.set("size", String(size));
    if (page > 1) next.set("page", String(page));
    if (view !== "table") next.set("view", view);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [search, status, location, sort, size, page, view]);

  const notify = useCallback((kind: ToastItem["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  // Locations that are active or still assigned to someone.
  const locationChoices = useMemo(
    () => options.locations.filter((l) => l.active || users.some((u) => u.locationId === l.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [options, users]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = users.filter((u) => {
      if (status === "active" && !u.isActive) return false;
      if (status === "inactive" && u.isActive) return false;
      if (location && u.locationId !== location) return false;
      return !needle || [u.name, u.email, u.employeeId, u.locationName, u.roleName].some((v) => v?.toLowerCase().includes(needle));
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => dir * SORTERS[sort.key](a, b));
  }, [users, search, status, location, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);
  const hasFilters = !!(search || location || status !== "all");

  const chooseView = (v: View) => {
    setView(v);
    try { localStorage.setItem("users:view", v); } catch {}
  };
  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "location" ? "asc" : "desc" }));
    setPage(1);
  };
  const clearFilters = () => {
    setQ(""); setSearch(""); setStatus("all"); setLocation(""); setPage(1);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const res = await deleteUser(target.id);
      setDeleting(null);
      if (res.ok) {
        notify("success", `Deleted ${displayName(target.name)}`);
      } else {
        notify("error", res.message ?? "Couldn't delete this user.");
      }
    });
  };

  const actions = { onEdit: (u: UserRow) => setDrawer({ mode: "edit", user: u }), onDelete: (u: UserRow) => setDeleting(u) };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage people, their access status, location and role.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDrawer({ mode: "add" })}>
          <PlusIcon size={16} /> Add user
        </button>
      </div>

      {loadError && (
        <div className="alert alert-danger" role="alert">
          <AlertIcon /> Couldn&apos;t load users. Please refresh. If it keeps happening, contact an administrator.
        </div>
      )}

      <StatCards users={users} />

      <div className="toolbar" role="search">
        <div className="search-wrap">
          <SearchIcon size={16} />
          <input className="search-input" type="search" placeholder="Search name, email, ID, location or role" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Filter by status">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button key={s} type="button" className={`filter-pill ${status === s ? "filter-pill-active" : ""}`} aria-pressed={status === s} style={{ minHeight: 36 }} onClick={() => { setStatus(s); setPage(1); }}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select className="select" aria-label="Filter by location" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }}>
          <option value="">All locations</option>
          {locationChoices.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <div className="toolbar-spacer" />
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "table"} aria-label="Table view" title="Table view" onClick={() => chooseView("table")}><TableIcon size={16} /></button>
          <button type="button" aria-pressed={view === "grid"} aria-label="Grid view" title="Grid view" onClick={() => chooseView("grid")}><GridIcon size={16} /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div style={{ color: "var(--text-muted)", display: "flex", justifyContent: "center" }}><UsersIcon size={36} /></div>
            {users.length === 0 ? (
              <>
                <h3>No users yet</h3>
                <p>Add your first user to get started.</p>
                <button type="button" className="btn btn-primary" onClick={() => setDrawer({ mode: "add" })}><PlusIcon size={16} /> Add user</button>
              </>
            ) : (
              <>
                <h3>No users match your filters</h3>
                <p>Try a different search term or clear the filters.</p>
                {hasFilters && <button type="button" className="btn" onClick={clearFilters}>Clear filters</button>}
              </>
            )}
          </div>
        </div>
      ) : view === "grid" ? (
        <>
          <UserGrid users={visible} {...actions} />
          <div className="table-card" style={{ marginTop: "1rem" }}>
            <Pagination page={safePage} size={size} total={filtered.length} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />
          </div>
        </>
      ) : (
        <div className="table-card">
          <UserTable users={visible} sort={sort} onSort={toggleSort} {...actions} />
          <UserGrid users={visible} mobileOnly {...actions} />
          <Pagination page={safePage} size={size} total={filtered.length} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />
        </div>
      )}

      {drawer && (
        <UserDrawer
          key={drawer.user?.id ?? "new"}
          mode={drawer.mode}
          user={drawer.user}
          allUsers={users}
          options={options}
          onClose={() => setDrawer(null)}
          onSaved={(message) => { setDrawer(null); notify("success", message); }}
        />
      )}

      {deleting && (
        <ConfirmDialog title={`Delete ${displayName(deleting.name)}?`} confirmLabel="Delete user" danger pending={pending} onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
          This permanently removes the user, their roster entries and team memberships. Their work tasks are kept but unassigned.
          This can&apos;t be undone.
        </ConfirmDialog>
      )}

      <ToastRegion toasts={toasts} />
    </div>
  );
}
