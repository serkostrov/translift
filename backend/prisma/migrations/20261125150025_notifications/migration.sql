-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationsReadAt" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "Notification_dedupeKey_createdAt_idx" ON "Notification"("dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

