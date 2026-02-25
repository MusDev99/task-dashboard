export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedDate: string;
  role: "admin" | "member";
  badges: string[];
}

export type Difficulty = "easy" | "medium" | "hard";

export interface TaskCompletion {
  id: string;
  userId: string;
  taskTitle: string;
  difficulty: Difficulty;
  correctness: number; // 0-100
  timeTakenSeconds: number;
  maxTimeSeconds: number;
  completedAt: string;
}

export interface LeaderboardEntry {
  user: User;
  meritScore: number;
  tasksCompleted: number;
  avgCorrectness: number;
  rank: number;
}
