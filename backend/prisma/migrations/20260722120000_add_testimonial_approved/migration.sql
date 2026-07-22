-- AlterTable: add approval flag for public testimonial submissions
ALTER TABLE "Testimonial" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;

-- Keep already-seeded/existing testimonials visible on the public site
UPDATE "Testimonial" SET "approved" = true;

-- CreateIndex
CREATE INDEX "Testimonial_approved_status_sortOrder_idx" ON "Testimonial"("approved", "status", "sortOrder");
