import { FeedbackCategory, FeedbackSeverity, FeedbackStatus } from '@/types';

export const SEVERITY: Record<FeedbackSeverity, { label: string; hint: string; pill: string }> = {
  BLOCKING: { label: 'Bloqueante', hint: 'Impide aprobar el avance', pill: 'bg-red-50 text-red-700 ring-red-200' },
  MAJOR:    { label: 'Importante', hint: 'Debe corregirse',          pill: 'bg-amber-50 text-amber-800 ring-amber-200' },
  MINOR:    { label: 'Menor',      hint: 'Sugerencia',               pill: 'bg-gray-50 text-gray-600 ring-gray-200' },
};
export const SEVERITY_ORDER: FeedbackSeverity[] = ['BLOCKING', 'MAJOR', 'MINOR'];

export const CATEGORY: Record<FeedbackCategory, string> = {
  CONTENT: 'Contenido',
  METHODOLOGY: 'Metodología',
  STRUCTURE: 'Estructura',
  WRITING: 'Redacción',
  FORMAT: 'Formato',
  REFERENCES: 'Referencias',
  OTHER: 'Otro',
};

export const FEEDBACK_STATUS: Record<FeedbackStatus, string> = {
  OPEN: 'Por resolver',
  RESOLVED: 'Por verificar',
  VERIFIED: 'Verificadas',
};
