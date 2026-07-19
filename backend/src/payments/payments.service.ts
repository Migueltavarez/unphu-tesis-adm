import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, ThesisStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Cobros: digita el monto y envía a Caja ─────────────────
  async setAmount(thesisWorkId: string, amount: number, cobrosUserId: string, notes?: string) {
    const work = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');

    if (work.status !== ThesisStatus.REGISTERED) {
      throw new BadRequestException('El trabajo debe estar en estado REGISTERED para fijar el monto');
    }

    // Crea o actualiza el registro de pago
    const existing = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    const payment = existing
      ? await this.prisma.payment.update({
          where: { thesisWorkId },
          data: { amount, status: PaymentStatus.PENDING, amountSetById: cobrosUserId, amountSetAt: new Date(), notes },
        })
      : await this.prisma.payment.create({
          data: { thesisWorkId, amount, status: PaymentStatus.PENDING, amountSetById: cobrosUserId, amountSetAt: new Date(), notes },
        });

    await Promise.all([
      this.prisma.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.CAJA_PENDING },
      }),
      this.prisma.statusHistory.create({
        data: {
          thesisWorkId,
          fromStatus: ThesisStatus.REGISTERED,
          toStatus: ThesisStatus.CAJA_PENDING,
          changedById: cobrosUserId,
          notes: `Monto fijado: RD$ ${amount.toFixed(2)}`,
        },
      }),
    ]);

    this.eventEmitter.emit('payment.amount-set', { payment, thesisWorkId });
    return payment;
  }

  // ─── Caja: confirma que se recibió el efectivo ───────────────
  async confirmByCaja(thesisWorkId: string, cajaUserId: string, notes?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    if (!payment) throw new NotFoundException('Registro de pago no encontrado');

    const work = await this.prisma.thesisWork.findUnique({ where: { id: thesisWorkId } });
    if (work?.status !== ThesisStatus.CAJA_PENDING) {
      throw new BadRequestException('El trabajo debe estar en estado CAJA_PENDING para confirmar el pago');
    }

    const [updated] = await Promise.all([
      this.prisma.payment.update({
        where: { thesisWorkId },
        data: { status: PaymentStatus.CONFIRMED, confirmedById: cajaUserId, confirmedAt: new Date(), notes },
      }),
      this.prisma.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.PAYMENT_CONFIRMED },
      }),
      this.prisma.statusHistory.create({
        data: {
          thesisWorkId,
          fromStatus: ThesisStatus.CAJA_PENDING,
          toStatus: ThesisStatus.PAYMENT_CONFIRMED,
          changedById: cajaUserId,
          notes: notes ?? 'Pago confirmado por Caja',
        },
      }),
    ]);

    this.eventEmitter.emit('payment.confirmed', { payment: updated });
    return updated;
  }

  // ─── Legacy / cobros reject ──────────────────────────────────
  async reject(thesisWorkId: string, userId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    await this.prisma.thesisWork.update({
      where: { id: thesisWorkId },
      data: { status: ThesisStatus.REGISTERED }, // regresa a Cobros
    });

    return this.prisma.payment.update({
      where: { thesisWorkId },
      data: { status: PaymentStatus.REJECTED, rejectionReason: reason },
    });
  }

  async findByThesis(thesisWorkId: string) {
    return this.prisma.payment.findUnique({ where: { thesisWorkId } });
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
