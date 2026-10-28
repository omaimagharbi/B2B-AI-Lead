'use client'
import { useEffect, useState } from 'react'

// Lit un parametre d'URL cote navigateur (evite useSearchParams et son exigence de Suspense au build).
export function useQueryParam(name: string): string | null {
  const [v, setV] = useState<string | null>(null)
  useEffect(() => {
    setV(new URLSearchParams(window.location.search).get(name))
  }, [name])
  return v
}
export function confirmDelete(what: string): boolean {
  return typeof window !== 'undefined' && window.confirm(`Delete ${what}? This cannot be undone.`)
}
