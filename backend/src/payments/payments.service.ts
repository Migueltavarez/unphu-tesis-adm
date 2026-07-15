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

  async initiate(thesisWorkId: string, amount: number) {
    const existing = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    if (existing) throw new BadRequestException('Ya existe un registro de pago para este trabajo');

    const payment = await this.prisma.payment.create({
      data: { thesisWorkId, amount, status: PaymentStatus.PENDING },
    });

    await this.prisma.thesisWork.update({
      where: { id: thesisWorkId },
      data: { status: ThesisStatus.PENDING_PAYMENT },
    });

    return payment;
  }

  async submitReceipt(thesisWorkId: string, receiptUrl: string, receiptFileName: string, notes?: string) {
    let payment = await this.prisma.payment.findUnique({ where: { thesisWorkId } });

    if (!payment) {
      // Auto-crear el registro de pago con monto por defecto si el coordinador no lo inició aún
      payment = await this.prisma.payment.create({
        data: { thesisWorkId, amount: 3500, status: PaymentStatus.PENDING },
      });
      await this.prisma.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.PENDING_PAYMENT },
      });
    }

    if (payment.status === PaymentStatus.CONFIRMED) {
      throw new BadRequestException('El pago ya fue confirmado');
    }

    const updated = await this.prisma.payment.update({
      where: { thesisWorkId },
      data: { receiptUrl, receiptFileName, status: PaymentStatus.SUBMITTED, notes },
    });

    this.eventEmitter.emit('payment.receipt-submitted', { payment: updated });
    return updated;
  }

  async confirm(thesisWorkId: string, confirmedById: string, notes?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status !== PaymentStatus.SUBMITTED) {
      throw new BadRequestException('El comprobante debe estar enviado para confirmar');
    }

    const [updated] = await Promise.all([
      this.prisma.payment.update({
        where: { thesisWorkId },
        data: { status: PaymentStatus.CONFIRMED, confirmedById, confirmedAt: new Date(), notes },
      }),
      this.prisma.thesisWork.update({
        where: { id: thesisWorkId },
        data: { status: ThesisStatus.PAYMENT_CONFIRMED },
      }),
      this.prisma.statusHistory.create({
        data: {
          thesisWorkId,
          fromStatus: ThesisStatus.PENDING_PAYMENT,
          toStatus: ThesisStatus.PAYMENT_CONFIRMED,
          changedById: confirmedById,
          notes: 'Pago confirmado por administración',
        },
      }),
    ]);

    this.eventEmitter.emit('payment.confirmed', { payment: updated });
    return updated;
  }

  async reject(thesisWorkId: string, confirmedById: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { thesisWorkId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    return this.prisma.payment.update({
      where: { thesisWorkId },
      data: { status: PaymentStatus.REJECTED, confirmedById, rejectionReason: reason },
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
            student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportCsv(): Promise<string> {
    const payments = await this.findAll();
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Estudiante', 'Email', 'Título del trabajo', 'Monto (RD$)', 'Estado', 'Fecha envío comprobante', 'Fecha confirmación'].join(',');
    const rows = payments.map((p) =>
      [
        escape(`${p.thesisWork?.student?.user?.firstName ?? ''} ${p.thesisWork?.student?.user?.lastName ?? ''}`.trim()),
        escape(p.thesisWork?.student?.user?.email ?? ''),
        escape((p.thesisWork as any)?.title ?? ''),
        escape(Number(p.amount).toFixed(2)),
        escape(p.status),
        escape(p.createdAt?.toISOString().slice(0, 10) ?? ''),
        escape(p.confirmedAt ? (p.confirmedAt as Date).toISOString().slice(0, 10) : ''),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }
}
