import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Verifica que el usuario tenga acceso al trabajo (es el estudiante, asesor, coordinador o admin) */
  private async checkAccess(thesisWorkId: string, userId: string, userRole: UserRole) {
    if (([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR] as UserRole[]).includes(userRole)) return;

    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      select: {
        student: { select: { userId: true } },
        advisor:  { select: { userId: true } },
      },
    });
    if (!work) throw new NotFoundException('Trabajo no encontrado');

    const isStudent = work.student?.userId === userId;
    const isAdvisor = work.advisor?.userId === userId;
    if (!isStudent && !isAdvisor) throw new ForbiddenException('No tienes acceso a este chat');
  }

  async findAll(thesisWorkId: string, userId: string, userRole: UserRole) {
    await this.checkAccess(thesisWorkId, userId, userRole);
    return this.prisma.message.findMany({
      where: { thesisWorkId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async send(
    thesisWorkId: string,
    userId: string,
    userRole: UserRole,
    content: string,
    senderName: string,
  ) {
    await this.checkAccess(thesisWorkId, userId, userRole);
    return this.prisma.message.create({
      data: {
        thesisWorkId,
        senderId: userId,
        senderName,
        senderRole: userRole,
        content: content.trim(),
      },
    });
  }

  /** Marca como leídos todos los mensajes NO enviados por el usuario actual */
  async markRead(thesisWorkId: string, userId: string, userRole: UserRole) {
    await this.checkAccess(thesisWorkId, userId, userRole);
    await this.prisma.message.updateMany({
      where: { thesisWorkId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  /** Cuenta mensajes no leídos para el usuario actual */
  async unreadCount(thesisWorkId: string, userId: string) {
    return this.prisma.message.count({
      where: { thesisWorkId, senderId: { not: userId }, isRead: false },
    });
  }
}
