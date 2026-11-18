-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('PENDING_ADVISOR', 'PENDING_COORDINATOR', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "extension_requests" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "approvedDays" INTEGER,
    "reason" TEXT NOT NULL,
    "documentId" TEXT,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'PENDING_ADVISOR',
    "advisorUserId" TEXT,
    "advisorNote" TEXT,
    "advisorDecidedAt" TIMESTAMP(3),
    "coordinatorUserId" TEXT,
    "coordinatorNote" TEXT,
    "coordinatorDecidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_changes" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "fromAdvisorId" TEXT,
    "toAdvisorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extension_requests_thesisWorkId_idx" ON "extension_requests"("thesisWorkId");

-- CreateIndex
CREATE INDEX "extension_requests_status_idx" ON "extension_requests"("status");

-- CreateIndex
CREATE INDEX "advisor_changes_thesisWorkId_idx" ON "advisor_changes"("thesisWorkId");

-- AddForeignKey
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_changes" ADD CONSTRAINT "advisor_changes_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_changes" ADD CONSTRAINT "advisor_changes_fromAdvisorId_fkey" FOREIGN KEY ("fromAdvisorId") REFERENCES "advisors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_changes" ADD CONSTRAINT "advisor_changes_toAdvisorId_fkey" FOREIGN KEY ("toAdvisorId") REFERENCES "advisors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

