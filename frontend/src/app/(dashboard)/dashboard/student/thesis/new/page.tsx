'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { careersApi, thesisApi } from '@/lib/api';
import { Loader2, ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';

const schema = z.object({
  title: z.string().min(10, 'El título debe tener al menos 10 caracteres').max(300),
  type: z.enum(['TESIS', 'MONOGRAFICO']),
  careerId: z.string().uuid('Selecciona una carrera'),
  abstract: z.string().min(50, 'El resumen debe tener al menos 50 caracteres').max(2000).optional().or(z.literal('')),
  keywords: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewThesisPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { data: careers } = useQuery({ queryKey: ['careers'], queryFn: careersApi.list });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const keywords = data.keywords
        ? data.keywords.split(',').map((k) => k.trim()).filter(Boolean)
        : [];

      await thesisApi.create({
        title: data.title,
        type: data.type,
        careerId: data.careerId,
        abstract: data.abstract || undefined,
        keywords,
      });

      toast.success('Postulación enviada exitosamente');
      router.push('/dashboard/student');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al enviar la postulación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/student" className="text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva postulación</h1>
          <p className="text-sm text-gray-500">Inicia tu proceso de trabajo de grado</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3">
        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">Pasos del proceso</p>
          <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
            <li>Llenar este formulario</li>
            <li>Esperar validación académica de la coordinación</li>
            <li>Realizar el pago del formulario</li>
            <li>Reunión con la facultad y asignación de asesor</li>
          </ol>
        </div>
      </div>

      <div className="card p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="label">Título del trabajo *</label>
            <input
              {...register('title')}
              className="input"
              placeholder="Ej: Sistema de Gestión de Inventario con IA para PYMES"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de trabajo *</label>
              <select {...register('type')} className="input">
                <option value="">Seleccionar...</option>
                <option value="TESIS">Tesis</option>
                <option value="MONOGRAFICO">Monográfico</option>
              </select>
              {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
            </div>
            <div>
              <label className="label">Carrera *</label>
              <select {...register('careerId')} className="input">
                <option value="">Seleccionar carrera...</option>
                {careers?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.careerId && <p className="text-red-500 text-xs mt-1">{errors.careerId.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Resumen / Abstract</label>
            <textarea
              {...register('abstract')}
              rows={5}
              className="input resize-none"
              placeholder="Describe brevemente de qué trata tu trabajo de grado, cuál es el problema que resuelve y la metodología que utilizarás..."
            />
            {errors.abstract && <p className="text-red-500 text-xs mt-1">{errors.abstract.message}</p>}
          </div>

          <div>
            <label className="label">Palabras clave</label>
            <input
              {...register('keywords')}
              className="input"
              placeholder="Ej: Inteligencia Artificial, Machine Learning, Python (separadas por comas)"
            />
            <p className="text-xs text-gray-400 mt-1">Separa las palabras con comas</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/dashboard/student" className="btn-secondary flex-1 text-center">
              Cancelar
            </Link>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar postulación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
