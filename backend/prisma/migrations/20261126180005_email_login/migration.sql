-- Вход только по почте: у кого почты нет — почта из логина (так договорились для текущих данных)
UPDATE "User" SET "email" = lower("login") || '@user.ru' WHERE "email" IS NULL;
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
DROP INDEX IF EXISTS "User_login_key";
ALTER TABLE "User" DROP COLUMN "login";
