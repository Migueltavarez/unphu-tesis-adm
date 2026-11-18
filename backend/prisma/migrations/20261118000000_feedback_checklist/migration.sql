-- CreateEnum
CREATE TYPE "FeedbackSeverity" AS ENUM ('MINOR', 'MAJOR', 'BLOCKING');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('CONTENT', 'METHODOLOGY', 'STRUCTURE', 'WRITING', 'FORMAT', 'REFERENCES', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'RESOLVED', 'VERIFIED');

-- AlterTable
ALTER TABLE "advance_comments" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "feedback_items" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "advanceId" TEXT,
    "authorId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'CONTENT',
    "severity" "FeedbackSeverity" NOT NULL DEFAULT 'MAJOR',
    "text" TEXT NOT NULL,
    "location" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "studentNote" TEXT,
    "advisorNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_items_thesisWorkId_status_idx" ON "feedback_items"("thesisWorkId", "status");

-- CreateIndex
CREATE INDEX "feedback_items_advanceId_idx" ON "feedback_items"("advanceId");

-- AddForeignKey
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "advances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

