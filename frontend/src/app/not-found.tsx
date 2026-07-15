import Link from 'next/link';
import { GraduationCap, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-unphu-800 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-gold-400" />
          </div>
          <div className="text-left">
            <p className="font-bold text-unphu-900 text-lg leading-none">UNPHU</p>
            <p className="text-sm text-gray-500">Gestión de Tesis</p>
          </div>
        </div>

        <h1 className="text-8xl font-black text-unphu-800 leading-none mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">Página no encontrada</h2>
        <p className="text-gray-500 mb-8">
          La página que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 bg-unphu-800 text-white rounded-lg hover:bg-unphu-700 transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4" />
            Ir al inicio
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Mi panel
          </Link>
        </div>
      </div>
    </div>
  );
}
