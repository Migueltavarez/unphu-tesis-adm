import { ThesisStatus } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Fuente única de verdad de la guía del estudiante.
// Traduce los 26 estados internos a 6 fases legibles + UN solo mensaje de
// "qué sigue": o una acción concreta (CTA) que le toca al estudiante, o una
// nota de "esperando" cuando el turno es de otro rol.
// ─────────────────────────────────────────────────────────────────────────────

export const STUDENT_PHASES = [
  'Propuesta',
  'Registro y pago',
  'Anteproyecto',
  'Desarrollo',
  'Defensa',
  'Publicado',
] as const;

export type PhaseIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface StudentGuidance {
  phase: PhaseIndex;          // 0..5 para el stepper
  title: string;              // qué pasa / qué hacer, en una línea
  description: string;        // detalle breve
  /** Acción del estudiante ahora. Si no hay, es turno de otro rol. */
  action?: { label: string; href: string };
  /** Quién tiene el turno cuando el estudiante solo espera. */
  waitingOn?: string;
  tone: 'action' | 'waiting' | 'success' | 'rejected';
}

export function getStudentGuidance(status: ThesisStatus, workId: string): StudentGuidance {
  const proposal = `/dashboard/student/proposal/${workId}`;
  const advances = '/dashboard/student/advances';
  const editor = '/dashboard/student/document';
  const payment = '/dashboard/student/payment';
  const thesis = '/dashboard/student/thesis';

  switch (status) {
    // ── Fase 1: Propuesta ────────────────────────────────────────────────────
    case 'POSTULATION':
    case 'PROPOSAL_FORM':
      return {
        phase: 0, tone: 'action',
        title: 'Completa y firma tu formulario de propuesta',
        description: 'Revisa tus datos, firma y envía la propuesta a Coordinación para su revisión.',
        action: { label: 'Completar propuesta', href: proposal },
      };
    case 'ACADEMIC_VALIDATION':
      return {
        phase: 0, tone: 'waiting',
        title: 'Validando tu elegibilidad académica',
        description: 'Coordinación está revisando que cumplas los requisitos para postularte.',
        waitingOn: 'Coordinación',
      };
    case 'PROPOSAL_REVIEW':
      return {
        phase: 0, tone: 'waiting',
        title: 'Tu propuesta está en revisión',
        description: 'Coordinación revisa tu formulario de propuesta. Te avisaremos cuando haya respuesta.',
        waitingOn: 'Coordinación',
      };
    case 'PROPOSAL_APPROVED':
      return {
        phase: 0, tone: 'waiting',
        title: 'Propuesta aprobada',
        description: 'Tu propuesta fue aprobada y avanza hacia el Departamento de Registro.',
        waitingOn: 'Coordinación',
      };

    // ── Fase 2: Registro y pago ──────────────────────────────────────────────
    case 'REGISTRO_PROCESSING':
      return {
        phase: 1, tone: 'waiting',
        title: 'El Dpto. de Registro está procesando tu trabajo',
        description: 'Registro verifica y da de alta tu expediente en su sistema.',
        waitingOn: 'Dpto. de Registro',
      };
    case 'REGISTERED':
      return {
        phase: 1, tone: 'waiting',
        title: 'Registrado — esperando el monto de inscripción',
        description: 'El Dpto. de Cobros calculará el monto que debes pagar.',
        waitingOn: 'Dpto. de Cobros',
      };
    case 'COBROS_PROCESSING':
      return {
        phase: 1, tone: 'waiting',
        title: 'Calculando tu monto de inscripción',
        description: 'Cobros está fijando el monto. En breve podrás realizar el pago.',
        waitingOn: 'Dpto. de Cobros',
      };
    case 'CAJA_PENDING':
      return {
        phase: 1, tone: 'action',
        title: 'Realiza el pago de tu inscripción',
        description: 'Ya tienes un monto asignado. Consúltalo y realiza el pago en Caja.',
        action: { label: 'Ver monto y pago', href: payment },
      };
    case 'PAYMENT_CONFIRMED':
      return {
        phase: 1, tone: 'waiting',
        title: 'Pago confirmado',
        description: 'Caja confirmó tu pago. Coordinación coordinará la reunión con la facultad.',
        waitingOn: 'Coordinación',
      };

    // ── Fase 3: Anteproyecto ─────────────────────────────────────────────────
    case 'FACULTY_MEETING':
      return {
        phase: 2, tone: 'waiting',
        title: 'Coordinando la reunión con la facultad',
        description: 'Se está agendando la reunión con el Director para definir tu tema.',
        waitingOn: 'Coordinación',
      };
    case 'DRAFT_IN_PROGRESS':
      return {
        phase: 2, tone: 'action',
        title: 'Desarrolla tu anteproyecto',
        description: 'Redacta tu anteproyecto en el editor de tesis. Cuando esté listo se enviará a revisión.',
        action: { label: 'Abrir editor de tesis', href: editor },
      };
    case 'DRAFT_UNDER_REVIEW':
      return {
        phase: 2, tone: 'waiting',
        title: 'El Director está revisando tu anteproyecto',
        description: 'Dirección Académica evalúa tu anteproyecto y podría pedir correcciones.',
        waitingOn: 'Dirección Académica',
      };
    case 'DRAFT_APPROVED':
      return {
        phase: 2, tone: 'waiting',
        title: 'Anteproyecto aprobado',
        description: 'Coordinación te asignará un asesor para comenzar el desarrollo.',
        waitingOn: 'Coordinación',
      };

    // ── Fase 4: Desarrollo ───────────────────────────────────────────────────
    case 'ADVISOR_ASSIGNED':
      return {
        phase: 3, tone: 'waiting',
        title: 'Asesor asignado',
        description: 'Tu asesor iniciará la etapa de desarrollo. Podrás enviarle avances muy pronto.',
        waitingOn: 'Tu asesor',
      };
    case 'WORK_STARTED':
    case 'IN_DEVELOPMENT':
      return {
        phase: 3, tone: 'action',
        title: 'Trabaja en tu tesis y envía avances',
        description: 'Desarrolla tu trabajo y envía avances a tu asesor para que los revise.',
        action: { label: 'Enviar un avance', href: advances },
      };
    case 'ADVANCES_SUBMITTED':
      return {
        phase: 3, tone: 'waiting',
        title: 'Tu asesor está revisando tu avance',
        description: 'Espera la retroalimentación de tu asesor antes de continuar.',
        waitingOn: 'Tu asesor',
      };
    case 'ADVISOR_FEEDBACK':
      return {
        phase: 3, tone: 'action',
        title: 'Tu asesor dejó comentarios',
        description: 'Revisa la retroalimentación, aplica los cambios y vuelve a enviar tu avance.',
        action: { label: 'Ver comentarios y reenviar', href: advances },
      };
    case 'WORK_COMPLETED':
      return {
        phase: 3, tone: 'waiting',
        title: 'Trabajo completado',
        description: 'Tu asesor aprobó el trabajo. Coordinación programará tu defensa con el jurado.',
        waitingOn: 'Coordinación',
      };

    // ── Fase 5: Defensa ──────────────────────────────────────────────────────
    case 'PRESENTATION_SCHEDULED':
      return {
        phase: 4, tone: 'action',
        title: 'Tu defensa está programada',
        description: 'Consulta la fecha, el lugar y el jurado de tu presentación.',
        action: { label: 'Ver detalle de la defensa', href: thesis },
      };
    case 'PRESENTATION_DONE':
      return {
        phase: 4, tone: 'waiting',
        title: 'Defensa realizada',
        description: 'El jurado registrará tu calificación en breve.',
        waitingOn: 'El jurado',
      };
    case 'GRADED':
      return {
        phase: 4, tone: 'waiting',
        title: 'Calificado por el jurado',
        description: 'Tu trabajo fue calificado. Falta la aprobación final.',
        waitingOn: 'Coordinación',
      };
    case 'APPROVED':
      return {
        phase: 4, tone: 'success',
        title: '¡Trabajo aprobado! 🎉',
        description: 'Felicidades. Coordinación publicará tu trabajo en el repositorio institucional.',
        waitingOn: 'Coordinación',
      };

    // ── Fase 6: Publicado ────────────────────────────────────────────────────
    case 'PUBLISHED':
      return {
        phase: 5, tone: 'success',
        title: '¡Tu trabajo está publicado! 🎓',
        description: 'Tu trabajo de grado ya forma parte del repositorio institucional.',
        action: { label: 'Ver en el repositorio', href: '/repository' },
      };

    // ── Terminal: Rechazado ──────────────────────────────────────────────────
    case 'REJECTED':
      return {
        phase: 0, tone: 'rejected',
        title: 'Tu trabajo fue rechazado',
        description: 'Puedes iniciar una nueva postulación con las correcciones necesarias.',
        action: { label: 'Iniciar nueva postulación', href: '/dashboard/student/thesis/new' },
      };

    default:
      return {
        phase: 0, tone: 'waiting',
        title: 'Proceso en curso',
        description: 'Tu trabajo de grado está en proceso.',
        waitingOn: 'Coordinación',
      };
  }
}
