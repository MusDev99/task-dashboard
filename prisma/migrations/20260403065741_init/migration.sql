-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeId" TEXT,
    "googleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedDate" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "phoneNumber" TEXT,
    "roleId" TEXT,
    "avatar" TEXT,
    "stationCode" TEXT
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "correctness" INTEGER NOT NULL,
    "timeTakenSeconds" INTEGER NOT NULL,
    "maxTimeSeconds" INTEGER NOT NULL,
    "completedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
