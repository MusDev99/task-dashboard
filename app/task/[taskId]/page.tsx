"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import usersData from "@/json/users.json";
import tasksData from "@/json/tasks.json";
import { User, TaskCompletion } from "../../lib/types";
import { calculateTaskScore } from "../../lib/merit";

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

const difficultyWeightLabel: Record<string, string> = {
  easy: "1x (Easy)",
  medium: "2x (Medium)",
  hard: "3x (Hard)",
};

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.taskId as string;

  const task = tasks.find((t) => t.id === taskId);
  const user = task ? users.find((u) => u.id === task.userId) : null;
  const userIndex = user ? users.findIndex((u) => u.id === user.id) : 0;

  if (!task) {
    return (
      <div style={{ textAlign: "center", padding: "4rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Task not found</h1>
        <Link href="/task" style={{ color: "var(--accent-indigo)", textDecoration: "none", fontSize: "0.9rem" }}>
          ← Back to Tasks
        </Link>
      </div>
    );
  }

  const score = Math.round(calculateTaskScore(task));
  const timeBonus = Math.max(0.5, 1 - task.timeTakenSeconds / task.maxTimeSeconds);
  const timeMin = Math.floor(task.timeTakenSeconds / 60);
  const timeSec = task.timeTakenSeconds % 60;
  const maxMin = Math.floor(task.maxTimeSeconds / 60);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* Back link */}
      <Link
        href="/task"
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
        ← Back to Tasks
      </Link>

      {/* Task Header */}
      <div className="glass-card" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className={`badge badge-${task.difficulty}`} style={{ marginBottom: "0.75rem", display: "inline-block" }}>
              {task.difficulty}
            </span>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 0.5rem 0" }}>
              {task.taskTitle}
            </h1>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Completed on {new Date(task.completedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            +{score}
          </div>
        </div>
      </div>

      {/* Completed By */}
      {user && (
        <Link href={`/users/${user.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="glass-card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              className="avatar avatar-md"
              style={{ background: avatarColors[userIndex % avatarColors.length] }}
            >
              {user.avatar}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
                Completed By
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{user.name}</div>
            </div>
            <span className={`badge ${user.role === "admin" ? "badge-pink" : "badge-indigo"}`}>
              {user.role}
            </span>
          </div>
        </Link>
      )}

      {/* Score Breakdown */}
      <div className="glass-card" style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>📐 Score Breakdown</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Correctness */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Correctness</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Accuracy percentage on the quiz</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div className="score-bar-track" style={{ width: "120px" }}>
                <div className="score-bar-fill" style={{ width: `${task.correctness}%` }} />
              </div>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent-emerald)", width: "50px", textAlign: "right" }}>
                {task.correctness}%
              </span>
            </div>
          </div>

          {/* Difficulty */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Difficulty Weight</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Multiplier based on task difficulty</div>
            </div>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent-pink)" }}>
              {difficultyWeightLabel[task.difficulty]}
            </span>
          </div>

          {/* Time Bonus */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Time Bonus</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Completed in {timeMin}m {timeSec}s out of {maxMin}m allowed
              </div>
            </div>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent-amber)" }}>
              ×{timeBonus.toFixed(2)}
            </span>
          </div>

          {/* Final Score */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", background: "rgba(108, 99, 255, 0.05)" }}>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>Final Merit Score</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                ({task.correctness}/100) × {task.difficulty === "easy" ? 1 : task.difficulty === "medium" ? 2 : 3} × {timeBonus.toFixed(2)} × 100
              </div>
            </div>
            <span
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                background: "var(--gradient-primary)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              +{score}
            </span>
          </div>
        </div>
      </div>

      {/* Quiz Content Placeholder */}
      <div
        className="glass-card"
        style={{
          padding: "2rem",
          marginTop: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>📝</div>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Quiz Content
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Coming soon — quiz questions, answers, and detailed performance breakdown will appear here with backend integration.
        </div>
      </div>
    </div>
  );
}
