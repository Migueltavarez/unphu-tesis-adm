import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThesisStatus } from '@prisma/client';

export class RepositoryQueryDto {
  search?: string;
  careerId?: string;
  year?: number;
  type?: string;
  page?: number = 1;
  limit?: number = 12;
}

@Injectable()
export class RepositoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublished(query: RepositoryQueryDto) {
    const { search, careerId, year, type, page = 1, limit = 12 } = query;
    const skip = (page - 1) * limit;

    const where: any = { status: ThesisStatus.PUBLISHED };
    if (careerId) where.careerId = careerId;
    if (year) where.year = Number(year);
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { abstract: { contains: search, mode: 'insensitive' } },
        { keywords: { has: search } },
        { student: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
        { student: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.thesisWork.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          abstract: true,
          keywords: true,
          year: true,
          publishedAt: true,
          student: {
            select: {
              matricula: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          career: { select: { name: true, code: true } },
          advisor: { select: { user: { select: { firstName: true, lastName: true } } } },
          documents: {
            where: { isPublic: true, type: 'FINAL_WORK' },
            select: { id: true, name: true, fileUrl: true, fileSize: true },
          },
          _count: { select: { advances: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.thesisWork.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOnePublished(id: string) {
    return this.prisma.thesisWork.findFirst({
      where: { id, status: ThesisStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        type: true,
        abstract: true,
        keywords: true,
        year: true,
        publishedAt: true,
        student: {
          select: {
            matricula: true,
            user: { select: { firstName: true, lastName: true } },
            career: true,
          },
        },
        career: true,
        advisor: { select: { user: { select: { firstName: true, lastName: true } }, specialties: true } },
        documents: { where: { isPublic: true }, select: { id: true, name: true, fileUrl: true, fileSize: true, type: true } },
        grades: { select: { finalGrade: true, approved: true } },
      },
    });
  }

  async getStats() {
    const [total, byCareer, byYear, byType] = await Promise.all([
      this.prisma.thesisWork.count({ where: { status: ThesisStatus.PUBLISHED } }),
      this.prisma.thesisWork.groupBy({
        by: ['careerId'],
        where: { status: ThesisStatus.PUBLISHED },
        _count: true,
      }),
      this.prisma.thesisWork.groupBy({
        by: ['year'],
        where: { status: ThesisStatus.PUBLISHED },
        _count: true,
        orderBy: { year: 'desc' },
      }),
      this.prisma.thesisWork.groupBy({
        by: ['type'],
        where: { status: ThesisStatus.PUBLISHED },
        _count: true,
      }),
    ]);

    return { total, byCareer, byYear, byType };
  }
}
