-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "SupplierOffer_status_idx" ON "SupplierOffer"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
