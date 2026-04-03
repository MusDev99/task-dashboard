import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Read JSON files
  const usersPath = path.join(process.cwd(), "json", "users.json");
  const tasksPath = path.join(process.cwd(), "json", "tasks.json");

  const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  const tasksData = JSON.parse(fs.readFileSync(tasksPath, "utf-8"));

  // Seed Users
  console.log(`Seeding ${usersData.length} users...`);
  for (const user of usersData) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {}, // Don't overwrite if it exists
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        employeeId: user.employeeId,
        googleId: user.googleId,
        isActive: user.isActive,
        joinedDate: new Date(user.joinedDate),
        updatedAt: new Date(user.updatedAt),
        phoneNumber: user.phoneNumber,
        roleId: user.roleId,
        avatar: user.avatar,
        stationCode: user.stationCode,
      },
    });
  }

  // Seed Tasks
  console.log(`Seeding ${tasksData.length} tasks...`);
  for (const task of tasksData) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: {
        id: task.id,
        userId: task.userId,
        taskTitle: task.taskTitle,
        difficulty: task.difficulty,
        correctness: task.correctness,
        timeTakenSeconds: task.timeTakenSeconds,
        maxTimeSeconds: task.maxTimeSeconds,
        completedAt: new Date(task.completedAt),
      },
    });
  }

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
