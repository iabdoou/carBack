-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "containerTrackingCode" TEXT DEFAULT 'EGSU6241911',
ADD COLUMN     "lastTrackedTime" TIMESTAMP(3),
ADD COLUMN     "trackedData" JSONB;
