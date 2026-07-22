import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, ThesisStatus, UserRole, AuditAction } from '@prisma/client';
import { assertThesisAccess } from '../common/access/thesis-access.util';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  // ─── Cobros: digita el monto y envía a Caja ─────────────────
  async setAmount(thesisWorkId: string, amount: number, cobrosUserId: string, notes?: string) {
    const work = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');

    if (work.status !== ThesisStatus.REGISTERED) {
      throw new BadRequestException('El trabajo debe estar en estado REGISTERED para fijar el monto');
    }

    // Atómico: registro de pago + estado del trabajo + historial se persisten juntos.
    const existing = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    const payment = await this.prisma.$transaction(async (tx) => {
      const p = existing
        ? await tx.payment.update({
            where: { thesisWorkId },
            data: { amount, status: PaymentStatus.PENDING, amountSetById: cobrosUserId, amountSetAt: new Date(), notes },
          })
        : await tx.payment.create({
            data: { thesisWorkId, amount, status: PaymentStatus.PENDING, amountSetById: cobrosUserId, amountSetAt: new Date(), notes },
          });
      await tx.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.CAJA_PENDING },
      });
      await tx.statusHistory.create({
        data: {
          thesisWorkId,
          fromStatus: ThesisStatus.REGISTERED,
          toStatus: ThesisStatus.CAJA_PENDING,
          changedById: cobrosUserId,
          notes: `Monto fijado: RD$ ${amount.toFixed(2)}`,
        },
      });
      return p;
    });

    this.eventEmitter.emit('payment.amount-set', { payment, thesisWorkId });
    await this.audit.log(cobrosUserId, AuditAction.UPDATE, 'Payment', payment.id, null, { amount, status: ThesisStatus.CAJA_PENDING });
    return payment;
  }

  // ─── Caja: confirma que se recibió el efectivo ───────────────
  async confirmByCaja(thesisWorkId: string, cajaUserId: string, notes?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    if (!payment) throw new NotFoundException('Registro de pago no encontrado');

    // Idempotencia: si ya está confirmado, devolver el registro sin re-procesar
    // (evita doble avance de estado por reintentos / doble click).
    if (payment.status === PaymentStatus.CONFIRMED) {
      return payment;
    }

    const work = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    if (work?.status !== ThesisStatus.CAJA_PENDING) {
      throw new BadRequestException('El trabajo debe estar en estado CAJA_PENDING para confirmar el pago');
    }

    // Atómico: confirmación del pago + estado del trabajo + historial.
    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { thesisWorkId },
        data: { status: PaymentStatus.CONFIRMED, confirmedById: cajaUserId, confirmedAt: new Date(), notes },
      });
      await tx.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.PAYMENT_CONFIRMED },
      });
      await tx.statusHistory.create({
        data: {
          thesisWorkId,
          fromStatus: ThesisStatus.CAJA_PENDING,
          toStatus: ThesisStatus.PAYMENT_CONFIRMED,
          changedById: cajaUserId,
          notes: notes ?? 'Pago confirmado por Caja',
        },
      });
      return p;
    });

    this.eventEmitter.emit('payment.confirmed', { payment: updated });
    await this.audit.log(cajaUserId, AuditAction.PAYMENT_CONFIRM, 'Payment', updated.id, { status: PaymentStatus.PENDING }, { status: PaymentStatus.CONFIRMED });
    return updated;
  }

  // ─── Legacy / cobros reject ──────────────────────────────────
  async reject(thesisWorkId: string, userId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    const work = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    const fromStatus = work?.status ?? ThesisStatus.CAJA_PENDING;

    // Atómico: rechazo del pago + regreso a Cobros + historial.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.REGISTERED }, // regresa a Cobros
      });
      await tx.statusHistory.create({
        data: {
          thesisWorkId,
          fromStatus,
          toStatus: ThesisStatus.REGISTERED,
          changedById: userId,
          notes: `Pago rechazado: ${reason}`,
        },
      });
      return tx.payment.update({
        where: { thesisWorkId },
        data: { status: PaymentStatus.REJECTED, rejectionReason: reason },
      });
    });

    await this.audit.log(userId, AuditAction.UPDATE, 'Payment', updated.id, null, { status: PaymentStatus.REJECTED, reason });
    return updated;
  }

  async findByThesis(thesisWorkId: string, userId: string, userRole: UserRole) {
    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      include: { student: { select: { userId: true } }, advisor: { select: { userId: true } } },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    assertThesisAccess(work, userId, userRole);

    return this.prisma.payment.findUnique({
      where: { thesisWorkId },
      include: {
        thesisWork: {
          select: {
            title: true,
            student: {
              select: {
                matricula: true,
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
    });
  }

  async findAll(status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: status ? { status } : undefined,
      include: {
        thesisWork: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
                career: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportCsv(): Promise<string> {
    const payments = await this.findAll();
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Estudiante', 'Matrícula', 'Carrera', 'Título del trabajo', 'Monto (RD$)', 'Estado', 'Fecha fijación monto', 'Fecha confirmación'].join(',');
    const rows = payments.map((p) => {
      const student = (p.thesisWork as any)?.student;
      return [
        escape(`${student?.user?.firstName ?? ''} ${student?.user?.lastName ?? ''}`.trim()),
        escape(student?.matricula ?? ''),
        escape(student?.career?.name ?? ''),
        escape((p.thesisWork as any)?.title ?? ''),
        escape(Number(p.amount).toFixed(2)),
        escape(p.status),
        escape(p.amountSetAt ? (p.amountSetAt as Date).toISOString().slice(0, 10) : ''),
        escape(p.confirmedAt ? (p.confirmedAt as Date).toISOString().slice(0, 10) : ''),
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }
}
