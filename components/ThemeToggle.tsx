'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [sombre, setSombre] = useState(false)

  useEffect(() => {
    const stocke = window.localStorage.getItem('pilobrain_theme')
    const sombreInitial = stocke === 'dark'
    setSombre(sombreInitial)
    document.documentElement.classList.toggle('dark', sombreInitial)
  }, [])

  const basculer = () => {
    const nouveau = !sombre
    setSombre(nouveau)
    document.documentElement.classList.toggle('dark', nouveau)
    window.localStorage.setItem('pilobrain_theme', nouveau ? 'dark' : 'light')
  }

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={sombre ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={sombre ? 'Mode clair' : 'Mode sombre'}
      className="w-8 h-8 shrink-0 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 flex items-center justify-center text-[14px] hover:border-slate-400 dark:hover:border-white/30 transition-colors"
    >
      {sombre ? '☀️' : '🌙'}
    </button>
  )
}
