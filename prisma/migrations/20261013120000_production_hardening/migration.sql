-- Refresh tokens are now stored as SHA-256 hashes; drop the old plaintext ones
-- (every user signs in again once after this deploy).
DELETE FROM "RefreshToken";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "containerTrackingCode" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TrackingEvent" ALTER COLUMN "containerTrackingCode" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "InventoryMovement_listingId_createdAt_idx" ON "InventoryMovement"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE INDEX "Listing_trimId_mode_idx" ON "Listing"("trimId", "mode");

-- CreateIndex
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");

-- CreateIndex
CREATE INDEX "Order_listingId_idx" ON "Order"("listingId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "SupplierOffer_supplierId_idx" ON "SupplierOffer"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierOffer_trimId_idx" ON "SupplierOffer"("trimId");

-- CreateIndex
CREATE INDEX "TrackingEvent_orderId_idx" ON "TrackingEvent"("orderId");

-- CreateIndex
CREATE INDEX "rentals_carId_startDate_endDate_idx" ON "rentals"("carId", "startDate", "endDate");

