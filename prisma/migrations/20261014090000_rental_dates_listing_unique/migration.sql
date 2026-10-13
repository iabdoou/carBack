-- Rentals book whole calendar days. Older rows were stored as timestamps
-- (local midnight in Algeria = 23:00 UTC the day before), so convert them to
-- the Algerian calendar date they were meant to be.
ALTER TABLE "rentals"
  ALTER COLUMN "startDate" SET DATA TYPE DATE USING (("startDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Algiers')::date,
  ALTER COLUMN "endDate" SET DATA TYPE DATE USING (("endDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Algiers')::date;

-- Deleting a car must not erase its rental history
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_carId_fkey";
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Emails are compared case-insensitively; store them normalized
UPDATE "User" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));

-- One listing per trim and mode (fails if duplicates exist; merge them first)
DROP INDEX "Listing_trimId_mode_idx";
CREATE UNIQUE INDEX "Listing_trimId_mode_key" ON "Listing"("trimId", "mode");
