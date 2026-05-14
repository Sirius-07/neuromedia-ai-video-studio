-- CreateTable
CREATE TABLE "AudioGenerationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "duration" REAL NOT NULL,
    "steps" INTEGER NOT NULL DEFAULT 100,
    "cfgScale" REAL NOT NULL DEFAULT 7.0,
    "seed" INTEGER NOT NULL DEFAULT -1,
    "samplerType" TEXT NOT NULL DEFAULT 'dpmpp-3m-sde',
    "sigmaMin" REAL NOT NULL DEFAULT 0.3,
    "sigmaMax" REAL NOT NULL DEFAULT 500.0,
    "outputFilePath" TEXT,
    "outputFileUrl" TEXT,
    "errorMessage" TEXT
);

-- CreateIndex
CREATE INDEX "AudioGenerationTask_status_idx" ON "AudioGenerationTask"("status");

-- CreateIndex
CREATE INDEX "AudioGenerationTask_createdAt_idx" ON "AudioGenerationTask"("createdAt");
