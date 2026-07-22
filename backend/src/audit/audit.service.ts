import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId?: string,
    entity?: string,
    action?: AuditAction,
    page?: number | string,
    limit?: number | string,
  ) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (entity) where.entity = entity;
    if (action) where.action = action;

    // Coerción robusta: los query params pueden llegar como string o ausentes.
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(200, Math.max(1, Number(limit) || 50));
    const skip = (p - 1) * l;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page: p, limit: l };
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
