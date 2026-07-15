import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId?: string, entity?: string, action?: AuditAction, page = 1, limit = 50) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (entity) where.entity = entity;
    if (action) where.action = action;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async log(
    userId: string | null,
    action: AuditAction,
    entity: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any,
    ip?: string,
    userAgent?: string,
  ) {
    return this.prisma.auditLog.create({
      data: { userId, action, entity, entityId, oldValues, newValues, ipAddress: ip, userAgent },
    });
  }
}
