'use client';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '@/lib/api';
import { UserCheck, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function RegistroDashboard() {
  const { data: students } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => studentsApi.list(),
  });

  const list = students?.data ?? students ?? [];
  const eligible = list.filter((s: any) => s.isEligible).length;
  const pending = list.filter((s: any) => !s.isEligible).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Departamento de Registro</h1>
        <p className="text-gray-500 text-sm mt-1">Validación de elegibilidad académica de estudiantes</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{list.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total estudiantes</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{eligible}</p>
          <p className="text-xs text-gray-500 mt-1">Elegibles</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-yellow-600">{pending}</p>
          <p className="text-xs text-gray-500 mt-1">Pendientes</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Validación de elegibilidad</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ir a la sección de Elegibilidad para revisar y aprobar estudiantes.
        </p>
        <a href="/dashboard/registro/students"
          className="inline-flex items-center gap-2 px-4 py-2 bg-unphu-700 hover:bg-unphu-800 text-white text-sm font-medium rounded-lg">
          <UserCheck className="w-4 h-4" /> Ver estudiantes
        </a>
      </div>
    </div>
  );
}
