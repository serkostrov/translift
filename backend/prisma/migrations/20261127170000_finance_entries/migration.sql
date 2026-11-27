-- Расходы, платежи и доп. соглашения — одним журналом денег объекта.
-- «Поступившая оплата» одной суммой становится платежом.

CREATE TYPE "FinanceEntryType" AS ENUM ('PAYMENT', 'AGREEMENT', 'EXPENSE');

ALTER TABLE "ObjectExpense" RENAME TO "FinanceEntry";
ALTER TABLE "FinanceEntry" RENAME CONSTRAINT "ObjectExpense_pkey" TO "FinanceEntry_pkey";
ALTER TABLE "FinanceEntry" RENAME CONSTRAINT "ObjectExpense_objectId_fkey" TO "FinanceEntry_objectId_fkey";
ALTER TABLE "FinanceEntry" RENAME CONSTRAINT "ObjectExpense_authorId_fkey" TO "FinanceEntry_authorId_fkey";
ALTER INDEX "ObjectExpense_objectId_date_idx" RENAME TO "FinanceEntry_objectId_date_idx";

ALTER TABLE "FinanceEntry" ADD COLUMN "type" "FinanceEntryType" NOT NULL DEFAULT 'EXPENSE';
ALTER TABLE "FinanceEntry" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "FinanceEntry" ALTER COLUMN "kind" DROP NOT NULL;

INSERT INTO "FinanceEntry" ("id", "objectId", "type", "title", "amount", "date")
SELECT gen_random_uuid(), "objectId", 'PAYMENT', 'Оплата (перенесено из прежних финансов)',
       "paidAmount", COALESCE("updatedAt"::date, CURRENT_DATE)
FROM "ObjectFinance"
WHERE "paidAmount" IS NOT NULL AND "paidAmount" > 0;

ALTER TABLE "ObjectFinance" DROP COLUMN "paidAmount";
