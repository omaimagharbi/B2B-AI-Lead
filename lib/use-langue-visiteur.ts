'use client'

import { useEffect, useState } from 'react'
import type { Langue } from './i18n'
import { definirLangueLitterale } from './litteral'

const valide = (v: string | null): v is Langue => v === 'fr' || v === 'en' || v === 'ar'

// Langue d'une page publique ou d'inscription : ?lang= dans le lien > choix memorise > anglais par defaut.
export function useLangueVisiteur(): [Langue, (l: Langue) => void] {
  const [langue, setLangueEtat] = useState<Langue>('en')
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('lang')
    const sauvegardee = window.localStorage.getItem('pilobrain_langue')
    if (valide(param)) {
      setLangueEtat(param)
      window.localStorage.setItem('pilobrain_langue', param)
    } else if (valide(sauvegardee)) {
      setLangueEtat(sauvegardee)
    }
  }, [])
  const changer = (l: Langue) => {
    setLangueEtat(l)
    window.localStorage.setItem('pilobrain_langue', l)
  }
  definirLangueLitterale(langue)
  return [langue, changer]
}
