'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type MessageChat = { role: 'user' | 'bot'; texte: string }

export default function ChatbotWidget() {
  const [ouvert, setOuvert] = useState(false)
  const [messages, setMessages] = useState<MessageChat[]>([
    { role: 'bot', texte: '👋 Bonjour ! Pose-moi une question sur l\'utilisation de la plateforme.' },
  ])
  const [historiqueCharge, setHistoriqueCharge] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)

  // Les discussions sont desormais enregistrees cote serveur - on recharge
  // l'historique a la premiere ouverture du widget, pour qu'il persiste
  // entre deux visites/rafraichissements de page.
  useEffect(() => {
    if (!ouvert || historiqueCharge) return
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        const res = await fetch('/api/chatbot/repondre', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages.map((m: { role: 'user' | 'bot'; texte: string }) => ({
            role: m.role,
            texte: m.texte,
          })))
        }
      } catch {
        // best-effort - on garde le message d'accueil par defaut si ca echoue
      }
      setHistoriqueCharge(true)
    })()
  }, [ouvert, historiqueCharge])

  const envoyer = async () => {
    const question = saisie.trim()
    if (!question || enCours) return
    setMessages((m) => [...m, { role: 'user', texte: question }])
    setSaisie('')
    setEnCours(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/chatbot/repondre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      setMessages((m) => [...m, { role: 'bot', texte: data.reponse ?? 'Erreur de réponse.' }])
    } catch {
      setMessages((m) => [...m, { role: 'bot', texte: 'Erreur de connexion, réessaie.' }])
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {ouvert && (
        <div className="mb-3 w-80 h-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">🤖 Assistant PiloBrain</span>
            <button onClick={() => setOuvert(false)} className="text-slate-400 hover:text-white text-sm">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-accent text-slate-950 ml-auto'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {m.texte}
              </div>
            ))}
            {enCours && <div className="text-slate-500 text-xs">L'assistant écrit...</div>}
          </div>
          <div className="p-2 border-t border-slate-800 flex gap-2">
            <input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && envoyer()}
              placeholder="Ta question..."
              className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <button
              onClick={envoyer}
              disabled={enCours}
              className="px-3 py-2 rounded-lg bg-accent text-slate-950 text-sm font-semibold disabled:opacity-50"
            >
              ➤
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOuvert(!ouvert)}
        className="w-14 h-14 rounded-full bg-navy shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition"
        aria-label="Ouvrir l'assistant"
      >
        🤖
      </button>
    </div>
  )
}
