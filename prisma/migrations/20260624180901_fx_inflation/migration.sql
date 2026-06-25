-- CreateTable
CREATE TABLE "fx_rates" (
    "currency" TEXT NOT NULL,
    "rateDate" DATETIME NOT NULL,
    "rateToPln" DECIMAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'NBP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "macro_inflation" (
    "month" DATETIME NOT NULL,
    "cpiMonthlyIndex" DECIMAL NOT NULL,
    "cumulativeIndex" DECIMAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'GUS',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "fx_rates_currency_rateDate_idx" ON "fx_rates"("currency", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_currency_rateDate_source_key" ON "fx_rates"("currency", "rateDate", "source");

-- CreateIndex
CREATE UNIQUE INDEX "macro_inflation_month_key" ON "macro_inflation"("month");
