import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Carreras
  const careers = await Promise.all([
    prisma.career.upsert({
      where: { code: 'ISC' },
      update: {},
      create: {
        name: 'Ingeniería en Sistemas Computacionales',
        code: 'ISC',
        description: 'Carrera de Ingeniería en Sistemas Computacionales',
      },
    }),
    prisma.career.upsert({
      where: { code: 'IND' },
      update: {},
      create: {
        name: 'Ingeniería Industrial',
        code: 'IND',
        description: 'Carrera de Ingeniería Industrial',
      },
    }),
    prisma.career.upsert({
      where: { code: 'IQU' },
      update: {},
      create: {
        name: 'Ingeniería Química',
        code: 'IQU',
        description: 'Carrera de Ingeniería Química',
      },
    }),
    prisma.career.upsert({
      where: { code: 'ICE' },
      update: {},
      create: {
        name: 'Ingeniería Civil y Estructural',
        code: 'ICE',
        description: 'Carrera de Ingeniería Civil y Estructural',
      },
    }),
    prisma.career.upsert({
      where: { code: 'IEL' },
      update: {},
      create: {
        name: 'Ingeniería Electrónica',
        code: 'IEL',
        description: 'Carrera de Ingeniería Electrónica',
      },
    }),
  ]);

  console.log(`Created ${careers.length} careers`);

  // Admin por defecto
  const adminPassword = await bcrypt.hash('Admin@UNPHU2024', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@unphu.edu.do' },
    update: {},
    create: {
      email: 'admin@unphu.edu.do',
      password: adminPassword,
      role: UserRole.ADMIN,
      firstName: 'Administrador',
      lastName: 'Sistema',
      emailVerified: true,
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // Coordinador por defecto
  const coordPassword = await bcrypt.hash('Coord@UNPHU2024', 10);
  const coordinator = await prisma.user.upsert({
    where: { email: 'coordinacion.tesis@unphu.edu.do' },
    update: {},
    create: {
      email: 'coordinacion.tesis@unphu.edu.do',
      password: coordPassword,
      role: UserRole.COORDINATOR,
      firstName: 'Coordinación',
      lastName: 'Tesis',
      emailVerified: true,
    },
  });
  console.log(`Coordinator user: ${coordinator.email}`);

  // Asesor de ejemplo
  const advisorPassword = await bcrypt.hash('Asesor@UNPHU2024', 10);
  const advisorUser = await prisma.user.upsert({
    where: { email: 'dr.garcia@unphu.edu.do' },
    update: {},
    create: {
      email: 'dr.garcia@unphu.edu.do',
      password: advisorPassword,
      role: UserRole.ADVISOR,
      firstName: 'Carlos',
      lastName: 'García',
      phone: '809-555-0100',
      emailVerified: true,
    },
  });

  await prisma.advisor.upsert({
    where: { userId: advisorUser.id },
    update: {},
    create: {
      userId: advisorUser.id,
      department: 'Ingeniería en Sistemas',
      specialties: ['Inteligencia Artificial', 'Desarrollo Web', 'Bases de Datos'],
      maxWorkload: 5,
    },
  });
  console.log(`Advisor user: ${advisorUser.email}`);

  // Director
  const directorPassword = await bcrypt.hash('Director@UNPHU2024', 10);
  const director = await prisma.user.upsert({
    where: { email: 'director.academico@unphu.edu.do' },
    update: {},
    create: {
      email: 'director.academico@unphu.edu.do',
      password: directorPassword,
      role: UserRole.DIRECTOR,
      firstName: 'Juan',
      lastName: 'Pérez',
      emailVerified: true,
    },
  });
  console.log(`Director user: ${director.email}`);

  // Dpto. Registro
  const registroPassword = await bcrypt.hash('Registro@UNPHU2024', 10);
  const registro = await prisma.user.upsert({
    where: { email: 'registro@unphu.edu.do' },
    update: {},
    create: {
      email: 'registro@unphu.edu.do',
      password: registroPassword,
      role: UserRole.REGISTRO,
      firstName: 'María',
      lastName: 'Santos',
      emailVerified: true,
    },
  });
  console.log(`Registro user: ${registro.email}`);

  // Dpto. Cobros
  const cobrosPassword = await bcrypt.hash('Cobros@UNPHU2024', 10);
  const cobros = await prisma.user.upsert({
    where: { email: 'cobros@unphu.edu.do' },
    update: {},
    create: {
      email: 'cobros@unphu.edu.do',
      password: cobrosPassword,
      role: UserRole.COBROS,
      firstName: 'Ana',
      lastName: 'Rodríguez',
      emailVerified: true,
    },
  });
  console.log(`Cobros user: ${cobros.email}`);

  // Jurado
  const juradoPassword = await bcrypt.hash('Jurado@UNPHU2024', 10);
  const jurado = await prisma.user.upsert({
    where: { email: 'jurado1@unphu.edu.do' },
    update: {},
    create: {
      email: 'jurado1@unphu.edu.do',
      password: juradoPassword,
      role: UserRole.JURADO,
      firstName: 'Roberto',
      lastName: 'Martínez',
      emailVerified: true,
    },
  });
  console.log(`Jurado user: ${jurado.email}`);

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
