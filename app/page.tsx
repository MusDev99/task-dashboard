import Link from "next/link";
import Image from "next/image";
import { loadUsers, getTasks, getRoster } from "../lib/actions";
import { getShiftConfig } from "../lib/shifts";
import { isRealDate, todayIn } from "../lib/roster-dates";
import { toResources } from "../lib/whereabouts";
import { getLocations } from "../lib/settings";
import WhereaboutsSection from "./whereabouts/WhereaboutsSection";
import { User, TaskCompletion } from "./lib/types";
import { calculateMeritScore, calculateAvgCorrectness } from "./lib/merit";

// Data comes from Google Sheets; always render per request.
export const dynamic = "force-dynamic";

function getLeaderboard(users: User[], tasks: TaskCompletion[]) {
  return users
    .map((user) => {
      const userTasks = tasks.filter((t) => t.userId === user.id);
      return {
        user,
        meritScore: calculateMeritScore(userTasks),
        tasksCompleted: userTasks.length,
        avgCorrectness: calculateAvgCorrectness(userTasks),
        rank: 0,
      };
    })
    .sort((a, b) => b.meritScore - a.meritScore)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

const avatarColors = [
  "linear-gradient(135deg, #6c63ff, #9b5de5)",
  "linear-gradient(135deg, #f15bb5, #fe6d73)",
  "linear-gradient(135deg, #00c9a7, #00b4d8)",
  "linear-gradient(135deg, #ffc233, #ff9f1c)",
  "linear-gradient(135deg, #9b5de5, #f15bb5)",
];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: requested } = await searchParams;
  const config = await getShiftConfig();
  const today = todayIn(config.timezone);
  const date = requested && isRealDate(requested) ? requested : today;
  const [{ users, error: usersError }, tasks, roster, locations] = await Promise.all([loadUsers(), getTasks(), getRoster(date.slice(0, 7)), getLocations()]);
  const leaderboard = getLeaderboard(users, tasks);
  const totalTasks = tasks.length;
  const topScorer = leaderboard[0];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: "0.5rem",
          }}
        >
          Dashboard
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Welcome back! Here&apos;s your learning community at a glance.
        </p>
      </div>

      {/* Daily Whereabouts (derived from the roster) */}
      <WhereaboutsSection
        resources={toResources(users, locations)}
        entries={roster.entries}
        config={config}
        initialDate={date}
        today={today}
        loadError={roster.error || usersError}
      />

      {/* Stats Row */}
      <div
        className="stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {/* Total Users */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                Total Users
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
                {users.length}
              </div>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "rgba(108, 99, 255, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-indigo)",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            </div>
          </div>
        </div>

        {/* Tasks Completed */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                Tasks Completed
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
                {totalTasks}
              </div>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "rgba(0, 201, 167, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-emerald)",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            </div>
          </div>
        </div>

        {/* Top Scorer */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                Top Scorer
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {topScorer?.user.name.replace(/\s-\s*$/, "")}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--accent-amber)", fontWeight: 600, marginTop: "2px" }}>
                {topScorer?.meritScore} pts
              </div>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "rgba(255, 194, 51, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                flexShrink: 0,
              }}
            >
              🏆
            </div>
          </div>
        </div>

        {/* Avg Accuracy */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                Avg Accuracy
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
                {Math.round(tasks.reduce((s, t) => s + t.correctness, 0) / tasks.length)}%
              </div>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "rgba(241, 91, 181, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-pink)",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Leaderboard */}
      <div className="glass-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
            🏅 Top Performers
          </h2>
          <Link
            href="/leaderboard"
            style={{
              fontSize: "0.8rem",
              color: "var(--accent-indigo)",
              textDecoration: "none",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            View Full Leaderboard →
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div
              key={entry.user.id}
              className="animate-fade-in-up"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                background: i === 0 ? "rgba(255, 194, 51, 0.06)" : "transparent",
                border: "1px solid transparent",
                animationDelay: `${i * 100}ms`,
              }}
            >
              <div className="rank-number" style={
                i === 0
                  ? { background: "var(--gradient-gold)", color: "#1a1a1a" }
                  : i === 1
                  ? { background: "var(--gradient-silver)", color: "#1a1a1a" }
                  : i === 2
                  ? { background: "var(--gradient-bronze)", color: "#fff" }
                  : {}
              }>
                {entry.rank}
              </div>
              <div
                className="avatar avatar-sm"
                style={{ 
                  background: entry.user.avatar ? 'none' : avatarColors[i % avatarColors.length],
                  overflow: 'hidden'
                }}
              >
                {entry.user.avatar ? (
                  <Image 
                    src={entry.user.avatar} 
                    alt={entry.user.name} 
                    width={32}
                    height={32}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  entry.user.name.charAt(0)
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.user.name.replace(/\s-\s*$/, "")}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {entry.tasksCompleted} tasks · {entry.avgCorrectness}% accuracy
                </div>
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent-amber)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {entry.meritScore}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
