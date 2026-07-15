'use client';
// v2
import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import {
  Bold, Italic, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Table as TableIcon,
  Link as LinkIcon, Undo, Redo, Save, Users,
} from 'lucide-react';

interface CollaborationUser {
  name: string;
  color: string;
}

interface BlockEditorProps {
  content: Record<string, any> | null;
  onChange: (content: Record<string, any>, wordCount: number) => void;
  onSave?: () => void;
  readOnly?: boolean;
  placeholder?: string;
  autoSaveDelay?: number;
  /** When provided, enables real-time collaboration via Yjs */
  blockId?: string;
  /** Current user info for presence display */
  currentUser?: CollaborationUser;
}

// Deterministic color from a string
function userColor(seed: string): string {
  const colors = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be185d'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function BlockEditor({
  content,
  onChange,
  onSave,
  readOnly = false,
  placeholder = 'Escribe aquí...',
  autoSaveDelay = 3000,
  blockId,
  currentUser,
}: BlockEditorProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<CollaborationUser[]>([]);
  const ydocRef = useRef<any>(null);
  const providerRef = useRef<any>(null);
  const [collabReady, setCollabReady] = useState(false);

  // Lazily initialise Yjs only when blockId is provided (avoids SSR issues)
  useEffect(() => {
    if (!blockId || typeof window === 'undefined') return;

    let cancelled = false;

    (async () => {
      const { Doc } = await import('yjs');
      const { WebsocketProvider } = await import('y-websocket');

      if (cancelled) return;

      const ydoc = new Doc();
      const collabUrl = process.env.NEXT_PUBLIC_COLLAB_URL || 'ws://localhost:3002';
      const provider = new WebsocketProvider(collabUrl, `block-${blockId}`, ydoc);

      ydocRef.current = ydoc;
      providerRef.current = provider;

      // Track awareness (online users)
      if (currentUser) {
        provider.awareness.setLocalStateField('user', {
          name: currentUser.name,
          color: currentUser.color ?? userColor(currentUser.name),
        });
      }

      provider.awareness.on('change', () => {
        const states = Array.from(provider.awareness.getStates().values()) as any[];
        setOnlineUsers(
          states
            .filter((s) => s?.user?.name)
            .map((s) => ({ name: s.user.name, color: s.user.color ?? '#6b7280' }))
        );
      });

      provider.on('sync', (synced: boolean) => {
        if (synced && !cancelled) setCollabReady(true);
      });
    })();

    return () => {
      cancelled = true;
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      setCollabReady(false);
      setOnlineUsers([]);
    };
  }, [blockId, currentUser?.name]);

  // Build extensions — Collaboration added dynamically once ydoc is ready
  const starterKitOptions: any = {
    heading: { levels: [1, 2, 3] },
    codeBlock: { languageClassPrefix: 'language-' },
  };
  // Disable built-in history when collaborating (Yjs manages undo)
  if (blockId) starterKitOptions.history = false;

  const extensions = [
    StarterKit.configure(starterKitOptions),
    Placeholder.configure({ placeholder }),
    CharacterCount,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Image,
    Link.configure({ openOnClick: false, linkOnPaste: true }),
  ];

  const editor = useEditor({
    extensions,
    content: content ?? { type: 'doc', content: [] },
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const words = editor.storage.characterCount?.words() ?? 0;
      onChange(json, words);

      if (!readOnly) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => onSave?.(), autoSaveDelay);
      }
    },
  });

  // Sync content from parent (offline / initial load)
  useEffect(() => {
    if (!editor || !content || collabReady) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(content);
    if (current !== incoming) editor.commands.setContent(content);
  }, [content, editor, collabReady]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL del enlace:', prev ?? '');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertTable = () =>
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  if (!editor) return null;

  const wordCount = editor.storage.characterCount?.words() ?? 0;

  return (
    <div className="block-editor">
      {/* Toolbar */}
      {!readOnly && (
        <div className="editor-toolbar">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''} title="Negrita"><Bold className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''} title="Cursiva"><Italic className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'active' : ''} title="Tachado"><span className="text-xs font-bold" style={{ textDecoration: 'line-through' }}>S</span></button>
          <div className="sep" />
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'active' : ''} title="Título 1"><Heading1 className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'active' : ''} title="Título 2"><Heading2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'active' : ''} title="Título 3"><Heading3 className="w-3.5 h-3.5" /></button>
          <div className="sep" />
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'active' : ''} title="Lista"><List className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'active' : ''} title="Lista numerada"><ListOrdered className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'active' : ''} title="Cita"><Quote className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'active' : ''} title="Código"><Code className="w-3.5 h-3.5" /></button>
          <div className="sep" />
          <button onClick={insertTable} title="Insertar tabla"><TableIcon className="w-3.5 h-3.5" /></button>
          <button onClick={setLink} className={editor.isActive('link') ? 'active' : ''} title="Enlace"><LinkIcon className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separador"><Minus className="w-3.5 h-3.5" /></button>
          <div className="sep" />
          <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer"><Undo className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer"><Redo className="w-3.5 h-3.5" /></button>
          {onSave && (
            <>
              <div className="sep" />
              <button onClick={onSave} className="save-btn" title="Guardar versión"><Save className="w-3.5 h-3.5" /><span>Guardar</span></button>
            </>
          )}

          {/* Online users (collaboration) */}
          {onlineUsers.length > 0 && (
            <div className="collab-users" title={`En línea: ${onlineUsers.map(u => u.name).join(', ')}`}>
              <Users className="w-3 h-3" />
              {onlineUsers.slice(0, 4).map((u, i) => (
                <span
                  key={i}
                  className="collab-avatar"
                  style={{ background: u.color }}
                  title={u.name}
                >
                  {u.name[0]?.toUpperCase()}
                </span>
              ))}
              {onlineUsers.length > 4 && <span className="text-xs text-gray-400">+{onlineUsers.length - 4}</span>}
            </div>
          )}

          <div className="word-count">{wordCount} palabras</div>
        </div>
      )}

      {/* Read-only online users */}
      {readOnly && onlineUsers.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-100 bg-gray-50">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-500">En línea:</span>
          {onlineUsers.map((u, i) => (
            <span key={i} className="collab-avatar" style={{ background: u.color }} title={u.name}>
              {u.name[0]?.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      <EditorContent editor={editor} className="editor-content" />

      <style>{`
        .block-editor { display: flex; flex-direction: column; min-height: 200px; }
        .editor-toolbar {
          display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
          padding: 6px 8px; border-bottom: 1px solid var(--border, #e5e7eb);
          background: var(--bg, #f9fafb); border-radius: 6px 6px 0 0;
        }
        .editor-toolbar button {
          display: flex; align-items: center; justify-content: center; gap: 4px;
          padding: 4px 6px; border-radius: 4px; border: none; background: transparent;
          color: var(--text-muted, #6b7280); cursor: pointer; font-size: 12px; transition: all 0.12s;
        }
        .editor-toolbar button:hover { background: var(--border, #e5e7eb); color: var(--text, #111827); }
        .editor-toolbar button.active { background: var(--navy, #1b3a6b); color: white; }
        .editor-toolbar button:disabled { opacity: 0.35; cursor: not-allowed; }
        .editor-toolbar .sep { width: 1px; height: 18px; background: var(--border, #e5e7eb); margin: 0 2px; }
        .editor-toolbar .save-btn { background: var(--navy, #1b3a6b); color: white; padding: 4px 10px; }
        .editor-toolbar .save-btn:hover { background: #0f2d5a; }
        .editor-toolbar .word-count { margin-left: auto; font-size: 11px; color: var(--text-muted, #9ca3af); padding-left: 6px; white-space: nowrap; }
        .collab-users { display: flex; align-items: center; gap: 4px; margin-left: 4px; padding: 0 4px; border-left: 1px solid var(--border, #e5e7eb); }
        .collab-avatar { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: white; flex-shrink: 0; }
        .editor-content { flex: 1; padding: 1.25rem 1.5rem; min-height: 200px; outline: none; font-size: 15px; line-height: 1.7; color: var(--text, #111827); }
        .editor-content .ProseMirror { outline: none; min-height: 180px; }
        .editor-content .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: var(--text-muted, #9ca3af); pointer-events: none; height: 0; }
        .editor-content .ProseMirror h1 { font-size: 1.6rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .editor-content .ProseMirror h2 { font-size: 1.3rem; font-weight: 600; margin: 0.9rem 0 0.4rem; }
        .editor-content .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin: 0.8rem 0 0.3rem; }
        .editor-content .ProseMirror ul, .editor-content .ProseMirror ol { padding-left: 1.5rem; margin: 0.5rem 0; }
        .editor-content .ProseMirror li { margin: 0.2rem 0; }
        .editor-content .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 1rem; color: #6b7280; margin: 0.75rem 0; }
        .editor-content .ProseMirror code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 3px; font-family: monospace; font-size: 0.85em; }
        .editor-content .ProseMirror pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 6px; overflow-x: auto; }
        .editor-content .ProseMirror pre code { background: none; color: inherit; }
        .editor-content .ProseMirror hr { border: none; border-top: 2px solid #e5e7eb; margin: 1rem 0; }
        .editor-content .ProseMirror table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
        .editor-content .ProseMirror table td, .editor-content .ProseMirror table th { border: 1px solid #d1d5db; padding: 6px 10px; min-width: 60px; }
        .editor-content .ProseMirror table th { background: #f3f4f6; font-weight: 600; }
        .editor-content .ProseMirror a { color: #2563eb; text-decoration: underline; }
      `}</style>
    </div>
  );
}
