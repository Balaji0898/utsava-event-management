'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Undo2,
  Redo2,
} from 'lucide-react';

/**
 * Lightweight WYSIWYG editor (tiptap) used by the admin Legal editor.
 * Emits HTML via `onChange`. The public pages sanitize before rendering.
 */
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false, // avoid SSR hydration mismatch in Next.js
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener', target: '_blank' } }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[280px] rounded-b-xl border border-t-0 px-4 py-3 outline-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync in external content (e.g. after it loads from the API).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className="min-h-[320px] animate-pulse rounded-xl border bg-[rgb(var(--muted))]" />;
  }

  return (
    <div className="rounded-xl">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `flex h-8 w-8 items-center justify-center rounded-md transition ${
      active ? 'bg-brand-500 text-ink' : 'hover:bg-[rgb(var(--muted))]'
    }`;

  const addLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border bg-[rgb(var(--muted))] p-1.5">
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive('heading', { level: 2 }))} aria-label="Heading 2">
        <Heading2 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive('heading', { level: 3 }))} aria-label="Heading 3">
        <Heading3 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))} aria-label="Bold">
        <Bold size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))} aria-label="Italic">
        <Italic size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))} aria-label="Bullet list">
        <List size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))} aria-label="Numbered list">
        <ListOrdered size={16} />
      </button>
      <button type="button" onClick={addLink} className={btn(editor.isActive('link'))} aria-label="Link">
        <LinkIcon size={16} />
      </button>
      <span className="mx-1 h-5 w-px bg-[rgb(var(--border))]" />
      <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btn(false)} aria-label="Undo">
        <Undo2 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btn(false)} aria-label="Redo">
        <Redo2 size={16} />
      </button>
    </div>
  );
}
