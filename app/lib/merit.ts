import { TaskCompletion, Difficulty } from "./types";

const DIFFICULTY_WEIGHTS: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/**
 * Calculate merit score for a single task completion.
 *
 * Formula: (correctness / 100) × difficultyWeight × timeBonus
 * timeBonus = max(0.5, 1 - timeTaken / maxTime)
 *
 * This rewards:
 * - Higher correctness (linear scaling)
 * - Harder tasks (weighted 1x/2x/3x)
 * - Faster completion (bonus capped at floor of 0.5)
 */
export function calculateTaskScore(task: TaskCompletion): number {
  const correctnessFactor = task.correctness / 100;
  const difficultyWeight = DIFFICULTY_WEIGHTS[task.difficulty];
  const timeBonus = Math.max(0.5, 1 - task.timeTakenSeconds / task.maxTimeSeconds);

  return correctnessFactor * difficultyWeight * timeBonus * 100;
}

/**
 * Calculate total merit score across all tasks for a user.
 */
export function calculateMeritScore(tasks: TaskCompletion[]): number {
  return Math.round(
    tasks.reduce((total, task) => total + calculateTaskScore(task), 0)
  );
}

/**
 * Calculate average correctness across tasks.
 */
export function calculateAvgCorrectness(tasks: TaskCompletion[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, task) => sum + task.correctness, 0);
  return Math.round(total / tasks.length);
}
