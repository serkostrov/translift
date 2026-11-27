-- Объект — дом, внутри лифты. Каждый существующий объект становится объектом
-- с одним лифтом без названия; id лифта совпадает с id объекта.

-- CreateTable
CREATE TABLE "Lift" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 1,
    "floors" INTEGER,
    "capacityKg" INTEGER,
    "liftInfo" TEXT,
    "templateId" UUID NOT NULL,
    "brigadeId" UUID,
    "currentStageId" UUID,
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
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Lift_pkey" PRIMARY KEY ("id")
);

-- Перенос данных: лифт на каждый объект
INSERT INTO "Lift" (
    "id", "objectId", "floors", "capacityKg", "liftInfo", "templateId", "currentStageId",
    "deliveryStatus", "deliveryPlannedDate", "deliveryActualDate", "plannedStartDate",
    "openedDate", "ptoDate", "declarationDate", "commissionedDate", "acceptanceDate", "ksDate",
    "createdAt", "updatedAt"
)
SELECT
    "id", "id", "floors", "capacityKg", "liftInfo", "templateId", "currentStageId",
    "deliveryStatus", "deliveryPlannedDate", "deliveryActualDate", "plannedStartDate",
    "openedDate", "ptoDate", "declarationDate", "commissionedDate", "acceptanceDate", "ksDate",
    "createdAt", "updatedAt"
FROM "LiftObject";

-- Отметки — к лифту объекта
ALTER TABLE "StageMark" ADD COLUMN "liftId" UUID;
UPDATE "StageMark" SET "liftId" = "objectId";
ALTER TABLE "StageMark" ALTER COLUMN "liftId" SET NOT NULL;

ALTER TABLE "Claim" ADD COLUMN "liftId" UUID;

-- Поля лифта уходят из объекта
ALTER TABLE "LiftObject" DROP CONSTRAINT "LiftObject_templateId_fkey";
ALTER TABLE "LiftObject" DROP CONSTRAINT IF EXISTS "LiftObject_currentStageId_fkey";
ALTER TABLE "LiftObject" DROP COLUMN "acceptanceDate",
DROP COLUMN "capacityKg",
DROP COLUMN "commissionedDate",
DROP COLUMN "currentStageId",
DROP COLUMN "declarationDate",
DROP COLUMN "deliveryActualDate",
DROP COLUMN "deliveryPlannedDate",
DROP COLUMN "deliveryStatus",
DROP COLUMN "floors",
DROP COLUMN "ksDate",
DROP COLUMN "liftInfo",
DROP COLUMN "openedDate",
DROP COLUMN "plannedStartDate",
DROP COLUMN "ptoDate",
DROP COLUMN "templateId";

-- CreateIndex
CREATE INDEX "Lift_objectId_idx" ON "Lift"("objectId");
CREATE INDEX "Lift_brigadeId_idx" ON "Lift"("brigadeId");
CREATE INDEX "StageMark_liftId_idx" ON "StageMark"("liftId");

-- AddForeignKey
ALTER TABLE "Lift" ADD CONSTRAINT "Lift_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LiftObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lift" ADD CONSTRAINT "Lift_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lift" ADD CONSTRAINT "Lift_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "Brigade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lift" ADD CONSTRAINT "Lift_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "TemplateStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StageMark" ADD CONSTRAINT "StageMark_liftId_fkey" FOREIGN KEY ("liftId") REFERENCES "Lift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_liftId_fkey" FOREIGN KEY ("liftId") REFERENCES "Lift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
