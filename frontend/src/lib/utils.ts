import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ThesisStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<ThesisStatus, string> = {
  POSTULATION:          'Postulación',
  ACADEMIC_VALIDATION:  'Validación Académica',
  PROPOSAL_FORM:        'Formulario de Propuesta',
  PROPOSAL_REVIEW:      'Revisión de Propuesta',
  PROPOSAL_APPROVED:    'Propuesta Aprobada',
  REGISTRO_PROCESSING:  'En Proceso – Registro',
  REGISTERED:           'Registrado',
  COBROS_PROCESSING:    'En Cobros',
  CAJA_PENDING:         'Pendiente de Caja',
  PAYMENT_CONFIRMED:    'Pago Confirmado',
  FACULTY_MEETING:      'Reunión con Facultad',
  DRAFT_IN_PROGRESS:    'Elaborando Anteproyecto',
  DRAFT_UNDER_REVIEW:   'Anteproyecto en Revisión',
  DRAFT_APPROVED:       'Anteproyecto Aprobado',
  ADVISOR_ASSIGNED:     'Asesor Asignado',
  WORK_STARTED:         'Trabajo Iniciado',
  IN_DEVELOPMENT:       'En Desarrollo',
  ADVANCES_SUBMITTED:   'Avances Enviados',
  ADVISOR_FEEDBACK:     'Retroalimentación del Asesor',
  WORK_COMPLETED:       'Trabajo Completado',
  PRESENTATION_SCHEDULED: 'Presentación Programada',
  PRESENTATION_DONE:    'Presentación Realizada',
  GRADED:               'Calificado',
  APPROVED:             'Aprobado',
  PUBLISHED:            'Publicado',
  REJECTED:             'Rechazado',
  PENDING_PAYMENT:      'Pendiente de Pago',
};

export const STATUS_COLORS: Record<ThesisStatus, string> = {
  POSTULATION:          'bg-slate-100 text-slate-700',
  ACADEMIC_VALIDATION:  'bg-blue-100 text-blue-700',
  PROPOSAL_FORM:        'bg-blue-100 text-blue-700',
  PROPOSAL_REVIEW:      'bg-amber-100 text-amber-700',
  PROPOSAL_APPROVED:    'bg-lime-100 text-lime-700',
  REGISTRO_PROCESSING:  'bg-sky-100 text-sky-700',
  REGISTERED:           'bg-sky-200 text-sky-800',
  COBROS_PROCESSING:    'bg-yellow-100 text-yellow-700',
  CAJA_PENDING:         'bg-orange-100 text-orange-700',
  PAYMENT_CONFIRMED:    'bg-green-100 text-green-700',
  FACULTY_MEETING:      'bg-purple-100 text-purple-700',
  DRAFT_IN_PROGRESS:    'bg-orange-100 text-orange-700',
  DRAFT_UNDER_REVIEW:   'bg-orange-200 text-orange-800',
  DRAFT_APPROVED:       'bg-teal-100 text-teal-700',
  ADVISOR_ASSIGNED:     'bg-teal-100 text-teal-700',
  WORK_STARTED:         'bg-cyan-100 text-cyan-700',
  IN_DEVELOPMENT:       'bg-cyan-100 text-cyan-700',
  ADVANCES_SUBMITTED:   'bg-indigo-100 text-indigo-700',
  ADVISOR_FEEDBACK:     'bg-indigo-100 text-indigo-700',
  WORK_COMPLETED:       'bg-emerald-100 text-emerald-700',
  PRESENTATION_SCHEDULED: 'bg-violet-100 text-violet-700',
  PRESENTATION_DONE:    'bg-violet-100 text-violet-700',
  GRADED:               'bg-pink-100 text-pink-700',
  APPROVED:             'bg-green-100 text-green-800 font-semibold',
  PUBLISHED:            'bg-green-200 text-green-900 font-bold',
  REJECTED:             'bg-red-100 text-red-700',
  PENDING_PAYMENT:      'bg-yellow-100 text-yellow-700',
};

export const STATUS_STEP: Record<ThesisStatus, number> = {
  POSTULATION: 1,          ACADEMIC_VALIDATION: 2,   PROPOSAL_FORM: 3,
  PROPOSAL_REVIEW: 4,      PROPOSAL_APPROVED: 5,     REGISTRO_PROCESSING: 6,
  REGISTERED: 7,           COBROS_PROCESSING: 8,     CAJA_PENDING: 9,
  PAYMENT_CONFIRMED: 10,   FACULTY_MEETING: 11,      DRAFT_IN_PROGRESS: 12,
  DRAFT_UNDER_REVIEW: 13,  DRAFT_APPROVED: 14,       ADVISOR_ASSIGNED: 15,
  WORK_STARTED: 16,        IN_DEVELOPMENT: 17,       ADVANCES_SUBMITTED: 18,
  ADVISOR_FEEDBACK: 19,    WORK_COMPLETED: 20,       PRESENTATION_SCHEDULED: 21,
  PRESENTATION_DONE: 22,   GRADED: 23,               APPROVED: 24,
  PUBLISHED: 25,           REJECTED: 0,              PENDING_PAYMENT: 0,
};

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  // dateStyle no puede combinarse con opciones granulares (weekday, year, hour, etc.)
  // per spec de Intl.DateTimeFormat — si el caller pasa sus propias opciones, se usan solas.
  return new Intl.DateTimeFormat('es-DO', opts ?? { dateStyle: 'medium' }).format(new Date(date));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}
