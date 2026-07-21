-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN', 'EVALUATOR', 'DIRECTOR', 'REGISTRO', 'COBROS', 'CAJA', 'JURADO');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('TESIS', 'MONOGRAFICO');

-- CreateEnum
CREATE TYPE "ThesisStatus" AS ENUM ('POSTULATION', 'ACADEMIC_VALIDATION', 'PROPOSAL_FORM', 'PROPOSAL_REVIEW', 'PROPOSAL_APPROVED', 'REGISTRO_PROCESSING', 'REGISTERED', 'COBROS_PROCESSING', 'CAJA_PENDING', 'PAYMENT_CONFIRMED', 'FACULTY_MEETING', 'DRAFT_IN_PROGRESS', 'DRAFT_UNDER_REVIEW', 'DRAFT_APPROVED', 'ADVISOR_ASSIGNED', 'WORK_STARTED', 'IN_DEVELOPMENT', 'ADVANCES_SUBMITTED', 'ADVISOR_FEEDBACK', 'WORK_COMPLETED', 'PRESENTATION_SCHEDULED', 'PRESENTATION_DONE', 'GRADED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'PENDING_PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PROPOSAL', 'RECEIPT', 'DRAFT', 'FINAL_WORK', 'PRESENTATION', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'STATUS_CHANGE', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'PAYMENT_CONFIRM');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_AI', 'PENDING_REVIEW', 'RETURNED', 'APPROVED', 'BLOCKED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('PARAGRAPH', 'HEADING', 'BULLETLIST', 'ORDEREDLIST', 'TABLE', 'IMAGE', 'CODE', 'BLOCKQUOTE', 'DIVIDER', 'CALLOUT', 'EQUATION', 'MERMAID', 'FIGURE', 'FOOTNOTE', 'CITATION', 'REFERENCE_LIST', 'TOC', 'EMBED', 'VIDEO', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "CitationStyle" AS ENUM ('APA7', 'IEEE', 'CHICAGO', 'MLA', 'VANCOUVER', 'HARVARD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "enrollmentYear" INTEGER NOT NULL,
    "creditsApproved" INTEGER NOT NULL DEFAULT 0,
    "gpa" DOUBLE PRECISION,
    "isEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "department" TEXT,
    "specialties" TEXT[],
    "maxWorkload" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thesis_works" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "advisorId" TEXT,
    "careerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "WorkType" NOT NULL,
    "status" "ThesisStatus" NOT NULL DEFAULT 'POSTULATION',
    "abstract" TEXT,
    "keywords" TEXT[],
    "year" INTEGER,
    "firma" TEXT,
    "definitiveTopic" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thesis_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "fromStatus" "ThesisStatus",
    "toStatus" "ThesisStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'DOP',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "receiptUrl" TEXT,
    "receiptFileName" TEXT,
    "amountSetById" TEXT,
    "amountSetAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "introduction" TEXT,
    "justification" TEXT,
    "objectives" TEXT,
    "methodology" TEXT,
    "timeline" TEXT,
    "bibliography" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advances" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_comments" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "virtualLink" TEXT,
    "agenda" TEXT,
    "notes" TEXT,
    "attendees" TEXT[],
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentations" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "virtualLink" TEXT,
    "juryMembers" TEXT[],
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "presentationId" TEXT,
    "evaluatorId" TEXT NOT NULL,
    "evaluatorName" TEXT NOT NULL,
    "writtenGrade" DOUBLE PRECISION,
    "oralGrade" DOUBLE PRECISION,
    "finalGrade" DOUBLE PRECISION,
    "approved" BOOLEAN,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderRole" "UserRole" NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thesis_documents" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'THESIS',
    "title" TEXT NOT NULL,
    "citationStyle" "CitationStyle" NOT NULL DEFAULT 'APA7',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thesis_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_nodes" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "parentId" TEXT,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL DEFAULT 'section',
    "status" "NodeStatus" NOT NULL DEFAULT 'DRAFT',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_status_history" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "fromStatus" "NodeStatus",
    "toStatus" "NodeStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_comments" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "blockId" TEXT,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "mentions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" "BlockType" NOT NULL DEFAULT 'PARAGRAPH',
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "authorId" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_versions" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "diff" JSONB,
    "authorId" TEXT NOT NULL,
    "message" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_versions" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL,
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_relations" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relType" TEXT NOT NULL DEFAULT 'DERIVED_FROM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_events" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "docType" TEXT NOT NULL DEFAULT 'THESIS',
    "careerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_nodes" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "parentId" TEXT,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL DEFAULT 'section',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "template_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerifyToken_key" ON "users"("emailVerifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetPasswordToken_key" ON "users"("resetPasswordToken");

-- CreateIndex
CREATE UNIQUE INDEX "careers_name_key" ON "careers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "careers_code_key" ON "careers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "students_matricula_key" ON "students"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "advisors_userId_key" ON "advisors"("userId");

-- CreateIndex
CREATE INDEX "thesis_works_status_idx" ON "thesis_works"("status");

-- CreateIndex
CREATE INDEX "thesis_works_studentId_idx" ON "thesis_works"("studentId");

-- CreateIndex
CREATE INDEX "thesis_works_advisorId_idx" ON "thesis_works"("advisorId");

-- CreateIndex
CREATE INDEX "thesis_works_careerId_idx" ON "thesis_works"("careerId");

-- CreateIndex
CREATE INDEX "thesis_works_status_careerId_idx" ON "thesis_works"("status", "careerId");

-- CreateIndex
CREATE INDEX "status_history_thesisWorkId_idx" ON "status_history"("thesisWorkId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_thesisWorkId_key" ON "payments"("thesisWorkId");

-- CreateIndex
CREATE UNIQUE INDEX "drafts_thesisWorkId_key" ON "drafts"("thesisWorkId");

-- CreateIndex
CREATE INDEX "advances_thesisWorkId_idx" ON "advances"("thesisWorkId");

-- CreateIndex
CREATE UNIQUE INDEX "presentations_thesisWorkId_key" ON "presentations"("thesisWorkId");

-- CreateIndex
CREATE INDEX "grades_thesisWorkId_idx" ON "grades"("thesisWorkId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "messages_thesisWorkId_idx" ON "messages"("thesisWorkId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "thesis_documents_thesisWorkId_docType_key" ON "thesis_documents"("thesisWorkId", "docType");

-- CreateIndex
CREATE INDEX "document_nodes_documentId_idx" ON "document_nodes"("documentId");

-- CreateIndex
CREATE INDEX "document_nodes_parentId_idx" ON "document_nodes"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "block_versions_blockId_versionNum_key" ON "block_versions"("blockId", "versionNum");

-- CreateIndex
CREATE UNIQUE INDEX "node_versions_nodeId_versionNum_key" ON "node_versions"("nodeId", "versionNum");

-- CreateIndex
CREATE INDEX "doc_events_aggregateId_aggregateType_idx" ON "doc_events"("aggregateId", "aggregateType");

-- CreateIndex
CREATE INDEX "template_nodes_templateId_idx" ON "template_nodes"("templateId");

-- CreateIndex
CREATE INDEX "template_nodes_parentId_idx" ON "template_nodes"("parentId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "careers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisors" ADD CONSTRAINT "advisors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thesis_works" ADD CONSTRAINT "thesis_works_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thesis_works" ADD CONSTRAINT "thesis_works_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "advisors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thesis_works" ADD CONSTRAINT "thesis_works_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "careers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_comments" ADD CONSTRAINT "advance_comments_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_comments" ADD CONSTRAINT "advance_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thesis_documents" ADD CONSTRAINT "thesis_documents_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_nodes" ADD CONSTRAINT "document_nodes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "thesis_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_nodes" ADD CONSTRAINT "document_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "document_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_status_history" ADD CONSTRAINT "node_status_history_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "document_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_comments" ADD CONSTRAINT "node_comments_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "document_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_comments" ADD CONSTRAINT "node_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "node_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "document_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_versions" ADD CONSTRAINT "block_versions_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_versions" ADD CONSTRAINT "node_versions_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "document_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_relations" ADD CONSTRAINT "node_relations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "document_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_relations" ADD CONSTRAINT "node_relations_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "document_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "careers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_nodes" ADD CONSTRAINT "template_nodes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_nodes" ADD CONSTRAINT "template_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "template_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

