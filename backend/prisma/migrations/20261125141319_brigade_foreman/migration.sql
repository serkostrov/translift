-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_brigadeId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "brigadeId";

-- CreateIndex
CREATE UNIQUE INDEX "Brigade_foremanId_key" ON "Brigade"("foremanId");

