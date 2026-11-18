import { FeedbackSeverity, FeedbackStatus } from '@prisma/client';
import { compareFeedback, nextFeedbackStatus, summarizeFeedback } from './feedback.rules';

describe('nextFeedbackStatus', () => {
  it('el estudiante resuelve solo lo abierto', () => {
    expect(nextFeedbackStatus(FeedbackStatus.OPEN, 'resolve')).toBe(FeedbackStatus.RESOLVED);
    expect(nextFeedbackStatus(FeedbackStatus.RESOLVED, 'resolve')).toBeNull();
    expect(nextFeedbackStatus(FeedbackStatus.VERIFIED, 'resolve')).toBeNull();
  });

  it('el asesor verifica lo resuelto o cierra lo abierto que ya no aplica', () => {
    expect(nextFeedbackStatus(FeedbackStatus.RESOLVED, 'verify')).toBe(FeedbackStatus.VERIFIED);
    expect(nextFeedbackStatus(FeedbackStatus.OPEN, 'verify')).toBe(FeedbackStatus.VERIFIED);
    expect(nextFeedbackStatus(FeedbackStatus.VERIFIED, 'verify')).toBeNull();
  });

  it('el asesor reabre lo resuelto o verificado, no lo abierto', () => {
    expect(nextFeedbackStatus(FeedbackStatus.RESOLVED, 'reopen')).toBe(FeedbackStatus.OPEN);
    expect(nextFeedbackStatus(FeedbackStatus.VERIFIED, 'reopen')).toBe(FeedbackStatus.OPEN);
    expect(nextFeedbackStatus(FeedbackStatus.OPEN, 'reopen')).toBeNull();
  });
});

describe('orden y resumen', () => {
  const d = (s: string) => new Date(`2026-11-${s}T00:00:00Z`);
  const items = [
    { id: 'a', status: FeedbackStatus.VERIFIED, severity: FeedbackSeverity.BLOCKING, createdAt: d('01') },
    { id: 'b', status: FeedbackStatus.OPEN, severity: FeedbackSeverity.MINOR, createdAt: d('02') },
    { id: 'c', status: FeedbackStatus.OPEN, severity: FeedbackSeverity.BLOCKING, createdAt: d('05') },
    { id: 'd', status: FeedbackStatus.RESOLVED, severity: FeedbackSeverity.MAJOR, createdAt: d('03') },
    { id: 'e', status: FeedbackStatus.OPEN, severity: FeedbackSeverity.BLOCKING, createdAt: d('04') },
  ];

  it('pendientes primero, lo bloqueante y más antiguo arriba', () => {
    expect([...items].sort(compareFeedback).map((i) => i.id)).toEqual(['e', 'c', 'b', 'd', 'a']);
  });

  it('cuenta por estado y bloqueantes abiertas', () => {
    expect(summarizeFeedback(items)).toEqual({ total: 5, open: 3, resolved: 1, verified: 1, blockingOpen: 2 });
  });
});
