import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { addHours } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import { UserRole, AuditAction } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    await this.createAuditLog(user.id, AuditAction.LOGIN, 'User', user.id, ip, userAgent);

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verifyToken = uuidv4();

    // Seam multi-tenant: adjuntar el nuevo usuario a la organización por defecto.
    const defaultOrgCode = this.configService.get<string>('DEFAULT_ORG_CODE', 'UNPHU');
    const org = await this.prisma.organization.findUnique({ where: { code: defaultOrgCode } });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: UserRole.STUDENT,
        emailVerifyToken: verifyToken,
        organizationId: org?.id ?? null,
      },
    });

    this.eventEmitter.emit('user.registered', { user, verifyToken });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return { message: 'Si el correo existe, recibirás un enlace de recuperación' };

    const resetToken = uuidv4();
    const resetExpires = addHours(new Date(), 2);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    this.eventEmitter.emit('user.forgot-password', { user, resetToken });

    return { message: 'Si el correo existe, recibirás un enlace de recuperación' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: dto.token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; jti?: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (!payload.jti) throw new UnauthorizedException('Refresh token inválido');

    const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Detección de reuso: un token ya revocado presentado de nuevo →
    // posible robo, se revocan TODAS las sesiones del usuario.
    if (stored.revoked) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Refresh token reutilizado; sesiones revocadas');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario inactivo');

    // Rotación: revoca el token usado y emite uno nuevo.
    await this.prisma.refreshToken.update({
      where: { jti: payload.jti },
      data: { revoked: true },
    });

    return this.generateTokens(user.id, user.email, user.role);
  }

  /** Logout server-side: revoca el refresh token presentado, o todas las
   *  sesiones del usuario si no se envía uno. */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const decoded = this.jwtService.decode(refreshToken) as { jti?: string; sub?: string } | null;
      if (decoded?.jti && decoded.sub === userId) {
        await this.prisma.refreshToken.updateMany({
          where: { jti: decoded.jti, userId },
          data: { revoked: true },
        });
        return { message: 'Sesión cerrada' };
      }
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    return { message: 'Todas las sesiones cerradas' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) throw new UnauthorizedException('Contraseña actual incorrecta');

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) throw new BadRequestException('Token de verificación inválido');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null },
    });

    return { message: 'Correo verificado exitosamente' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        student: {
          include: { career: true },
        },
        advisor: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const jti = uuidv4();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role, jti },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
        },
      ),
    ]);

    // Persistir el refresh token (para poder rotarlo/revocarlo).
    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: { jti, userId, expiresAt: new Date(decoded.exp * 1000) },
    });

    return { accessToken, refreshToken };
  }

  private async createAuditLog(
    userId: string,
    action: AuditAction,
    entity: string,
    entityId: string,
    ip?: string,
    userAgent?: string,
  ) {
    await this.prisma.auditLog.create({
      data: { userId, action, entity, entityId, ipAddress: ip, userAgent },
    });
  }
}
