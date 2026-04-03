"use server";

import { prisma } from "./prisma";

// User Actions
export async function getUsers() {
  try {
    const users = await prisma.user.findMany();
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export async function getUserById(id: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { tasks: true },
    });
    return user;
  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    return null;
  }
}

// Task Actions
export async function getTasks() {
  try {
    const tasks = await prisma.task.findMany({
      include: { user: true },
    });
    return tasks;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

export async function getTaskById(id: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { user: true },
    });
    return task;
  } catch (error) {
    console.error(`Error fetching task ${id}:`, error);
    return null;
  }
}
