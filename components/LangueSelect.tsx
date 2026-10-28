'use client'

import type { Langue } from '@/lib/i18n'

// Petit selecteur de langue sans cadre (meme style que les liens de la barre du haut)
export default function LangueSelect({ langue, onChange }: { langue: Langue; onChange: (l: Langue) => void }) {
  return (
    <select
      value={langue}
      onChange={(e) => onChange(e.target.value as Langue)}
      aria-label="Language"
      className="text-[13px] text-slate-400 hover:text-white bg-transparent cursor-pointer focus:outline-none"
    >
      <option value="en">EN</option>
      <option value="fr">FR</option>
      <option value="ar">AR</option>
    </select>
  )
}
