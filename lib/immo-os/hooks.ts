'use client'
import { useEffect, useState } from 'react'
import { fmt, translate, type Lang } from './i18n'

// Lit un parametre d'URL cote navigateur (evite useSearchParams et son exigence de Suspense au build).
export function useQueryParam(name: string): string | null {
  const [v, setV] = useState<string | null>(null)
  useEffect(() => {
    setV(new URLSearchParams(window.location.search).get(name))
  }, [name])
  return v
}
export function confirmDelete(what: string): boolean {
  if (typeof window === 'undefined') return false
  let lang: Lang = 'en'
  try { const l = localStorage.getItem('imo_lang'); if (l === 'ar' || l === 'fr' || l === 'en') lang = l } catch {}
  return window.confirm(fmt(translate(lang, 'cf.delete'), { what }))
}
