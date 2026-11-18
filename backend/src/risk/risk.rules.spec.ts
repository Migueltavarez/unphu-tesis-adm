import { ThesisStatus } from '@prisma/client';
import { computeRisk, RiskInput } from './risk.rules';

const NOW = new Date('2026-11-17T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const base = (over: Partial<RiskInput> = {}): RiskInput => ({
  status: ThesisStatus.IN_DEVELOPMENT,
  startedAt: daysAgo(60),
  lastActivityAt: daysAgo(2),
  oldestPendingReviewAt: null,
  lastAdvanceAt: daysAgo(5),
  developmentStartedAt: daysAgo(40),
  nextScheduledEventAt: null,
  ...over,
});

describe('computeRisk (semáforo)', () => {
  it('verde cuando hay actividad reciente', () => {
    const r = computeRisk(base(), NOW)!;
    expect(r.level).toBe('GREEN');
    expect(r.reasons).toEqual([]);
    expect(r.daysInactive).toBe(2);
  });

  it('cerradas (publicada / rechazada) no llevan semáforo', () => {
    expect(computeRisk(base({ status: ThesisStatus.PUBLISHED }), NOW)).toBeNull();
    expect(computeRisk(base({ status: ThesisStatus.REJECTED }), NOW)).toBeNull();
  });

  it('amarillo con 15–30 días sin movimiento', () => {
    const r = computeRisk(base({ status: ThesisStatus.REGISTRO_PROCESSING, lastActivityAt: daysAgo(20) }), NOW)!;
    expect(r.level).toBe('YELLOW');
    expect(r.reasons[0]).toBe('Sin movimiento hace 20 días');
  });

  it('rojo con más de 30 días sin movimiento', () => {
    const r = computeRisk(base({ status: ThesisStatus.GRADED, lastActivityAt: daysAgo(31) }), NOW)!;
    expect(r.level).toBe('RED');
  });

  it('una defensa programada a futuro suspende la inactividad', () => {
    const r = computeRisk(
      base({
        status: ThesisStatus.PRESENTATION_SCHEDULED,
        lastActivityAt: daysAgo(45),
        nextScheduledEventAt: new Date(NOW.getTime() + 3 * 86_400_000),
      }),
      NOW,
    )!;
    expect(r.level).toBe('GREEN');
  });

  it('en desarrollo: rojo si pasan más de 30 días sin entregar avances', () => {
    const r = computeRisk(base({ lastActivityAt: daysAgo(1), lastAdvanceAt: daysAgo(35) }), NOW)!;
    expect(r.level).toBe('RED');
    expect(r.reasons[0]).toBe('Sin entregar avances hace 35 días');
  });

  it('en desarrollo sin ningún avance: cuenta desde el inicio del desarrollo', () => {
    const r = computeRisk(base({ lastAdvanceAt: null, developmentStartedAt: daysAgo(40) }), NOW)!;
    expect(r.level).toBe('RED');
    expect(r.reasons[0]).toMatch(/Sin ningún avance/);
  });

  it('amarillo si un avance lleva más de 14 días sin revisar', () => {
    const r = computeRisk(
      base({ status: ThesisStatus.ADVANCES_SUBMITTED, lastActivityAt: daysAgo(10), oldestPendingReviewAt: daysAgo(15) }),
      NOW,
    )!;
    expect(r.level).toBe('YELLOW');
    expect(r.reasons).toContain('Avance sin revisar por el asesor hace 15 días');
  });

  it('rojo si supera el tiempo esperado (12 meses) y negro si supera el máximo (24)', () => {
    expect(computeRisk(base({ startedAt: new Date('2025-10-01T00:00:00Z') }), NOW)!.level).toBe('RED');
    const black = computeRisk(base({ startedAt: new Date('2024-09-01T00:00:00Z') }), NOW)!;
    expect(black.level).toBe('BLACK');
    expect(black.reasons[0]).toMatch(/Superó la duración máxima/);
  });

  it('ordena los motivos de más a menos grave', () => {
    const r = computeRisk(
      base({ status: ThesisStatus.ADVANCES_SUBMITTED, lastActivityAt: daysAgo(40), oldestPendingReviewAt: daysAgo(40) }),
      NOW,
    )!;
    expect(r.level).toBe('RED');
    expect(r.reasons[0]).toBe('Sin movimiento hace 40 días');
    expect(r.reasons[1]).toBe('Avance sin revisar por el asesor hace 40 días');
  });
});
