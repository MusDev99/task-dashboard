import Link from "next/link";
import Image from "next/image";
import usersData from "@/json/users.json";
import tasksData from "@/json/tasks.json";
import { User, TaskCompletion } from "../lib/types";
import { calculateMeritScore, calculateAvgCorrectness } from "../lib/merit";

const users = usersData as User[];
const tasks = tasksData as TaskCompletion[];

const avatarColors = [
  "linear-gradient(135deg, #6c63ff, #9b5de5)",
  "linear-gradient(135deg, #f15bb5, #fe6d73)",
  "linear-gradient(135deg, #00c9a7, #00b4d8)",
  "linear-gradient(135deg, #ffc233, #ff9f1c)",
  "linear-gradient(135deg, #9b5de5, #f15bb5)",
  "linear-gradient(135deg, #00b4d8, #0077b6)",
  "linear-gradient(135deg, #ff6b6b, #ee5a24)",
  "linear-gradient(135deg, #26de81, #20bf6b)",
  "linear-gradient(135deg, #fd79a8, #e84393)",
  "linear-gradient(135deg, #a29bfe, #6c5ce7)",
];

export default function UsersPage() {
  const usersWithStats = users.map((user, index) => {
    const userTasks = tasks.filter((t) => t.userId === user.id);
    return {
      user,
      meritScore: calculateMeritScore(userTasks),
      tasksCompleted: userTasks.length,
      avgCorrectness: calculateAvgCorrectness(userTasks),
      colorIndex: index,
    };
  });

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
          👥 Users
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Manage and view all registered learners in the system.
        </p>
      </div>

      {/* Users Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {usersWithStats.map((entry, i) => (
          <Link
            key={entry.user.id}
            href={`/users/${entry.user.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="glass-card animate-fade-in-up"
              style={{ padding: "1.5rem", animationDelay: `${i * 80}ms` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "1.25rem" }}>
                <div
                  className="avatar avatar-lg"
                  style={{ 
                    background: entry.user.avatar ? 'none' : avatarColors[entry.colorIndex % avatarColors.length],
                    overflow: 'hidden'
                  }}
                >
                  {entry.user.avatar ? (
                    <Image 
                      src={entry.user.avatar} 
                      alt={entry.user.name} 
                      width={48}
                      height={48}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    entry.user.name.charAt(0)
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "1rem", fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.user.name.replace(/\s-\s*$/, "")}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.user.email}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span className="badge badge-indigo">
                      {entry.user.stationCode}
                    </span>
                    {entry.user.employeeId && (
                      <span className="badge badge-pink">
                        ID: {entry.user.employeeId}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.75rem",
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "1rem",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-amber)" }}>
                    {entry.meritScore}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Score
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                    {entry.tasksCompleted}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Tasks
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-emerald)" }}>
                    {entry.avgCorrectness}%
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Accuracy
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
