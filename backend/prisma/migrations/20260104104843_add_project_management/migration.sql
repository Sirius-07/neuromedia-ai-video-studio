-- AlterTable
ALTER TABLE "SoundtrackTask" ADD COLUMN "projectId" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userPrompt" TEXT,
    "thumbnail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "storyboardData" TEXT,
    "totalScenes" INTEGER NOT NULL DEFAULT 0,
    "completedScenes" INTEGER NOT NULL DEFAULT 0,
    "soundtrackTaskId" TEXT,
    "roughCutVideoUrl" TEXT,
    "finalVideoUrl" TEXT,
    "settings" TEXT
);

-- CreateTable
CREATE TABLE "StoryboardProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "userPrompt" TEXT,
    "scenesData" TEXT NOT NULL,
    "totalScenes" INTEGER NOT NULL DEFAULT 0,
    "completedScenes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft'
);

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE INDEX "StoryboardProject_createdAt_idx" ON "StoryboardProject"("createdAt");

-- CreateIndex
CREATE INDEX "StoryboardProject_status_idx" ON "StoryboardProject"("status");

-- CreateIndex
CREATE INDEX "SoundtrackTask_projectId_idx" ON "SoundtrackTask"("projectId");
