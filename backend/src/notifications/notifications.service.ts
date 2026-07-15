import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendInApp(userId: string, title: string, message: string, type: string, metadata?: any) {
    const notification = await this.prisma.notification.create({
      data: { userId, title, message, type, metadata },
    });
    this.eventEmitter.emit('notification.push', notification);
    return notification;
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM', 'UNPHU Tesis <noreply@unphu.edu.do>'),
        to,
        subject,
        html,
      });
    } catch (err) {
      console.error('Error sending email:', err);
    }
  }

  async getAll(userId: string, page = 1, limit = 20, type?: string) {
    const where: any = { userId };
    if (type) where.type = type;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data: notifications, total, page, limit };
  }

  async getUnread(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ── Event listeners ──────────────────────────────────────

  @OnEvent('user.registered')
  async onUserRegistered({ user, verifyToken }: any) {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    await this.sendEmail(
      user.email,
      '🎓 Bienvenido a UNPHU Gestión de Tesis',
      this.emailTemplate(
        '¡Bienvenido!',
        `Hola ${user.firstName},<br><br>
        Tu cuenta ha sido creada exitosamente en la plataforma de gestión de tesis de la UNPHU.<br><br>
        Puedes verificar tu correo haciendo clic en el siguiente enlace:<br>
        <a href="${frontendUrl}/verify-email?token=${verifyToken}" style="color:#1a3a5c">Verificar correo electrónico</a><br><br>
        Si no creaste esta cuenta, ignora este mensaje.`,
      ),
    );
  }

  @OnEvent('user.forgot-password')
  async onForgotPassword({ user, resetToken }: any) {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    await this.sendEmail(
      user.email,
      '🔑 Recuperación de contraseña – UNPHU',
      this.emailTemplate(
        'Recuperar contraseña',
        `Hola ${user.firstName},<br><br>
        Recibimos una solicitud para restablecer la contraseña de tu cuenta.<br><br>
        Haz clic en el siguiente enlace para crear una nueva contraseña
        (válido por <strong>2 horas</strong>):<br><br>
        <a href="${frontendUrl}/reset-password?token=${resetToken}"
           style="display:inline-block;background:#1a3a5c;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Restablecer contraseña
        </a><br><br>
        Si no solicitaste este cambio, ignora este mensaje. Tu contraseña permanecerá sin cambios.`,
      ),
    );
  }

  @OnEvent('thesis.created')
  async onThesisCreated({ thesisWork }: any) {
    const studentUser = thesisWork.student?.user;
    if (studentUser) {
      await this.sendInApp(
        thesisWork.student.userId,
        'Postulación recibida',
        `Tu postulación para "${thesisWork.title}" ha sido recibida exitosamente.`,
        'THESIS_CREATED',
        { thesisWorkId: thesisWork.id },
      );
      await this.sendEmail(
        studentUser.email,
        '📋 Postulación de Tesis Recibida – UNPHU',
        this.emailTemplate(
          'Postulación Recibida',
          `Hola ${studentUser.firstName},<br><br>
          Tu postulación para el trabajo de grado <strong>"${thesisWork.title}"</strong> ha sido recibida exitosamente.<br><br>
          El proceso de validación académica comenzará pronto. Te notificaremos el estado.`,
        ),
      );
    }
  }

  @OnEvent('thesis.status-changed')
  async onStatusChanged({ thesisWork, oldStatus, newStatus }: any) {
    const studentUser = thesisWork.student?.user;
    if (studentUser) {
      await this.sendInApp(
        thesisWork.student.userId,
        'Estado actualizado',
        `El estado de tu trabajo de grado cambió a: ${newStatus}`,
        'STATUS_CHANGED',
        { thesisWorkId: thesisWork.id, oldStatus, newStatus },
      );
    }
  }

  @OnEvent('advance.submitted')
  async onAdvanceSubmitted({ advance }: any) {
    const thesisWork = await this.prisma.thesisWork.findUnique({
      where: { id: advance.thesisWorkId },
      include: {
        advisor: { include: { user: { select: { id: true, firstName: true, email: true } } } },
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!thesisWork?.advisor) return;
    const advisorUser = thesisWork.advisor.user;
    const studentName = `${thesisWork.student?.user?.firstName} ${thesisWork.student?.user?.lastName}`.trim();
    await this.sendInApp(
      thesisWork.advisor.userId,
      'Nuevo avance enviado',
      `${studentName} envió un nuevo avance: "${advance.title}"`,
      'ADVANCE_SUBMITTED',
      { thesisWorkId: advance.thesisWorkId, advanceId: advance.id },
    );
    await this.sendEmail(
      advisorUser.email,
      '📤 Nuevo Avance de Tesis – UNPHU',
      this.emailTemplate(
        'Nuevo Avance Enviado',
        `Hola ${advisorUser.firstName},<br><br>
        Tu estudiante <strong>${studentName}</strong> ha enviado un nuevo avance:<br><br>
        <strong>"${advance.title}"</strong><br><br>
        Ingresa al sistema para revisar y dar retroalimentación.`,
      ),
    );
  }

  @OnEvent('payment.confirmed')
  async onPaymentConfirmed({ payment }: any) {
    const thesisWork = await this.prisma.thesisWork.findUnique({
      where: { id: payment.thesisWorkId },
      include: {
        student: { include: { user: { select: { id: true, firstName: true, email: true } } } },
      },
    });
    if (!thesisWork?.student) return;
    const studentUser = thesisWork.student.user;
    await this.sendInApp(
      thesisWork.student.userId,
      'Pago confirmado',
      'Tu pago ha sido confirmado. El proceso de tu trabajo de grado continúa.',
      'PAYMENT_CONFIRMED',
      { thesisWorkId: payment.thesisWorkId, paymentId: payment.id },
    );
    await this.sendEmail(
      studentUser.email,
      '✅ Pago Confirmado – UNPHU',
      this.emailTemplate(
        'Pago Confirmado',
        `Hola ${studentUser.firstName},<br><br>
        Tu pago de inscripción de trabajo de grado ha sido <strong>confirmado exitosamente</strong>.<br><br>
        El proceso continúa con la siguiente etapa. Te notificaremos cualquier actualización.`,
      ),
    );
  }

  @OnEvent('meeting.scheduled')
  async onMeetingScheduled({ meeting, thesisWork }: any) {
    const studentUser = thesisWork.student?.user;
    if (!studentUser) return;
    const date = new Date(meeting.scheduledAt).toLocaleString('es-DO', {
      dateStyle: 'full', timeStyle: 'short',
    });
    await this.sendInApp(
      thesisWork.student.userId,
      'Reunión programada',
      `Tu asesor programó una reunión para el ${date}${meeting.location ? ` en ${meeting.location}` : ''}.`,
      'MEETING_SCHEDULED',
      { thesisWorkId: thesisWork.id, meetingId: meeting.id },
    );
    await this.sendEmail(
      studentUser.email,
      '📅 Reunión de Asesoría Programada – UNPHU',
      this.emailTemplate(
        'Reunión de Asesoría Programada',
        `Hola ${studentUser.firstName},<br><br>
        Tu asesor <strong>${thesisWork.advisor?.user?.firstName} ${thesisWork.advisor?.user?.lastName}</strong>
        ha programado una reunión contigo:<br><br>
        <strong>Fecha:</strong> ${date}<br>
        ${meeting.location ? `<strong>Lugar:</strong> ${meeting.location}<br>` : ''}
        ${meeting.virtualLink ? `<strong>Enlace:</strong> <a href="${meeting.virtualLink}">${meeting.virtualLink}</a><br>` : ''}
        ${meeting.agenda ? `<br><strong>Agenda:</strong><br>${meeting.agenda}` : ''}`,
      ),
    );
  }

  private emailTemplate(title: string, content: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><style>
      body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .header { background: #1a3a5c; color: white; padding: 24px; text-align: center; }
      .header h1 { margin: 0; font-size: 22px; }
      .body { padding: 32px; color: #333; line-height: 1.6; }
      .footer { background: #f0f0f0; padding: 16px; text-align: center; font-size: 12px; color: #888; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 UNPHU – Gestión de Tesis</h1>
          <p style="margin:4px 0;opacity:0.8">Facultad de Ingeniería</p>
        </div>
        <div class="body">
          <h2>${title}</h2>
          <p>${content}</p>
          <p>Si tienes dudas, contacta a la coordinación de tesis.</p>
        </div>
        <div class="footer">Universidad Nacional Pedro Henríquez Ureña (UNPHU)<br>Este es un correo automático, por favor no responder.</div>
      </div>
    </body>
    </html>`;
  }
}
