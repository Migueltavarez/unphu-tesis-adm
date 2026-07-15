import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType, UserRole } from '@prisma/client';

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

  async upload(
    thesisWorkId: string,
    file: Express.Multer.File,
    type: DocumentType,
    uploadedById: string,
    isPublic = false,
  ) {
    const ext = file.originalname.split('.').pop();
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

  async getSignedDownloadUrl(id: string, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
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

  async findByThesis(thesisWorkId: string) {
    return this.prisma.document.findMany({
      where: { thesisWorkId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    if (!([UserRole.ADMIN, UserRole.COORDINATOR] as string[]).includes(userRole) && doc.uploadedById !== userId) {
      throw new ForbiddenException('No puedes eliminar este documento');
    }

    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: doc.fileKey }));
    return this.prisma.document.delete({ where: { id } });
  }
}
