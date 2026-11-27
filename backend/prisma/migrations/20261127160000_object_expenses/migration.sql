-- Финансы: сумма договора, закрытые работы, оплата + список расходов.
-- «Стоимость оборудования от завода» становится расходом, «стоимость для заказчика» —
-- суммой договора, если та не заполнена.

CREATE TYPE "ExpenseKind" AS ENUM ('EQUIPMENT', 'WORKS', 'OTHER');

CREATE TABLE "ObjectExpense" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "kind" "ExpenseKind" NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "authorId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectExpense_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ObjectExpense" ("id", "objectId", "kind", "title", "amount", "date")
SELECT gen_random_uuid(), "objectId", 'EQUIPMENT', 'Оборудование от завода', "equipmentCost",
       COALESCE("updatedAt"::date, CURRENT_DATE)
FROM "ObjectFinance"
WHERE "equipmentCost" IS NOT NULL AND "equipmentCost" > 0;

UPDATE "ObjectFinance" SET "contractAmount" = "customerPrice"
WHERE "contractAmount" IS NULL AND "customerPrice" IS NOT NULL;

ALTER TABLE "ObjectFinance" DROP COLUMN "customerPrice",
DROP COLUMN "equipmentCost";

CREATE INDEX "ObjectExpense_objectId_date_idx" ON "ObjectExpense"("objectId", "date");

ALTER TABLE "ObjectExpense" ADD CONSTRAINT "ObjectExpense_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LiftObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObjectExpense" ADD CONSTRAINT "ObjectExpense_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
