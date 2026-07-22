import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { startCollaborationServer } from './collaboration/collaboration.server';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const configService = app.get(ConfigService);

  // Cabeceras de seguridad (CSP la maneja el frontend/nginx; aquí es API)
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Detrás de nginx: confiar en el primer proxy para obtener la IP real (throttling)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // En producción, rechazar el JWT_SECRET placeholder de desarrollo
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv === 'production') {
    const jwtSecret = configService.get<string>('JWT_SECRET', '');
    const INSECURE_DEFAULTS = ['unphu-tesis-jwt-secret-dev-2024-change-in-production'];
    if (!jwtSecret || jwtSecret.length < 32 || INSECURE_DEFAULTS.includes(jwtSecret)) {
      throw new Error(
        'JWT_SECRET es inseguro o no está configurado. Genera uno con: openssl rand -hex 32',
      );
    }
  }

  const port = configService.get<number>('PORT', 3001);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

  // CORS
  app.enableCors({
    origin: [frontendUrl],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Prefijo global de API (health queda fuera: GET /health)
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Versionado
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('UNPHU – Gestión de Tesis API')
      .setDescription('API REST para la Plataforma de Gestión de Trabajos de Grado – Facultad de Ingeniería UNPHU')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .addTag('auth', 'Autenticación y autorización')
      .addTag('users', 'Gestión de usuarios')
      .addTag('students', 'Módulo de estudiantes')
      .addTag('advisors', 'Módulo de asesores')
      .addTag('thesis-works', 'Trabajos de grado')
      .addTag('payments', 'Módulo de pagos')
      .addTag('advances', 'Módulo de avances')
      .addTag('presentations', 'Presentaciones y calificaciones')
      .addTag('documents', 'Gestión de documentos')
      .addTag('repository', 'Repositorio público')
      .addTag('notifications', 'Notificaciones')
      .addTag('careers', 'Carreras académicas')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    console.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  console.log(`🚀 Backend UNPHU Tesis corriendo en: http://localhost:${port}/api/v1`);

  // Collaboration WebSocket server (Yjs CRDT) — auth obligatoria
  const collabPort = configService.get<number>('COLLAB_PORT', 3002);
  const prisma = app.get(PrismaService);
  const jwtSecret = configService.get<string>('JWT_SECRET', '');
  startCollaborationServer(collabPort, prisma, jwtSecret);
  console.log(`🤝 Collaboration server en: ws://localhost:${collabPort}`);
}

bootstrap();
