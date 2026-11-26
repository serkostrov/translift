-- DropIndex
DROP INDEX "Notification_userId_readAt_idx";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "readAt",
ADD COLUMN     "link" TEXT;

-- CreateTable
CREATE TABLE "NotificationRead" (
    "notificationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "read" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("userId","notificationId")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ссылки для уже созданных уведомлений
UPDATE "Notification" SET "link" = '/users' WHERE "dedupeKey" LIKE 'password-reset:%';
UPDATE "Notification" SET "link" = '/objects/' || "objectId" WHERE "link" IS NULL AND "objectId" IS NOT NULL;
