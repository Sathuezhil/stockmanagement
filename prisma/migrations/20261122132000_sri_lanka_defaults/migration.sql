ALTER TABLE "CompanySettings" ALTER COLUMN "companyName" SET DEFAULT 'StockPro Trading (Pvt) Ltd';
ALTER TABLE "CompanySettings" ALTER COLUMN "currency" SET DEFAULT 'LKR';
ALTER TABLE "CompanySettings" ALTER COLUMN "taxRate" SET DEFAULT 18;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS product_name_trgm ON "Product" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_sku_trgm ON "Product" USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_barcode_trgm ON "Product" USING gin (barcode gin_trgm_ops);
