// ─── Enums ───────────────────────────────────────────────────

export type UserRole = 'STUDENT' | 'ADVISOR' | 'COORDINATOR' | 'ADMIN' | 'EVALUATOR' | 'DIRECTOR' | 'REGISTRO' | 'COBROS' | 'JURADO';
export type WorkType = 'TESIS' | 'MONOGRAFICO';
export type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';
export type AdvanceStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'NEEDS_REVISION';
export type DocumentType = 'PROPOSAL' | 'RECEIPT' | 'DRAFT' | 'FINAL_WORK' | 'PRESENTATION' | 'CERTIFICATE' | 'OTHER';

export type ThesisStatus =
  | 'POSTULATION'
  | 'ACADEMIC_VALIDATION'
  | 'PROPOSAL_FORM'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_CONFIRMED'
  | 'FACULTY_MEETING'
  | 'DRAFT_IN_PROGRESS'
  | 'DRAFT_UNDER_REVIEW'
  | 'DRAFT_APPROVED'
  | 'ADVISOR_ASSIGNED'
  | 'WORK_STARTED'
  | 'IN_DEVELOPMENT'
  | 'ADVANCES_SUBMITTED'
  | 'ADVISOR_FEEDBACK'
  | 'WORK_COMPLETED'
  | 'PRESENTATION_SCHEDULED'
  | 'PRESENTATION_DONE'
  | 'GRADED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED';

// ─── Modelos ─────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  student?: Student;
  advisor?: Advisor;
}

export interface Career {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  _count?: { students: number; thesisWorks: number };
}

export interface Student {
  id: string;
  userId: string;
  matricula: string;
  careerId: string;
  career?: Career;
  enrollmentYear: number;
  creditsApproved: number;
  gpa?: number;
  isEligible: boolean;
  user?: Pick<User, 'firstName' | 'lastName' | 'email' | 'phone'>;
  thesisWorks?: ThesisWork[];
}

export interface Advisor {
  id: string;
  userId: string;
  department?: string;
  specialties: string[];
  maxWorkload: number;
  user?: Pick<User, 'firstName' | 'lastName' | 'email'>;
}

export interface ThesisWork {
  id: string;
  studentId: string;
  advisorId?: string;
  careerId: string;
  title: string;
  type: WorkType;
  status: ThesisStatus;
  abstract?: string;
  keywords: string[];
  year?: number;
  submittedAt: string;
  approvedAt?: string;
  publishedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  student?: Student;
  advisor?: Advisor;
  career?: Career;
  payment?: Payment;
  draft?: Draft;
  advances?: Advance[];
  documents?: Document[];
  presentation?: Presentation;
  grades?: Grade[];
  statusHistory?: StatusHistory[];
  _count?: { advances: number; documents: number };
}

export interface Payment {
  id: string;
  thesisWorkId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  receiptUrl?: string;
  receiptFileName?: string;
  confirmedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
}

export interface Draft {
  id: string;
  thesisWorkId: string;
  title: string;
  introduction?: string;
  justification?: string;
  objectives?: string;
  methodology?: string;
  timeline?: string;
  bibliography?: string;
  fileUrl?: string;
  fileName?: string;
  version: number;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface Advance {
  id: string;
  thesisWorkId: string;
  version: number;
  title: string;
  description: string;
  fileUrl?: string;
  fileName?: string;
  status: AdvanceStatus;
  submittedAt: string;
  reviewedAt?: string;
  comments?: AdvanceComment[];
}

export interface AdvanceComment {
  id: string;
  advanceId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Presentation {
  id: string;
  thesisWorkId: string;
  scheduledAt: string;
  location?: string;
  virtualLink?: string;
  juryMembers: string[];
  completed: boolean;
  completedAt?: string;
  grades?: Grade[];
}

export interface Grade {
  id: string;
  evaluatorName: string;
  writtenGrade?: number;
  oralGrade?: number;
  finalGrade?: number;
  approved?: boolean;
  observations?: string;
}

export interface Document {
  id: string;
  type: DocumentType;
  name: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  isPublic: boolean;
  createdAt: string;
}

export interface StatusHistory {
  id: string;
  fromStatus?: ThesisStatus;
  toStatus: ThesisStatus;
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  metadata?: any;
}

// ─── API helpers ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
