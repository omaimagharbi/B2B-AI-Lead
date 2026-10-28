'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

// Bascule mode jour (creme/blanc) <-> mode sombre (bleu). Preference memorisee.
export default function ThemeToggle({
  className = '',
  variant = 'box',
}: {
  className?: string
  variant?: 'box' | 'plain'
}) {
  const [sombre, setSombre] = useState(false)

  useEffect(() => {
    setSombre(document.documentElement.classList.contains('dark'))
  }, [])

  const basculer = () => {
    const nouveau = !sombre
    setSombre(nouveau)
    document.documentElement.classList.toggle('dark', nouveau)
    try {
      window.localStorage.setItem('pilobrain_theme', nouveau ? 'dark' : 'light')
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={sombre ? 'Passer en mode jour' : 'Passer en mode sombre'}
      title={sombre ? 'Mode jour' : 'Mode sombre'}
      className={`${
        variant === 'plain'
          ? 'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors'
          : 'keep-theme w-9 h-9 shrink-0 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/30 transition-colors'
      } ${className}`}
    >
      {sombre ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
