-- Dodaje kolumnę „type" do pozycji wydatków: „expense" (zwykły) | „adjustment" (wyrównanie).
-- Wyrównanie ma znak odwrócony względem wydatku (ujemne zwiększa wydatki, dodatnie zmniejsza).
ALTER TABLE "income_expenses" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'expense';

-- Backfill: dotychczas zaimportowane linie z ujemną kwotą mogły pochodzić tylko z wyrównań
-- (zwykłe wydatki są wymuszane dodatnie przy imporcie) → oznacz jako „adjustment".
UPDATE "income_expenses" SET "type" = 'adjustment' WHERE "amount" < 0;
