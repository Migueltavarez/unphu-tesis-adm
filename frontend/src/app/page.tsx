import Link from 'next/link';
import { GraduationCap, BookOpen, Users, ClipboardCheck, ArrowRight, Search } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-unphu-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-gold-400" />
            <div>
              <h1 className="font-bold text-lg leading-none">UNPHU</h1>
              <p className="text-xs text-unphu-200">Facultad de Ingeniería</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/repository" className="text-unphu-200 hover:text-white transition-colors">
              Repositorio
            </Link>
            <Link href="/login" className="text-unphu-200 hover:text-white transition-colors">
              Iniciar Sesión
            </Link>
            <Link href="/register" className="bg-gold-500 hover:bg-gold-400 text-unphu-900 font-semibold px-4 py-2 rounded-lg transition-colors">
              Registrarse
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-unphu-gradient text-white py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-gold-400 font-medium text-sm uppercase tracking-wider mb-3">
            Sistema Académico Digital
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Plataforma de Gestión de<br />
            <span className="text-gold-400">Trabajos de Grado</span>
          </h2>
          <p className="text-unphu-200 text-lg mb-10 max-w-2xl mx-auto">
            Gestiona tu tesis o monográfico de principio a fin: postulación, anteproyecto,
            avances, presentación y publicación en un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-gold-500 hover:bg-gold-400 text-unphu-900 font-bold px-8 py-3 rounded-xl transition-colors inline-flex items-center gap-2">
              Comenzar proceso <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/repository" className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-3 rounded-xl transition-colors inline-flex items-center gap-2">
              <Search className="w-5 h-5" /> Ver repositorio
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <h3 className="text-3xl font-bold text-gray-900">Todo el proceso en una plataforma</h3>
          <p className="text-gray-500 mt-3">Desde la postulación hasta la publicación digital</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: ClipboardCheck, color: 'text-blue-600 bg-blue-50', title: 'Postulación Digital', desc: 'Aplica en línea, sube tu propuesta y recibe validación del coordinador.' },
            { icon: BookOpen, color: 'text-teal-600 bg-teal-50', title: 'Avances Versionados', desc: 'Envía avances como commits. Tu asesor comenta y aprueba cada etapa.' },
            { icon: Users, color: 'text-purple-600 bg-purple-50', title: 'Panel por Rol', desc: 'Vistas personalizadas para estudiante, asesor, coordinador y admin.' },
            { icon: GraduationCap, color: 'text-gold-600 bg-yellow-50', title: 'Repositorio Público', desc: 'Los proyectos aprobados son visibles y descargables para toda la comunidad.' },
          ].map((f) => (
            <div key={f.title} className="card p-6 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{f.title}</h4>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process steps */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <h3 className="text-2xl font-bold text-center mb-12 text-gray-900">¿Cómo funciona?</h3>
          <div className="relative">
            <div className="hidden md:block absolute top-5 left-0 right-0 h-0.5 bg-unphu-200 mx-16" />
            <div className="grid md:grid-cols-5 gap-6">
              {[
                { n: '1', label: 'Postulación' },
                { n: '2', label: 'Validación & Pago' },
                { n: '3', label: 'Anteproyecto' },
                { n: '4', label: 'Desarrollo' },
                { n: '5', label: 'Presentación' },
              ].map((s) => (
                <div key={s.n} className="flex flex-col items-center text-center relative">
                  <div className="w-10 h-10 rounded-full bg-unphu-800 text-white font-bold flex items-center justify-center text-sm z-10 shadow">
                    {s.n}
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-700">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-unphu-800 text-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h3 className="text-2xl font-bold mb-4">¿Listo para iniciar tu trabajo de grado?</h3>
          <p className="text-unphu-200 mb-8">Regístrate con tu correo institucional y comienza hoy.</p>
          <Link href="/register" className="bg-gold-500 hover:bg-gold-400 text-unphu-900 font-bold px-10 py-3 rounded-xl transition-colors inline-block">
            Crear cuenta
          </Link>
        </div>
      </section>

      <footer className="bg-unphu-950 text-unphu-400 text-center py-6 text-sm">
        © 2024 UNPHU – Universidad Nacional Pedro Henríquez Ureña · Facultad de Ingeniería
      </footer>
    </main>
  );
}
