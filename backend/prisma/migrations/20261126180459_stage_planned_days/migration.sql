-- Плановая длительность этапа в днях: из неё и планового начала считаются даты этапов объекта
ALTER TABLE "TemplateStage" ADD COLUMN "plannedDays" INTEGER NOT NULL DEFAULT 0;

-- Стартовые оценки для этапов замены лифта (по порядку). Итого 64 дня.
-- TODO(заказчик): уточнить длительности, администратор правит их в «Справочники → Этапы»
UPDATE "TemplateStage" SET "plannedDays" = CASE "order"
  WHEN 1 THEN 2 WHEN 2 THEN 5 WHEN 3 THEN 5 WHEN 4 THEN 4 WHEN 5 THEN 2 WHEN 6 THEN 3
  WHEN 7 THEN 5 WHEN 8 THEN 3 WHEN 9 THEN 2 WHEN 10 THEN 4 WHEN 11 THEN 7 WHEN 12 THEN 10
  WHEN 13 THEN 5 WHEN 14 THEN 7 ELSE 0 END;
