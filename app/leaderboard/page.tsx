"use client";

import { useState } from "react";
import Link from "next/link";
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

function getLeaderboard() {
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

const badgeLabels: Record<string, string> = {
  "early-adopter": "🌟 Early Adopter",
  "streak-master": "🔥 Streak Master",
  "quiz-king": "👑 Quiz King",
  "top-scorer": "🎯 Top Scorer",
  "speed-demon": "⚡ Speed Demon",
  consistent: "📈 Consistent",
  perfectionist: "💎 Perfectionist",
  "rising-star": "🚀 Rising Star",
  mentor: "🧭 Mentor",
};

export default function LeaderboardPage() {
  const leaderboard = getLeaderboard();
  const maxScore = leaderboard[0]?.meritScore || 1;
  const [search, setSearch] = useState("");

  const filtered = leaderboard.filter((e) =>
    e.user.name.toLowerCase().includes(search.toLowerCase())
  );

  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  // Reorder for display: [2nd, 1st, 3rd]
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
          🏆 Leaderboard
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Rankings based on merit score — a combination of accuracy, difficulty mastery, and speed.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "2rem", position: "relative", maxWidth: "320px" }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="search-input"
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      {/* Podium — Top 3 */}
      {!search && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "1rem",
            marginBottom: "2.5rem",
            alignItems: "end",
          }}
        >
          {podiumOrder.map((entry, displayIndex) => {
            const isFirst = entry.rank === 1;
            const rankEmoji = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉";
            return (
              <div
                key={entry.user.id}
                className={`podium-card podium-${entry.rank} animate-fade-in-up`}
                style={{
                  animationDelay: `${displayIndex * 150}ms`,
                  paddingTop: isFirst ? "2.5rem" : "2rem",
                  paddingBottom: isFirst ? "2.5rem" : "2rem",
                }}
              >
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{rankEmoji}</div>
                  <div
                    className={`avatar ${isFirst ? "avatar-xl" : "avatar-lg"}`}
                    style={{
                      background: avatarColors[(entry.rank - 1) % avatarColors.length],
                      margin: "0 auto 1rem",
                      boxShadow: isFirst ? "0 0 30px rgba(255, 194, 51, 0.3)" : "none",
                    }}
                  >
                    {entry.user.avatar}
                  </div>
                  <div style={{ fontSize: isFirst ? "1.15rem" : "1rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                    {entry.user.name}
                  </div>
                  <div
                    style={{
                      fontSize: isFirst ? "1.5rem" : "1.25rem",
                      fontWeight: 800,
                      background: isFirst ? "var(--gradient-gold)" : "var(--gradient-primary)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {entry.meritScore} pts
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {entry.tasksCompleted} tasks · {entry.avgCorrectness}% avg
                  </div>
                  {/* Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center", marginTop: "0.75rem" }}>
                    {entry.user.badges.slice(0, 3).map((b) => (
                      <span key={b} className="badge badge-indigo">
                        {badgeLabels[b] || b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table — Remaining */}
      <div className="glass-card" style={{ padding: "0", overflow: "hidden" }}>
        {/* Table Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 120px 100px 100px 160px",
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <div>Rank</div>
          <div>User</div>
          <div style={{ textAlign: "center" }}>Merit Score</div>
          <div style={{ textAlign: "center" }}>Tasks</div>
          <div style={{ textAlign: "center" }}>Accuracy</div>
          <div>Score Progress</div>
        </div>

        {/* Table Rows */}
        {(search ? filtered : rest.length > 0 ? rest : filtered).map((entry, i) => (
          <Link
            key={entry.user.id}
            href={`/users/${entry.user.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="animate-fade-in-up"
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr 120px 100px 100px 160px",
                padding: "1rem 1.5rem",
                alignItems: "center",
                borderBottom: "1px solid var(--border-subtle)",
                cursor: "pointer",
                transition: "background var(--transition-fast)",
                animationDelay: `${i * 60}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Rank */}
              <div>
                <div
                  className="rank-number"
                  style={
                    entry.rank === 1
                      ? { background: "var(--gradient-gold)", color: "#1a1a1a" }
                      : entry.rank === 2
                      ? { background: "var(--gradient-silver)", color: "#1a1a1a" }
                      : entry.rank === 3
                      ? { background: "var(--gradient-bronze)", color: "#fff" }
                      : {}
                  }
                >
                  {entry.rank}
                </div>
              </div>

              {/* User */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  className="avatar avatar-sm"
                  style={{ background: avatarColors[(entry.rank - 1) % avatarColors.length] }}
                >
                  {entry.user.avatar}
                </div>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{entry.user.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {entry.user.badges
                      .slice(0, 2)
                      .map((b) => badgeLabels[b] || b)
                      .join(" · ")}
                  </div>
                </div>
              </div>

              {/* Merit Score */}
              <div
                style={{
                  textAlign: "center",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--accent-amber)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {entry.meritScore}
              </div>

              {/* Tasks */}
              <div style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                {entry.tasksCompleted}
              </div>

              {/* Accuracy */}
              <div style={{ textAlign: "center", fontSize: "0.875rem", fontWeight: 600 }}>
                {entry.avgCorrectness}%
              </div>

              {/* Score Bar */}
              <div>
                <div className="score-bar-track">
                  <div
                    className="score-bar-fill"
                    style={{ width: `${(entry.meritScore / maxScore) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Formula Legend */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1.25rem 1.5rem",
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
          📐 Merit Score Formula
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            lineHeight: 1.8,
          }}
        >
          <div>
            <span style={{ color: "var(--accent-indigo)" }}>Per Task Score</span> ={" "}
            <span style={{ color: "var(--accent-emerald)" }}>Correctness</span> ×{" "}
            <span style={{ color: "var(--accent-pink)" }}>Difficulty Weight</span> ×{" "}
            <span style={{ color: "var(--accent-amber)" }}>Time Bonus</span>
          </div>
          <div style={{ marginTop: "4px", fontSize: "0.75rem" }}>
            Difficulty: Easy(1x) · Medium(2x) · Hard(3x) &nbsp;&nbsp;|&nbsp;&nbsp;
            Time Bonus: max(0.5, 1 − timeTaken/maxTime)
          </div>
        </div>
      </div>
    </div>
  );
}
