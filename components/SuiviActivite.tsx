'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Monte une seule fois dans app/layout.tsx : suit TOUTES les pages sans
// toucher aux pages elles-memes. Envoie un signal d'activite a l'arrivee sur
// chaque page puis toutes les 30 s tant que l'onglet est visible. Une
// nouvelle "visite" demarre a chaque connexion, ou apres 30 min d'inactivite.
const CLE_STOCKAGE = 'pilobrain_suivi_session'
const INTERVALLE_MS = 30_000
const INACTIVITE_MAX_MS = 30 * 60_000

function nouvelId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Reutilise la visite en cours seulement si c'est le meme utilisateur et
// qu'il n'y a pas eu 30 min d'inactivite ; sinon on demarre une nouvelle visite.
function lireSession(userId: string): string {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE)
    if (brut) {
      const { id, t, u } = JSON.parse(brut)
      if (id && u === userId && Date.now() - t < INACTIVITE_MAX_MS) return id
    }
  } catch {}
  return nouvelId()
}

function enregistrerSession(id: string, userId: string) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ id, t: Date.now(), u: userId }))
  } catch {}
}

function decrireAppareil(): string {
  const ua = navigator.userAgent
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
    ? 'Android'
    : /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS/.test(ua)
    ? 'macOS'
    : /Linux/.test(ua)
    ? 'Linux'
    : 'Autre'
  const nav = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
    ? 'Chrome'
    : /Firefox\//.test(ua)
    ? 'Firefox'
    : /Safari\//.test(ua)
    ? 'Safari'
    : 'Navigateur'
  return `${nav} / ${os}`
}

export default function SuiviActivite() {
  const pathname = usePathname()
  const cheminRef = useRef(pathname)

  cheminRef.current = pathname

  const ping = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return

      const userId = data.session?.user.id ?? ''
      const id = lireSession(userId)
      enregistrerSession(id, userId)

      await fetch('/api/suivi/ping', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          session_id: id,
          chemin: cheminRef.current,
          appareil: decrireAppareil(),
        }),
      })
    } catch {
      // jamais bloquant pour l'utilisateur
    }
  }

  // Changement de page => signal immediat
  useEffect(() => {
    ping()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    const minuteur = setInterval(() => {
      if (document.visibilityState === 'visible') ping()
    }, INTERVALLE_MS)

    const auRetour = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', auRetour)

    // Deconnexion = on oublie la visite ; la prochaine connexion en cree une
    // nouvelle. (SIGNED_IN n'est pas utilise : Supabase l'emet aussi quand
    // l'onglet reprend le focus, ce qui gonflerait le nombre de connexions.)
    const { data: abonnement } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === 'SIGNED_IN') ping()
      if (evenement === 'SIGNED_OUT') {
        try {
          localStorage.removeItem(CLE_STOCKAGE)
        } catch {}
      }
    })

    return () => {
      clearInterval(minuteur)
      document.removeEventListener('visibilitychange', auRetour)
      abonnement.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
