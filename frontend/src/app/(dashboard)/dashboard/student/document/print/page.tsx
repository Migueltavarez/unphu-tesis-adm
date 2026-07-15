'use client';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { studentsApi, thesisDocumentsApi, sectionsApi, blocksApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import dynamic from 'next/dynamic';

const BlockEditor = dynamic(() => import('@/components/editor/BlockEditor'), { ssr: false });

const SECTION_TYPE_LABELS: Record<string, string> = {
  TITLE_PAGE: 'Portada', DEDICATION: 'Dedicatoria', ACKNOWLEDGEMENTS: 'Agradecimientos',
  ABSTRACT: 'Resumen / Abstract', TABLE_OF_CONTENTS: 'Tabla de Contenidos',
  INTRODUCTION: 'Introducción', LITERATURE_REVIEW: 'Marco Teórico',
  METHODOLOGY: 'Metodología', RESULTS: 'Resultados y Análisis',
  CONCLUSIONS: 'Conclusiones', BIBLIOGRAPHY: 'Bibliografía', APPENDIX: 'Apéndices',
  CUSTOM: '',
};

export default function PrintPage() {
  const { user } = useAuthStore();
  const printed = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentsApi.myProfile,
    enabled: !!user,
  });

  const activeWork = profile?.thesisWorks?.find(
    (w: any) => !['REJECTED', 'PUBLISHED'].includes(w.status),
  );

  const { data: doc, isLoading } = useQuery({
    queryKey: ['thesis-document-print', activeWork?.id],
    queryFn: () => thesisDocumentsApi.getOrCreate(activeWork!.id),
    enabled: !!activeWork,
  });

  // Auto-print once everything is loaded
  useEffect(() => {
    if (!isLoading && doc && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 1200);
    }
  }, [isLoading, doc]);

  if (isLoading || !doc) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ fontFamily: 'Times New Roman, serif', fontSize: 16 }}>Preparando documento para impresión...</p>
      </div>
    );
  }

  const sections = doc.sections ?? [];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: white; font-family: 'Times New Roman', Times, serif; color: #000; }

        .print-doc { max-width: 816px; margin: 0 auto; padding: 2rem; }

        /* Cover page */
        .cover { text-align: center; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; }
        .cover .university { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .cover .faculty { font-size: 12pt; margin-bottom: 60px; }
        .cover .title { font-size: 18pt; font-weight: bold; line-height: 1.4; margin-bottom: 60px; max-width: 500px; }
        .cover .student { font-size: 12pt; margin-bottom: 8px; }
        .cover .year { font-size: 12pt; margin-top: 60px; }

        /* Section pages */
        .section-page { page-break-before: always; padding-top: 1in; }
        .section-title { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 36px; border-bottom: 2px solid #000; padding-bottom: 12px; }
        .section-content { font-size: 12pt; line-height: 2; text-align: justify; }

        /* TipTap content overrides for print */
        .section-content .ProseMirror { outline: none; }
        .section-content .ProseMirror h1 { font-size: 14pt; font-weight: bold; margin: 18pt 0 9pt; }
        .section-content .ProseMirror h2 { font-size: 13pt; font-weight: bold; margin: 14pt 0 7pt; }
        .section-content .ProseMirror h3 { font-size: 12pt; font-weight: bold; font-style: italic; margin: 12pt 0 6pt; }
        .section-content .ProseMirror p { margin-bottom: 12pt; }
        .section-content .ProseMirror ul, .section-content .ProseMirror ol { padding-left: 1.5em; margin-bottom: 12pt; }
        .section-content .ProseMirror li { margin-bottom: 4pt; }
        .section-content .ProseMirror blockquote { border-left: 3px solid #666; padding-left: 1em; margin: 12pt 0 12pt 1em; }
        .section-content .ProseMirror table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
        .section-content .ProseMirror table td, .section-content .ProseMirror table th { border: 1px solid #000; padding: 4pt 8pt; font-size: 11pt; }
        .section-content .ProseMirror table th { background: #f0f0f0; font-weight: bold; }
        .section-content .ProseMirror code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f5f5f5; padding: 1px 4px; }
        .section-content .ProseMirror pre { background: #f5f5f5; padding: 12pt; font-family: 'Courier New', monospace; font-size: 10pt; margin-bottom: 12pt; }
        .section-content .ProseMirror hr { border: none; border-top: 1px solid #000; margin: 18pt 0; }
        .section-content .ProseMirror a { color: #000; text-decoration: underline; }

        /* Empty section notice */
        .empty-notice { color: #999; font-style: italic; font-size: 11pt; }

        /* Print controls (hidden when printing) */
        .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1b3a6b; color: white; padding: 12px 24px; display: flex; align-items: center; justify-between; gap: 16px; z-index: 100; font-family: system-ui, sans-serif; }
        .print-bar button { background: #f59e0b; color: #000; border: none; padding: 6px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
        .print-doc { margin-top: 52px; }

        @media print {
          .print-bar { display: none !important; }
          .print-doc { margin-top: 0; padding: 0; max-width: none; }
          .section-page { padding-top: 0; }
          @page { margin: 1in 1in 1in 1.5in; size: letter; }
        }
      `}</style>

      {/* Print toolbar (hidden on print) */}
      <div className="print-bar">
        <span style={{ fontWeight: 600 }}>Vista de impresión — {activeWork?.title}</span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={() => window.print()}>Imprimir / Guardar PDF</button>
          <button onClick={() => window.close()} style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
            Cerrar
          </button>
        </div>
      </div>

      <div className="print-doc">
        {/* Cover page */}
        <div className="cover">
          <p className="university">Universidad Nacional Pedro Henríquez Ureña</p>
          <p className="faculty">Facultad de Ingeniería</p>
          <p className="title">{activeWork?.title}</p>
          <p className="student">{user?.firstName} {user?.lastName}</p>
          <p className="year">{new Date().getFullYear()}</p>
        </div>

        {/* Sections */}
        {sections
          .sort((a: any, b: any) => a.order - b.order)
          .map((section: any) => {
            const primaryBlock = section.blocks?.[0];
            const hasContent = primaryBlock?.content &&
              JSON.stringify(primaryBlock.content) !== '{"type":"doc","content":[]}';

            return (
              <div key={section.id} className="section-page">
                <h2 className="section-title">{section.title}</h2>
                <div className="section-content">
                  {hasContent ? (
                    <BlockEditor
                      content={primaryBlock.content}
                      onChange={() => {}}
                      readOnly={true}
                    />
                  ) : (
                    <p className="empty-notice">[Sección sin contenido]</p>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
