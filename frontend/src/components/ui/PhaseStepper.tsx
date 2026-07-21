import { STUDENT_PHASES, PhaseIndex } from '@/lib/studentGuidance';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  current: PhaseIndex;
  rejected?: boolean;
}

/**
 * Stepper compacto de 6 fases para el estudiante.
 * Reemplaza el timeline de 20+ estados: muestra solo las macro-etapas del
 * proceso y en cuál está el estudiante ahora.
 */
export default function PhaseStepper({ current, rejected = false }: Props) {
  return (
    <div className="flex items-start">
      {STUDENT_PHASES.map((label, i) => {
        const done = !rejected && i < current;
        const active = !rejected && i === current;
        const isLast = i === STUDENT_PHASES.length - 1;

        return (
          <div key={label} className="flex-1 flex flex-col items-center relative">
            {/* Conector */}
            {!isLast && (
              <div
                className={cn(
                  'absolute top-3.5 left-1/2 w-full h-0.5',
                  done ? 'bg-unphu-600' : 'bg-gray-200',
                )}
              />
            )}
            {/* Punto */}
            <div
              className={cn(
                'relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                done && 'bg-unphu-600 border-unphu-600 text-white',
                active && !rejected && 'bg-white border-unphu-600 text-unphu-700 ring-4 ring-unphu-100',
                !done && !active && 'bg-white border-gray-300 text-gray-400',
                rejected && i === 0 && 'bg-red-500 border-red-500 text-white',
              )}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {/* Etiqueta */}
            <span
              className={cn(
                'mt-2 text-[10px] leading-tight text-center px-0.5 break-words',
                active ? 'text-unphu-700 font-semibold' : done ? 'text-gray-600' : 'text-gray-400',
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
