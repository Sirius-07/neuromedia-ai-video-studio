-- CreateTable
CREATE TABLE "SoundtrackTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "videoId" TEXT NOT NULL,
    "instructionBlueprint" TEXT,
    "finalAssetMap" TEXT,
    "errorMessage" TEXT
);

-- CreateIndex
CREATE INDEX "SoundtrackTask_videoId_idx" ON "SoundtrackTask"("videoId");

-- CreateIndex
CREATE INDEX "SoundtrackTask_status_idx" ON "SoundtrackTask"("status");
