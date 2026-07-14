-- Rozbicie pojedynczej kolumny "tax" na "vat" (podatek VAT) i "pit" (podatek dochodowy PIT).
-- Stara wartość "tax" traktowana jako PIT; VAT = 0 (brak danych historycznych).

ALTER TABLE "income_records" ADD COLUMN "vat" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "income_records" ADD COLUMN "pit" DECIMAL NOT NULL DEFAULT 0;

-- Zachowanie danych: stary "tax" → "pit".
UPDATE "income_records" SET "pit" = "tax";

ALTER TABLE "income_records" DROP COLUMN "tax";
