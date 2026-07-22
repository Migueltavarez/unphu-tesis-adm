import { PrismaClient, UserRole, ThesisStatus, WorkType, PaymentStatus, NodeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] };
const LOREM_DOC = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

async function main() {
  console.log('Seeding database...');

  // ─── Organización (seam multi-tenant; por ahora solo UNPHU) ──
  const organization = await prisma.organization.upsert({
    where: { code: 'UNPHU' },
    update: {},
    create: { code: 'UNPHU', name: 'Universidad Nacional Pedro Henríquez Ureña' },
  });

  // ─── Carreras ────────────────────────────────────────────────
  const careers = await Promise.all([
    prisma.career.upsert({ where: { code: 'ISC' }, update: {}, create: { name: 'Ingeniería en Sistemas Computacionales', code: 'ISC', description: 'Carrera de Ingeniería en Sistemas Computacionales' } }),
    prisma.career.upsert({ where: { code: 'IND' }, update: {}, create: { name: 'Ingeniería Industrial', code: 'IND', description: 'Carrera de Ingeniería Industrial' } }),
    prisma.career.upsert({ where: { code: 'IQU' }, update: {}, create: { name: 'Ingeniería Química', code: 'IQU', description: 'Carrera de Ingeniería Química' } }),
    prisma.career.upsert({ where: { code: 'ICE' }, update: {}, create: { name: 'Ingeniería Civil y Estructural', code: 'ICE', description: 'Carrera de Ingeniería Civil y Estructural' } }),
    prisma.career.upsert({ where: { code: 'IEL' }, update: {}, create: { name: 'Ingeniería Electrónica', code: 'IEL', description: 'Carrera de Ingeniería Electrónica' } }),
  ]);
  console.log(`Created ${careers.length} careers`);

  // ─── Usuarios staff ──────────────────────────────────────────
  const adminPassword    = await bcrypt.hash('Admin@UNPHU2024', 10);
  const coordPassword    = await bcrypt.hash('Coord@UNPHU2024', 10);
  const advisorPassword  = await bcrypt.hash('Asesor@UNPHU2024', 10);
  const directorPassword = await bcrypt.hash('Director@UNPHU2024', 10);
  const registroPassword = await bcrypt.hash('Registro@UNPHU2024', 10);
  const cobrosPassword   = await bcrypt.hash('Cobros@UNPHU2024', 10);
  const juradoPassword   = await bcrypt.hash('Jurado@UNPHU2024', 10);
  // cajaPassword declared inline below to avoid hoisting issues

  const admin = await prisma.user.upsert({ where: { email: 'admin@unphu.edu.do' }, update: {}, create: { email: 'admin@unphu.edu.do', password: adminPassword, role: UserRole.ADMIN, firstName: 'Administrador', lastName: 'Sistema', emailVerified: true } });
  console.log(`Admin user: ${admin.email}`);

  const coordinator = await prisma.user.upsert({ where: { email: 'coordinacion.tesis@unphu.edu.do' }, update: {}, create: { email: 'coordinacion.tesis@unphu.edu.do', password: coordPassword, role: UserRole.COORDINATOR, firstName: 'Coordinación', lastName: 'Tesis', emailVerified: true } });
  console.log(`Coordinator user: ${coordinator.email}`);

  const advisorUser = await prisma.user.upsert({ where: { email: 'dr.garcia@unphu.edu.do' }, update: {}, create: { email: 'dr.garcia@unphu.edu.do', password: advisorPassword, role: UserRole.ADVISOR, firstName: 'Carlos', lastName: 'García', phone: '809-555-0100', emailVerified: true } });
  const advisor = await prisma.advisor.upsert({ where: { userId: advisorUser.id }, update: {}, create: { userId: advisorUser.id, department: 'Ingeniería en Sistemas', specialties: ['Inteligencia Artificial', 'Desarrollo Web', 'Bases de Datos'], maxWorkload: 5 } });
  console.log(`Advisor user: ${advisorUser.email}`);

  const director = await prisma.user.upsert({ where: { email: 'director.academico@unphu.edu.do' }, update: {}, create: { email: 'director.academico@unphu.edu.do', password: directorPassword, role: UserRole.DIRECTOR, firstName: 'Juan', lastName: 'Pérez', emailVerified: true } });
  console.log(`Director user: ${director.email}`);

  const registro = await prisma.user.upsert({ where: { email: 'registro@unphu.edu.do' }, update: {}, create: { email: 'registro@unphu.edu.do', password: registroPassword, role: UserRole.REGISTRO, firstName: 'María', lastName: 'Santos', emailVerified: true } });
  console.log(`Registro user: ${registro.email}`);

  const cobros = await prisma.user.upsert({ where: { email: 'cobros@unphu.edu.do' }, update: {}, create: { email: 'cobros@unphu.edu.do', password: cobrosPassword, role: UserRole.COBROS, firstName: 'Ana', lastName: 'Rodríguez', emailVerified: true } });
  console.log(`Cobros user: ${cobros.email}`);

  const cajaPassword = await bcrypt.hash('Caja@UNPHU2024', 10);
  const caja = await prisma.user.upsert({ where: { email: 'caja@unphu.edu.do' }, update: {}, create: { email: 'caja@unphu.edu.do', password: cajaPassword, role: UserRole.CAJA, firstName: 'Pedro', lastName: 'Castillo', emailVerified: true } });
  console.log(`Caja user: ${caja.email}`);

  const jurado = await prisma.user.upsert({ where: { email: 'jurado1@unphu.edu.do' }, update: {}, create: { email: 'jurado1@unphu.edu.do', password: juradoPassword, role: UserRole.JURADO, firstName: 'Roberto', lastName: 'Martínez', emailVerified: true } });
  console.log(`Jurado user: ${jurado.email}`);

  // ─── Datos de demostración ───────────────────────────────────
  const [iscCareer, indCareer, iceCareer] = careers;

  const studentPassword = await bcrypt.hash('Estudiante@2024', 10);

  // Estudiante 1 — en desarrollo activo (IN_DEVELOPMENT)
  const stUser1 = await prisma.user.upsert({
    where: { email: 'ana.martinez@estudiante.unphu.edu.do' },
    update: {},
    create: { email: 'ana.martinez@estudiante.unphu.edu.do', password: studentPassword, role: UserRole.STUDENT, firstName: 'Ana', lastName: 'Martínez', phone: '829-555-0201', emailVerified: true },
  });
  const student1 = await prisma.student.upsert({
    where: { userId: stUser1.id },
    update: {},
    create: { userId: stUser1.id, matricula: '20200312', careerId: iscCareer.id, enrollmentYear: 2020, creditsApproved: 148, gpa: 3.7, isEligible: true },
  });
  console.log(`Student 1: ${stUser1.email}`);

  // Estudiante 2 — avances enviados (ADVANCES_SUBMITTED)
  const stUser2 = await prisma.user.upsert({
    where: { email: 'luis.santos@estudiante.unphu.edu.do' },
    update: {},
    create: { email: 'luis.santos@estudiante.unphu.edu.do', password: studentPassword, role: UserRole.STUDENT, firstName: 'Luis', lastName: 'Santos', phone: '829-555-0202', emailVerified: true },
  });
  const student2 = await prisma.student.upsert({
    where: { userId: stUser2.id },
    update: {},
    create: { userId: stUser2.id, matricula: '20190458', careerId: indCareer.id, enrollmentYear: 2019, creditsApproved: 155, gpa: 3.4, isEligible: true },
  });
  console.log(`Student 2: ${stUser2.email}`);

  // Estudiante 3 — presentación programada (PRESENTATION_SCHEDULED)
  const stUser3 = await prisma.user.upsert({
    where: { email: 'maria.perez@estudiante.unphu.edu.do' },
    update: {},
    create: { email: 'maria.perez@estudiante.unphu.edu.do', password: studentPassword, role: UserRole.STUDENT, firstName: 'María', lastName: 'Pérez', phone: '829-555-0203', emailVerified: true },
  });
  const student3 = await prisma.student.upsert({
    where: { userId: stUser3.id },
    update: {},
    create: { userId: stUser3.id, matricula: '20180234', careerId: iceCareer.id, enrollmentYear: 2018, creditsApproved: 162, gpa: 3.9, isEligible: true },
  });
  console.log(`Student 3: ${stUser3.email}`);

  // Estudiante 4 — pendiente de pago (PENDING_PAYMENT)
  const stUser4 = await prisma.user.upsert({
    where: { email: 'pedro.diaz@estudiante.unphu.edu.do' },
    update: {},
    create: { email: 'pedro.diaz@estudiante.unphu.edu.do', password: studentPassword, role: UserRole.STUDENT, firstName: 'Pedro', lastName: 'Díaz', phone: '829-555-0204', emailVerified: true },
  });
  const student4 = await prisma.student.upsert({
    where: { userId: stUser4.id },
    update: {},
    create: { userId: stUser4.id, matricula: '20210156', careerId: iscCareer.id, enrollmentYear: 2021, creditsApproved: 134, gpa: 3.2, isEligible: true },
  });
  console.log(`Student 4: ${stUser4.email}`);

  // ─── Trabajo 1: IN_DEVELOPMENT ───────────────────────────────
  let work1 = await prisma.thesisWork.findFirst({ where: { studentId: student1.id } });
  if (!work1) {
    work1 = await prisma.thesisWork.create({
      data: {
        studentId: student1.id,
        advisorId: advisor.id,
        careerId: iscCareer.id,
        title: 'Sistema de Detección de Fraude Bancario Mediante Inteligencia Artificial',
        type: WorkType.TESIS,
        status: ThesisStatus.IN_DEVELOPMENT,
        abstract: 'Esta investigación propone el diseño e implementación de un sistema inteligente para la detección de transacciones fraudulentas en tiempo real, utilizando algoritmos de aprendizaje automático supervisado y redes neuronales profundas.',
        keywords: ['inteligencia artificial', 'machine learning', 'fraude bancario', 'deep learning', 'fintech'],
        year: 2024,
        approvedAt: new Date('2024-03-15'),
      },
    });

    await prisma.payment.create({ data: { thesisWorkId: work1.id, amount: 3500, status: PaymentStatus.CONFIRMED, confirmedAt: new Date('2024-01-20'), confirmedById: cobros.id, notes: 'Pago verificado y confirmado' } });
    await prisma.statusHistory.createMany({ data: [
      { thesisWorkId: work1.id, fromStatus: null, toStatus: ThesisStatus.PENDING_PAYMENT, changedById: student1.userId },
      { thesisWorkId: work1.id, fromStatus: ThesisStatus.PENDING_PAYMENT, toStatus: ThesisStatus.PAYMENT_CONFIRMED, changedById: cobros.id, notes: 'Pago confirmado' },
      { thesisWorkId: work1.id, fromStatus: ThesisStatus.PAYMENT_CONFIRMED, toStatus: ThesisStatus.ADVISOR_ASSIGNED, changedById: coordinator.id, notes: 'Asesor asignado' },
      { thesisWorkId: work1.id, fromStatus: ThesisStatus.ADVISOR_ASSIGNED, toStatus: ThesisStatus.IN_DEVELOPMENT, changedById: advisor.id, notes: 'Trabajo iniciado' },
    ]});

    // Crear documento de tesis con nodos
    const doc1 = await prisma.thesisDocument.create({
      data: {
        thesisWorkId: work1.id,
        docType: 'THESIS',
        title: 'Sistema de Detección de Fraude Bancario Mediante Inteligencia Artificial',
      },
    });

    const nodes1 = [
      { name: 'Introducción', nodeType: 'chapter', order: 0, isRequired: true, status: NodeStatus.APPROVED, metadata: { minWords: 500, guidance: 'Contexto, justificación y objetivos del trabajo' } },
      { name: 'Planteamiento del Problema', nodeType: 'chapter', order: 1, isRequired: true, status: NodeStatus.PENDING_REVIEW, metadata: { minWords: 300 } },
      { name: 'Marco Teórico', nodeType: 'chapter', order: 2, isRequired: true, status: NodeStatus.IN_PROGRESS, metadata: { minWords: 800 } },
      { name: 'Marco Metodológico', nodeType: 'chapter', order: 3, isRequired: true, status: NodeStatus.DRAFT, metadata: { minWords: 600 } },
      { name: 'Desarrollo', nodeType: 'chapter', order: 4, isRequired: true, status: NodeStatus.DRAFT, metadata: { minWords: 1000 } },
      { name: 'Resultados y Análisis', nodeType: 'chapter', order: 5, isRequired: true, status: NodeStatus.DRAFT, metadata: { minWords: 500 } },
      { name: 'Conclusiones', nodeType: 'chapter', order: 6, isRequired: true, status: NodeStatus.DRAFT, metadata: { minWords: 300 } },
      { name: 'Recomendaciones', nodeType: 'chapter', order: 7, isRequired: false, status: NodeStatus.DRAFT, metadata: {} },
      { name: 'Referencias Bibliográficas', nodeType: 'chapter', order: 8, isRequired: true, status: NodeStatus.DRAFT, metadata: {} },
      { name: 'Anexos', nodeType: 'chapter', order: 9, isRequired: false, status: NodeStatus.DRAFT, metadata: {} },
    ];

    for (const n of nodes1) {
      const node = await prisma.documentNode.create({ data: { documentId: doc1.id, ...n } });

      if (n.status === NodeStatus.APPROVED || n.status === NodeStatus.PENDING_REVIEW || n.status === NodeStatus.IN_PROGRESS) {
        const content = n.name === 'Introducción'
          ? LOREM_DOC('El fraude bancario representa uno de los principales desafíos del sector financiero moderno. Con el crecimiento exponencial de las transacciones digitales, la necesidad de sistemas automatizados de detección en tiempo real se ha vuelto imperativa. Este trabajo de investigación propone el diseño e implementación de un sistema basado en inteligencia artificial capaz de identificar patrones anómalos en transacciones financieras con una precisión superior al 95%.')
          : EMPTY_DOC;

        await prisma.block.create({ data: { nodeId: node.id, type: 'PARAGRAPH', order: 0, content, authorId: stUser1.id, wordCount: n.name === 'Introducción' ? 87 : 0 } });
      }

      if (n.status !== NodeStatus.DRAFT) {
        await prisma.nodeStatusHistory.create({ data: { nodeId: node.id, fromStatus: null, toStatus: n.status, changedById: stUser1.id } });
      }
    }

    // Comentario del asesor en sección PENDING_REVIEW
    const pendingNode = await prisma.documentNode.findFirst({ where: { documentId: doc1.id, status: NodeStatus.PENDING_REVIEW } });
    if (pendingNode) {
      await prisma.nodeComment.create({ data: { nodeId: pendingNode.id, authorId: advisor.id, authorName: 'Dr. Carlos García', content: 'Por favor amplía el alcance del problema, incluyendo estadísticas actualizadas del impacto económico del fraude en la región.' } });
    }

    console.log(`Work 1 created: ${work1.title}`);
  }

  // ─── Trabajo 2: ADVANCES_SUBMITTED ───────────────────────────
  let work2 = await prisma.thesisWork.findFirst({ where: { studentId: student2.id } });
  if (!work2) {
    work2 = await prisma.thesisWork.create({
      data: {
        studentId: student2.id,
        advisorId: advisor.id,
        careerId: indCareer.id,
        title: 'Optimización de la Cadena de Suministro en Empresas Manufactureras Dominicanas Mediante Lean Manufacturing',
        type: WorkType.TESIS,
        status: ThesisStatus.ADVANCES_SUBMITTED,
        abstract: 'Análisis e implementación de técnicas Lean Manufacturing para reducir desperdicios y optimizar la cadena de suministro en el sector manufacturero dominicano.',
        keywords: ['lean manufacturing', 'cadena de suministro', 'optimización', 'manufactura'],
        year: 2024,
      },
    });

    await prisma.payment.create({ data: { thesisWorkId: work2.id, amount: 3500, status: PaymentStatus.CONFIRMED, confirmedAt: new Date('2024-02-10'), confirmedById: cobros.id } });
    await prisma.statusHistory.createMany({ data: [
      { thesisWorkId: work2.id, fromStatus: null, toStatus: ThesisStatus.PENDING_PAYMENT, changedById: student2.userId },
      { thesisWorkId: work2.id, fromStatus: ThesisStatus.PENDING_PAYMENT, toStatus: ThesisStatus.PAYMENT_CONFIRMED, changedById: cobros.id },
      { thesisWorkId: work2.id, fromStatus: ThesisStatus.PAYMENT_CONFIRMED, toStatus: ThesisStatus.ADVISOR_ASSIGNED, changedById: coordinator.id },
      { thesisWorkId: work2.id, fromStatus: ThesisStatus.ADVISOR_ASSIGNED, toStatus: ThesisStatus.ADVANCES_SUBMITTED, changedById: stUser2.id, notes: 'Primer avance enviado' },
    ]});

    await prisma.advance.create({
      data: {
        thesisWorkId: work2.id,
        version: 1,
        title: 'Avance I — Marco Teórico y Metodológico',
        description: 'Se presenta el marco teórico sobre Lean Manufacturing y la metodología propuesta para el análisis de la cadena de suministro en empresas manufactureras dominicanas.',
        status: 'SUBMITTED',
      },
    });

    const doc2 = await prisma.thesisDocument.create({ data: { thesisWorkId: work2.id, docType: 'THESIS', title: 'Optimización de la Cadena de Suministro mediante Lean Manufacturing' } });
    const nodeNames2 = ['Introducción', 'Planteamiento del Problema', 'Marco Teórico', 'Marco Metodológico', 'Desarrollo', 'Resultados y Análisis', 'Conclusiones', 'Recomendaciones', 'Referencias Bibliográficas', 'Anexos'];
    const nodeStatuses2 = [NodeStatus.APPROVED, NodeStatus.APPROVED, NodeStatus.APPROVED, NodeStatus.IN_PROGRESS, NodeStatus.DRAFT, NodeStatus.DRAFT, NodeStatus.DRAFT, NodeStatus.DRAFT, NodeStatus.DRAFT, NodeStatus.DRAFT];
    for (let i = 0; i < nodeNames2.length; i++) {
      await prisma.documentNode.create({ data: { documentId: doc2.id, name: nodeNames2[i], nodeType: 'chapter', order: i, isRequired: i < 7, status: nodeStatuses2[i], metadata: {} } });
    }

    console.log(`Work 2 created: ${work2.title}`);
  }

  // ─── Trabajo 3: PRESENTATION_SCHEDULED ───────────────────────
  let work3 = await prisma.thesisWork.findFirst({ where: { studentId: student3.id } });
  if (!work3) {
    const presentationDate = new Date();
    presentationDate.setDate(presentationDate.getDate() + 7);

    work3 = await prisma.thesisWork.create({
      data: {
        studentId: student3.id,
        advisorId: advisor.id,
        careerId: iceCareer.id,
        title: 'Análisis Sísmico de Edificaciones de Hormigón Armado Bajo el Reglamento Dominicano de la Construcción',
        type: WorkType.TESIS,
        status: ThesisStatus.PRESENTATION_SCHEDULED,
        abstract: 'Evaluación del comportamiento sísmico de edificaciones típicas de hormigón armado en la República Dominicana, aplicando el nuevo Reglamento Dominicano de la Construcción.',
        keywords: ['ingeniería estructural', 'análisis sísmico', 'hormigón armado', 'construcción'],
        year: 2024,
        approvedAt: new Date(),
      },
    });

    await prisma.payment.create({ data: { thesisWorkId: work3.id, amount: 3500, status: PaymentStatus.CONFIRMED, confirmedAt: new Date('2023-10-05'), confirmedById: cobros.id } });

    await prisma.presentation.create({
      data: {
        thesisWorkId: work3.id,
        scheduledAt: presentationDate,
        location: 'Aula Magna — Edificio de Ingeniería, UNPHU',
        notes: 'Duración: 30 minutos de exposición + 15 minutos de preguntas.',
        juryMembers: ['Roberto Martínez'],
      },
    });

    await prisma.statusHistory.createMany({ data: [
      { thesisWorkId: work3.id, fromStatus: null, toStatus: ThesisStatus.PENDING_PAYMENT, changedById: student3.userId },
      { thesisWorkId: work3.id, fromStatus: ThesisStatus.PENDING_PAYMENT, toStatus: ThesisStatus.PAYMENT_CONFIRMED, changedById: cobros.id },
      { thesisWorkId: work3.id, fromStatus: ThesisStatus.PAYMENT_CONFIRMED, toStatus: ThesisStatus.ADVISOR_ASSIGNED, changedById: coordinator.id },
      { thesisWorkId: work3.id, fromStatus: ThesisStatus.ADVISOR_ASSIGNED, toStatus: ThesisStatus.WORK_COMPLETED, changedById: advisor.id, notes: 'Trabajo completado y aprobado por asesor' },
      { thesisWorkId: work3.id, fromStatus: ThesisStatus.WORK_COMPLETED, toStatus: ThesisStatus.PRESENTATION_SCHEDULED, changedById: coordinator.id, notes: 'Presentación programada' },
    ]});

    const doc3 = await prisma.thesisDocument.create({ data: { thesisWorkId: work3.id, docType: 'THESIS', title: 'Análisis Sísmico bajo el Reglamento Dominicano de la Construcción' } });
    const nodeNames3 = ['Introducción', 'Planteamiento del Problema', 'Marco Teórico', 'Marco Metodológico', 'Desarrollo', 'Resultados y Análisis', 'Conclusiones', 'Recomendaciones', 'Referencias Bibliográficas', 'Anexos'];
    for (let i = 0; i < nodeNames3.length; i++) {
      await prisma.documentNode.create({ data: { documentId: doc3.id, name: nodeNames3[i], nodeType: 'chapter', order: i, isRequired: i < 7, status: NodeStatus.APPROVED, metadata: {} } });
    }

    console.log(`Work 3 created: ${work3.title}`);
  }

  // ─── Trabajo 4: PENDING_PAYMENT ──────────────────────────────
  let work4 = await prisma.thesisWork.findFirst({ where: { studentId: student4.id } });
  if (!work4) {
    work4 = await prisma.thesisWork.create({
      data: {
        studentId: student4.id,
        careerId: iscCareer.id,
        title: 'Desarrollo de una Aplicación Móvil para la Gestión de Citas Médicas en Clínicas Privadas',
        type: WorkType.MONOGRAFICO,
        status: ThesisStatus.PENDING_PAYMENT,
        abstract: 'Aplicación móvil multiplataforma para optimizar la gestión de citas en clínicas privadas dominicanas.',
        keywords: ['aplicación móvil', 'salud digital', 'React Native', 'gestión de citas'],
        year: 2024,
      },
    });

    await prisma.payment.create({ data: { thesisWorkId: work4.id, amount: 3500, status: PaymentStatus.PENDING } });
    await prisma.statusHistory.create({ data: { thesisWorkId: work4.id, fromStatus: null, toStatus: ThesisStatus.PENDING_PAYMENT, changedById: student4.userId } });

    console.log(`Work 4 created: ${work4.title}`);
  }

  // ─── Backfill de organización a todas las entidades raíz ─────
  const orgId = organization.id;
  await Promise.all([
    prisma.user.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } }),
    prisma.career.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } }),
    prisma.student.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } }),
    prisma.advisor.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } }),
    prisma.thesisWork.updateMany({ where: { organizationId: null }, data: { organizationId: orgId } }),
  ]);

  console.log('\nSeed completed successfully!');
  console.log('\n── Credentials ──────────────────────────────────');
  console.log('Staff:');
  console.log('  admin@unphu.edu.do          / Admin@UNPHU2024');
  console.log('  coordinacion.tesis@unphu.edu.do / Coord@UNPHU2024');
  console.log('  dr.garcia@unphu.edu.do      / Asesor@UNPHU2024');
  console.log('  director.academico@unphu.edu.do / Director@UNPHU2024');
  console.log('  registro@unphu.edu.do       / Registro@UNPHU2024');
  console.log('  cobros@unphu.edu.do         / Cobros@UNPHU2024');
  console.log('  jurado1@unphu.edu.do        / Jurado@UNPHU2024');
  console.log('Students:');
  console.log('  ana.martinez@estudiante.unphu.edu.do   / Estudiante@2024  (IN_DEVELOPMENT)');
  console.log('  luis.santos@estudiante.unphu.edu.do    / Estudiante@2024  (ADVANCES_SUBMITTED)');
  console.log('  maria.perez@estudiante.unphu.edu.do    / Estudiante@2024  (PRESENTATION_SCHEDULED)');
  console.log('  pedro.diaz@estudiante.unphu.edu.do     / Estudiante@2024  (PENDING_PAYMENT)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
