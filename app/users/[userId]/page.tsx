"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import usersData from "@/json/users.json";
import tasksData from "@/json/tasks.json";
import { User, TaskCompletion } from "../../lib/types";
import { calculateMeritScore, calculateAvgCorrectness, calculateTaskScore } from "../../lib/merit";

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


function getRank(userId: string): number {
  const sorted = users
    .map((u) => ({
      id: u.id,
      score: calculateMeritScore(tasks.filter((t) => t.userId === u.id)),
    }))
    .sort((a, b) => b.score - a.score);
  return sorted.findIndex((u) => u.id === userId) + 1;
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.userId as string;

  const user = users.find((u) => u.id === userId);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>User not found</h1>
        <Link href="/users" style={{ color: "var(--accent-indigo)", textDecoration: "none", fontSize: "0.9rem" }}>
          ← Back to Users
        </Link>
      </div>
    );
  }

  const userTasks = tasks.filter((t) => t.userId === userId);
  const meritScore = calculateMeritScore(userTasks);
  const avgCorrectness = calculateAvgCorrectness(userTasks);
  const rank = getRank(userId);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* Back link */}
      <Link
        href="/users"
        style={{
          color: "var(--text-muted)",
          textDecoration: "none",
          fontSize: "0.85rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "1.5rem",
        }}
      >
        ← Back to Users
      </Link>

      {/* Profile Header */}
      <div
        className="glass-card profile-header"
        style={{
          padding: "2rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div
          className="avatar avatar-xl"
          style={{
            background: user.avatar ? 'none' : avatarColors[userIndex % avatarColors.length],
            boxShadow: "0 0 30px rgba(108, 99, 255, 0.2)",
            overflow: 'hidden'
          }}
        >
          {user.avatar ? (
            <Image 
              src={user.avatar} 
              alt={user.name} 
              width={64}
              height={64}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            user.name.charAt(0)
          )}
        </div>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div className="profile-badges" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
              {user.name.replace(/\s-\s*$/, "")}
            </h1>
            <span className="badge badge-indigo">
              {user.stationCode}
            </span>
            {user.employeeId && (
              <span className="badge badge-pink">
                ID: {user.employeeId}
              </span>
            )}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.75rem", wordBreak: "break-word" }}>
            {user.email} · Registered {new Date(user.joinedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <div style={{ fontSize: "0.75rem", padding: "4px 8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", color: "var(--text-secondary)" }}>
              Role ID: {user.roleId}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div
        className="stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="stat-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Rank
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>
            #{rank}
          </div>
        </div>
        <div className="stat-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Merit Score
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent-amber)" }}>
            {meritScore}
          </div>
        </div>
        <div className="stat-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Tasks Completed
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>
            {userTasks.length}
          </div>
        </div>
        <div className="stat-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Avg Accuracy
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
            {avgCorrectness}%
          </div>
        </div>
      </div>

      {/* Task History */}
      <div className="glass-card" style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>📋 Task History</h2>
        </div>
        {userTasks.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            No tasks completed yet
          </div>
        ) : (
          userTasks.map((task, i) => (
            <Link
              key={task.id}
              href={`/task/${task.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="task-history-row animate-fade-in-up"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 80px 80px",
                  gap: "1rem",
                  padding: "1rem 1.5rem",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition: "background var(--transition-fast)",
                  animationDelay: `${i * 60}ms`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{task.taskTitle}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    {new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <div className="task-history-meta" style={{ display: "contents" }}>
                  <div style={{ textAlign: "center" }}>
                    <span className={`badge badge-${task.difficulty}`}>{task.difficulty}</span>
                  </div>
                  <div style={{ textAlign: "center", fontSize: "0.85rem", fontWeight: 600 }}>
                    {task.correctness}%
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "var(--accent-amber)",
                    }}
                  >
                    +{Math.round(calculateTaskScore(task))}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Activity Timeline Placeholder */}
      <div
        className="glass-card"
        style={{
          padding: "2rem",
          marginTop: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>📊</div>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Activity Timeline
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Coming soon — detailed activity charts and learning progress tracking will appear here.
        </div>
      </div>
    </div>
  );
}
