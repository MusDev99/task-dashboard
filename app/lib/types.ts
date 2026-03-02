export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  joinedDate: string;
  employeeId: string | null;
  googleId: string | null;
  isActive: boolean;
  updatedAt: string;
  phoneNumber: string | null;
  roleId: string;
  stationCode: string;
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
