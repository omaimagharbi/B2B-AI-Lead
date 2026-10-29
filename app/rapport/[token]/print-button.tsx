'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:opacity-90 transition"
    >
      Télécharger en PDF
    </button>
  )
}
