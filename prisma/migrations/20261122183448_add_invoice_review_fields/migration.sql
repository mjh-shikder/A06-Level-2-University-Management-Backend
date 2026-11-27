-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewReason" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_needsReview_idx" ON "Invoice"("needsReview");
