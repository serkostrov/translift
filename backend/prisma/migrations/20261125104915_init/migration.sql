-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'FOREMAN', 'FINANCE');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('REPLACEMENT', 'NEW_BUILDING');

-- CreateEnum
CREATE TYPE "ControlDate" AS ENUM ('PTO', 'DECLARATION', 'COMMISSIONING', 'ACCEPTANCE', 'KS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_ORDERED', 'ORDERED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('PHOTO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ClaimKind" AS ENUM ('DEFECT', 'INCOMPLETE', 'MISMATCH');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('NEW', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationLevel" AS ENUM ('INFO', 'WARNING', 'DANGER');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "brigadeId" UUID,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brigade" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "foremanId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Brigade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE,
    "customerId" UUID NOT NULL,
    "responsible" TEXT,
    "photoReportLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageTemplate" (
    "id" UUID NOT NULL,
    "workType" "WorkType" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "StageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateStage" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "photoRequired" BOOLEAN NOT NULL DEFAULT true,
    "setsDate" "ControlDate",

    CONSTRAINT "TemplateStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiftObject" (
    "id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "shortAddress" TEXT NOT NULL,
    "floors" INTEGER,
    "capacityKg" INTEGER,
    "liftInfo" TEXT,
    "templateId" UUID NOT NULL,
    "contractId" UUID,
    "brigadeId" UUID,
    "currentStageId" UUID,
    "deadline" DATE,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NOT_ORDERED',
    "deliveryPlannedDate" DATE,
    "deliveryActualDate" DATE,
    "plannedStartDate" DATE,
    "openedDate" DATE,
    "ptoDate" DATE,
    "declarationDate" DATE,
    "commissionedDate" DATE,
    "acceptanceDate" DATE,
    "ksDate" DATE,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LiftObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageMark" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "performedAt" TIMESTAMPTZ NOT NULL,
    "authorId" UUID NOT NULL,
    "comment" TEXT,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" UUID NOT NULL,
    "kind" "FileKind" NOT NULL,
    "key" TEXT NOT NULL,
    "thumbKey" TEXT,
    "originalName" TEXT,
    "mime" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "thumbSize" BIGINT,
    "title" TEXT,
    "takenAt" TIMESTAMPTZ,
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalPurgedAt" TIMESTAMPTZ,
    "objectId" UUID,
    "stageMarkId" UUID,
    "claimId" UUID,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "objectId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "supplier" TEXT NOT NULL,
    "kind" "ClaimKind" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimComment" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectFinance" (
    "objectId" UUID NOT NULL,
    "contractNumber" TEXT,
    "contractDate" DATE,
    "contractAmount" DECIMAL(14,2),
    "equipmentCost" DECIMAL(14,2),
    "customerPrice" DECIMAL(14,2),
    "closedWorksAmount" DECIMAL(14,2),
    "paidAmount" DECIMAL(14,2),
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ObjectFinance_pkey" PRIMARY KEY ("objectId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "objectId" UUID,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,
    "objectId" UUID,
    "level" "NotificationLevel" NOT NULL DEFAULT 'INFO',
    "topic" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StageTemplate_workType_key" ON "StageTemplate"("workType");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateStage_templateId_order_key" ON "TemplateStage"("templateId", "order");

-- CreateIndex
CREATE INDEX "LiftObject_brigadeId_idx" ON "LiftObject"("brigadeId");

-- CreateIndex
CREATE INDEX "LiftObject_contractId_idx" ON "LiftObject"("contractId");

-- CreateIndex
CREATE INDEX "StageMark_objectId_performedAt_idx" ON "StageMark"("objectId", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "File_key_key" ON "File"("key");

-- CreateIndex
CREATE INDEX "File_objectId_idx" ON "File"("objectId");

-- CreateIndex
CREATE INDEX "File_kind_createdAt_idx" ON "File"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_number_key" ON "Claim"("number");

-- CreateIndex
CREATE INDEX "Claim_objectId_idx" ON "Claim"("objectId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "AuditLog_objectId_createdAt_idx" ON "AuditLog"("objectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "Brigade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brigade" ADD CONSTRAINT "Brigade_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateStage" ADD CONSTRAINT "TemplateStage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftObject" ADD CONSTRAINT "LiftObject_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftObject" ADD CONSTRAINT "LiftObject_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftObject" ADD CONSTRAINT "LiftObject_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "Brigade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftObject" ADD CONSTRAINT "LiftObject_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "TemplateStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageMark" ADD CONSTRAINT "StageMark_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LiftObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageMark" ADD CONSTRAINT "StageMark_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TemplateStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageMark" ADD CONSTRAINT "StageMark_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LiftObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_stageMarkId_fkey" FOREIGN KEY ("stageMarkId") REFERENCES "StageMark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LiftObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimComment" ADD CONSTRAINT "ClaimComment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimComment" ADD CONSTRAINT "ClaimComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectFinance" ADD CONSTRAINT "ObjectFinance_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LiftObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LiftObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LiftObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
