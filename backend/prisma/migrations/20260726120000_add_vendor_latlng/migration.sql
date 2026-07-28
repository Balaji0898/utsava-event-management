-- AlterTable: coordinates for "near me" proximity search
ALTER TABLE "Vendor" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Vendor" ADD COLUMN "longitude" DOUBLE PRECISION;
