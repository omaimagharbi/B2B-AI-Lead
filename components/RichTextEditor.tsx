'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

// Editeur riche minimal (gras, italique, listes, titres) pour que l'expert
// puisse mettre en forme le texte du rapport avant de l'envoyer au prospect.
// Le contenu est stocke/restitue en HTML.
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[120px] px-3 py-2 focus:outline-none text-slate-100 text-sm ' +
          '[&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 ' +
          '[&_ol]:list-decimal [&_ol]:pl-5 [&_h3]:font-semibold [&_h3]:text-base [&_p]:mb-2',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return null

  const boutonClasse = (actif: boolean) =>
    `text-xs px-2 py-1 rounded border ${
      actif
        ? 'bg-accent/20 border-accent/40 text-accent'
        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
    }`

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-2 py-1.5 bg-slate-900/60">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={boutonClasse(editor.isActive('bold'))}
        >
          Gras
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={boutonClasse(editor.isActive('italic'))}
        >
          Italique
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={boutonClasse(editor.isActive('bulletList'))}
        >
          • Liste
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={boutonClasse(editor.isActive('orderedList'))}
        >
          1. Liste
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={boutonClasse(editor.isActive('heading', { level: 3 }))}
        >
          Titre
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={boutonClasse(false)}
        >
          Effacer le format
        </button>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  )
}
