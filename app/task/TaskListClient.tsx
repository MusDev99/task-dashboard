"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Difficulty } from "../lib/types";
import { calculateTaskScore } from "../lib/merit";

// Exclude relational objects from Prisma types since calculateTaskScore expects specific fields
// We manually reconstruct it to match the payload.
export default function TaskListClient({ initialTasks, users }: { initialTasks: any[], users: any[] }) {
  const difficulties: (Difficulty | "all")[] = ["all", "easy", "medium", "hard"];
  const [filter, setFilter] = useState<Difficulty | "all">("all");

  const filteredTasks = filter === "all" ? initialTasks : initialTasks.filter((t) => t.difficulty === filter);

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
          ✅ Tasks
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Browse completed quizzes and tasks across all users.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        {difficulties.map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`filter-pill ${filter === d ? "filter-pill-active" : ""}`}
          >
            {d === "all" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--text-muted)", alignSelf: "center" }}>
          {filteredTasks.length} tasks
        </div>
      </div>

      {/* Task Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {filteredTasks.map((task, i) => {
          const user = users.find((u) => u.id === task.userId);
          // @ts-ignore
          const score = Math.round(calculateTaskScore(task));
          const timeMin = Math.floor(task.timeTakenSeconds / 60);
          const timeSec = task.timeTakenSeconds % 60;

          return (
            <Link
              key={task.id}
              href={`/task/${task.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="glass-card task-row animate-fade-in-up"
                style={{
                  padding: "1.25rem 1.5rem",
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px 80px 80px",
                  gap: "1rem",
                  alignItems: "center",
                  animationDelay: `${i * 40}ms`,
                }}
              >
                {/* Task Info */}
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "4px" }}>
                    {task.taskTitle}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    by {user?.name.replace(/\s-\s*$/, "") || "Unknown"} · {new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>

                {/* Meta row — wraps on mobile */}
                <div className="task-row-meta" style={{ display: "contents" }}>
                  {/* Difficulty */}
                  <div style={{ textAlign: "center" }}>
                    <span className={`badge badge-${task.difficulty}`}>{task.difficulty}</span>
                  </div>

                  {/* Time */}
                  <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    {timeMin}m {timeSec}s
                  </div>

                  {/* Accuracy */}
                  <div style={{ textAlign: "center", fontSize: "0.875rem", fontWeight: 600 }}>
                    {task.correctness}%
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: "center", fontSize: "0.95rem", fontWeight: 700, color: "var(--accent-amber)" }}>
                    +{score}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
