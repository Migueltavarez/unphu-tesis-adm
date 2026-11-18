import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType, UserRole } from '@prisma/client';

// Tipos de archivo aceptados (documentos académicos e imágenes de respaldo).
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

// Leen: estudiante dueño, asesor asignado y staff académico/administrativo
// que interviene en el expediente. Suben: dueño, asesor, coordinación, admin.
const READ_STAFF: UserRole[] = [
  UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR, UserRole.JURADO,
  UserRole.REGISTRO, UserRole.COBROS, UserRole.CAJA,
];
const UPLOAD_STAFF: UserRole[] = [UserRole.ADMIN, UserRole.COORDINATOR];

@Injectable()
export class DocumentsService {
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get('R2_BUCKET_NAME', 'unphu-tesis-docs');
    this.publicUrl = this.configService.get('R2_PUBLIC_URL', '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${this.configService.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get('R2_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get('R2_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  /** Verifica acceso al trabajo antes de leer o escribir sus documentos. */
  private async assertAccess(thesisWorkId: string, userId: string, role: UserRole, mode: 'read' | 'upload') {
    const work = await this.prisma.thesisWork.findUnique({
      where: { id: thesisWorkId },
      select: { student: { select: { userId: true } }, advisor: { select: { userId: true } } },
    });
    if (!work) throw new NotFoundException('Trabajo de grado no encontrado');
    const isParticipant =
      (role === UserRole.STUDENT && work.student?.userId === userId) ||
      (role === UserRole.ADVISOR && work.advisor?.userId === userId);
    const staff = mode === 'read' ? READ_STAFF : UPLOAD_STAFF;
    if (!isParticipant && !staff.includes(role)) {
      throw new ForbiddenException('No tienes acceso a los documentos de este trabajo');
    }
  }

  async upload(
    thesisWorkId: string,
    file: Express.Multer.File,
    type: DocumentType,
    uploadedById: string,
    role: UserRole,
    isPublic = false,
  ) {
    // Todas las validaciones ocurren ANTES de escribir en el almacenamiento.
    await this.assertAccess(thesisWorkId, uploadedById, role, 'upload');
    if (!file) throw new BadRequestException('Adjunta un archivo');
    if (!Object.values(DocumentType).includes(type)) throw new BadRequestException('Tipo de documento no válido');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Formato no permitido. Usa PDF, Word, Excel, PowerPoint o una imagen (PNG, JPG, WEBP)');
    }
    if (file.size > MAX_DOCUMENT_BYTES) throw new BadRequestException('El archivo supera el máximo de 25 MB');
    // Solo Coordinación/Admin publican documentos.
    if (isPublic && !UPLOAD_STAFF.includes(role)) isPublic = false;

    const ext = (file.originalname.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
    const key = `${thesisWorkId}/${type.toLowerCase()}/${uuidv4()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    const fileUrl = isPublic ? `${this.publicUrl}/${key}` : key;

    return this.prisma.document.create({
      data: {
        thesisWorkId,
        type,
        name: file.originalname,
        fileUrl,
        fileKey: key,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById,
        isPublic,
      },
    });
  }

  async getSignedDownloadUrl(id: string, thesisWorkId: string, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id, thesisWorkId },
      include: { thesisWork: { include: { student: true, advisor: true } } },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    if (!doc.isPublic) {
      const isOwner =
        doc.thesisWork.student.userId === userId ||
        doc.thesisWork.advisor?.userId === userId;
      const isAdmin = ([UserRole.ADMIN, UserRole.COORDINATOR] as string[]).includes(userRole);
      if (!isOwner && !isAdmin) throw new ForbiddenException('Sin acceso a este documento');
    }

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: doc.fileKey });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 });

    return { url, expiresIn: 3600 };
  }

  async findByThesis(thesisWorkId: string, userId: string, role: UserRole) {
    await this.assertAccess(thesisWorkId, userId, role, 'read');
    return this.prisma.document.findMany({
      where: { thesisWorkId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string, thesisWorkId: string, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({ where: { id, thesisWorkId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    if (!([UserRole.ADMIN, UserRole.COORDINATOR] as string[]).includes(userRole) && doc.uploadedById !== userId) {
      throw new ForbiddenException('No puedes eliminar este documento');
    }

    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: doc.fileKey }));
    return this.prisma.document.delete({ where: { id } });
  }
}
