-- Подъезд лифта. Названия вида «Подъезд N» переносятся в подъезд.
ALTER TABLE "Lift" ADD COLUMN "entrance" TEXT NOT NULL DEFAULT '';

UPDATE "Lift" SET "entrance" = "name", "name" = ''
WHERE "name" ~* '^подъезд\s*\d+$';
