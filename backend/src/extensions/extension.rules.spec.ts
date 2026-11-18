import { ExtensionStatus, ThesisStatus } from '@prisma/client';
import { canRequestExtension, coordinatorCanDecide, isEscalated, EXTENSION_RULES } from './extension.rules';

const NOW = new Date('2026-11-18T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const E = EXTENSION_RULES.escalationDays;

describe('canRequestExtension', () => {
  it('se pide con el trabajo activo y antes de la defensa', () => {
    expect(canRequestExtension(ThesisStatus.IN_DEVELOPMENT)).toBe(true);
    expect(canRequestExtension(ThesisStatus.PRESENTATION_SCHEDULED)).toBe(true);
    expect(canRequestExtension(ThesisStatus.PRESENTATION_DONE)).toBe(false);
    expect(canRequestExtension(ThesisStatus.GRADED)).toBe(false);
    expect(canRequestExtension(ThesisStatus.REJECTED)).toBe(false);
    expect(canRequestExtension(ThesisStatus.PUBLISHED)).toBe(false);
  });
});

describe('coordinatorCanDecide (escalamiento)', () => {
  it('decide tras el aval del asesor', () => {
    expect(coordinatorCanDecide({ status: ExtensionStatus.PENDING_COORDINATOR, createdAt: daysAgo(0) }, NOW)).toBe(true);
  });
  it(`sin aval, solo cuando el asesor lleva ${E} días sin responder`, () => {
    expect(coordinatorCanDecide({ status: ExtensionStatus.PENDING_ADVISOR, createdAt: daysAgo(E - 1) }, NOW)).toBe(false);
    expect(coordinatorCanDecide({ status: ExtensionStatus.PENDING_ADVISOR, createdAt: daysAgo(E) }, NOW)).toBe(true);
  });
  it('no decide lo ya decidido', () => {
    for (const status of [ExtensionStatus.APPROVED, ExtensionStatus.REJECTED, ExtensionStatus.CANCELLED]) {
      expect(coordinatorCanDecide({ status, createdAt: daysAgo(30) }, NOW)).toBe(false);
    }
  });
});

describe('isEscalated', () => {
  it('cuenta desde el aval cuando espera a Coordinación', () => {
    const base = { status: ExtensionStatus.PENDING_COORDINATOR, createdAt: daysAgo(30) };
    expect(isEscalated({ ...base, advisorDecidedAt: daysAgo(1) }, NOW)).toBe(false);
    expect(isEscalated({ ...base, advisorDecidedAt: daysAgo(E) }, NOW)).toBe(true);
  });
});
