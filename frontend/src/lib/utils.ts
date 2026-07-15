import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ThesisStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<ThesisStatus, string> = {
  POSTULATION: 'Postulación',
  ACADEMIC_VALIDATION: 'Validación Académica',
  PROPOSAL_FORM: 'Formulario de Propuesta',
  PENDING_PAYMENT: 'Pendiente de Pago',
  PAYMENT_CONFIRMED: 'Pago Confirmado',
  FACULTY_MEETING: 'Reunión con Facultad',
  DRAFT_IN_PROGRESS: 'Elaborando Anteproyecto',
  DRAFT_UNDER_REVIEW: 'Anteproyecto en Revisión',
  DRAFT_APPROVED: 'Anteproyecto Aprobado',
  ADVISOR_ASSIGNED: 'Asesor Asignado',
  WORK_STARTED: 'Trabajo Iniciado',
  IN_DEVELOPMENT: 'En Desarrollo',
  ADVANCES_SUBMITTED: 'Avances Enviados',
  ADVISOR_FEEDBACK: 'Retroalimentación',
  WORK_COMPLETED: 'Trabajo Completado',
  PRESENTATION_SCHEDULED: 'Presentación Programada',
  PRESENTATION_DONE: 'Presentación Realizada',
  GRADED: 'Calificado',
  APPROVED: 'Aprobado',
  PUBLISHED: 'Publicado',
  REJECTED: 'Rechazado',
};

export const STATUS_COLORS: Record<ThesisStatus, string> = {
  POSTULATION: 'bg-slate-100 text-slate-700',
  ACADEMIC_VALIDATION: 'bg-blue-100 text-blue-700',
  PROPOSAL_FORM: 'bg-blue-100 text-blue-700',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
  PAYMENT_CONFIRMED: 'bg-green-100 text-green-700',
  FACULTY_MEETING: 'bg-purple-100 text-purple-700',
  DRAFT_IN_PROGRESS: 'bg-orange-100 text-orange-700',
  DRAFT_UNDER_REVIEW: 'bg-orange-100 text-orange-700',
  DRAFT_APPROVED: 'bg-teal-100 text-teal-700',
  ADVISOR_ASSIGNED: 'bg-teal-100 text-teal-700',
  WORK_STARTED: 'bg-cyan-100 text-cyan-700',
  IN_DEVELOPMENT: 'bg-cyan-100 text-cyan-700',
  ADVANCES_SUBMITTED: 'bg-indigo-100 text-indigo-700',
  ADVISOR_FEEDBACK: 'bg-indigo-100 text-indigo-700',
  WORK_COMPLETED: 'bg-emerald-100 text-emerald-700',
  PRESENTATION_SCHEDULED: 'bg-violet-100 text-violet-700',
  PRESENTATION_DONE: 'bg-violet-100 text-violet-700',
  GRADED: 'bg-pink-100 text-pink-700',
  APPROVED: 'bg-green-100 text-green-800 font-semibold',
  PUBLISHED: 'bg-green-200 text-green-900 font-bold',
  REJECTED: 'bg-red-100 text-red-700',
};

export const STATUS_STEP: Record<ThesisStatus, number> = {
  POSTULATION: 1, ACADEMIC_VALIDATION: 2, PROPOSAL_FORM: 3,
  PENDING_PAYMENT: 4, PAYMENT_CONFIRMED: 5, FACULTY_MEETING: 6,
  DRAFT_IN_PROGRESS: 7, DRAFT_UNDER_REVIEW: 8, DRAFT_APPROVED: 9,
  ADVISOR_ASSIGNED: 10, WORK_STARTED: 11, IN_DEVELOPMENT: 12,
  ADVANCES_SUBMITTED: 13, ADVISOR_FEEDBACK: 14, WORK_COMPLETED: 15,
  PRESENTATION_SCHEDULED: 16, PRESENTATION_DONE: 17,
  GRADED: 18, APPROVED: 19, PUBLISHED: 20, REJECTED: 0,
};

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    ...opts,
  }).format(new Date(date));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}
