import { ThesisStatus } from '@prisma/client';
import { evaluateMilestones, statusReached } from './milestone-plan';

const NOW = new Date('2026-11-17T12:00:00Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000);
const m = (order: number, due: number, completesAtStatus: ThesisStatus | null, completedAt: Date | null = null) => ({
  order, dueDate: inDays(due), required: true, completesAtStatus, completedAt,
});

const PLAN = [
  m(0, -60, ThesisStatus.PROPOSAL_APPROVED),
  m(1, -20, ThesisStatus.DRAFT_APPROVED),
  m(2, 3, null),                          // capítulos (manual)
  m(3, 30, ThesisStatus.WORK_COMPLETED),
  m(4, 60, ThesisStatus.PRESENTATION_DONE),
];

describe('statusReached', () => {
  it('respeta el orden del flujo y excluye cerrados', () => {
    expect(statusReached(ThesisStatus.GRADED, ThesisStatus.PRESENTATION_DONE)).toBe(true);
    expect(statusReached(ThesisStatus.IN_DEVELOPMENT, ThesisStatus.WORK_COMPLETED)).toBe(false);
    expect(statusReached(ThesisStatus.REJECTED, ThesisStatus.PROPOSAL_APPROVED)).toBe(false);
  });
});

describe('evaluateMilestones', () => {
  it('cumple los hitos ligados a etapas ya alcanzadas y marca vencidos / por vencer', () => {
    const r = evaluateMilestones(PLAN, ThesisStatus.DRAFT_IN_PROGRESS, NOW);
    expect(r.map((e) => e.state)).toEqual(['DONE', 'OVERDUE', 'DUE_SOON', 'PENDING', 'PENDING']);
  });

  it('un hito manual se cumple al marcarlo', () => {
    const plan = PLAN.map((x) => (x.order === 2 ? { ...x, completedAt: inDays(-1) } : x));
    const r = evaluateMilestones(plan, ThesisStatus.IN_DEVELOPMENT, NOW);
    expect(r[2].state).toBe('DONE');
    expect(r[2].implicit).toBe(false);
  });

  it('pasar un hito posterior cumple implícitamente los anteriores (incluidos los manuales)', () => {
    const r = evaluateMilestones(PLAN, ThesisStatus.GRADED, NOW);
    expect(r.every((e) => e.done)).toBe(true);
    expect(r[2].implicit).toBe(true);
  });
});
