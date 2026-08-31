'use client'

import { useEffect, useState } from 'react'

type Creneau = { debut: string; fin: string }

export default function ReserverPage({ params }: { params: { token: string } }) {
  const [chargement, setChargement] = useState(true)
  const [connecte, setConnecte] = useState(true)
  const [nomCabinet, setNomCabinet] = useState('')
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [reserve, setReserve] = useState(false)

  useEffect(() => {
    fetch(`/api/reserver/${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErreur(data.error)
        } else {
          setConnecte(data.connecte)
          setNomCabinet(data.nom_cabinet ?? '')
          setCreneaux(data.creneaux ?? [])
        }
      })
      .catch(() => setErreur('Impossible de charger les disponibilités'))
      .finally(() => setChargement(false))
  }, [params.token])

  const reserverCreneau = async (debut: string) => {
    setEnCours(debut)
    setErreur(null)
    try {
      const res = await fetch(`/api/reserver/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debut }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErreur(data.error ?? 'Erreur lors de la réservation')
      } else {
        setReserve(true)
      }
    } catch {
      setErreur('Impossible de contacter le serveur')
    }
    setEnCours(null)
  }

  // Regroupe les creneaux par jour pour un affichage lisible.
  const parJour = creneaux.reduce<Record<string, Creneau[]>>((acc, c) => {
    const jour = new Date(c.debut).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    acc[jour] = acc[jour] ?? []
    acc[jour].push(c)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans antialiased flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        {chargement ? (
          <div className="text-center space-y-4">
            <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400">Chargement des disponibilités...</p>
          </div>
        ) : reserve ? (
          <div className="text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold">C'est réservé !</h1>
            <p className="text-slate-400">
              Le rendez-vous a été ajouté à l'agenda. Vous recevrez une confirmation.
            </p>
          </div>
        ) : erreur && creneaux.length === 0 ? (
          <div className="text-center space-y-4">
            <p className="text-red-400">{erreur}</p>
          </div>
        ) : !connecte ? (
          <div className="text-center space-y-4">
            <h1 className="text-xl font-bold">Réservation en ligne indisponible</h1>
            <p className="text-slate-400">
              {nomCabinet || 'Ce cabinet'} n'a pas encore connecté son calendrier. Contactez-le directement pour
              convenir d'un rendez-vous.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Choisissez un créneau</h1>
            <p className="text-slate-400 text-sm mb-6">
              Disponibilités réelles de {nomCabinet || 'votre interlocuteur'} sur les 2 prochaines semaines.
            </p>
            {erreur && <p className="text-red-400 text-sm mb-4">{erreur}</p>}
            {creneaux.length === 0 ? (
              <p className="text-slate-500 text-sm">Aucun créneau disponible pour le moment.</p>
            ) : (
              <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                {Object.entries(parJour).map(([jour, liste]) => (
                  <div key={jour}>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">{jour}</p>
                    <div className="flex flex-wrap gap-2">
                      {liste.map((c) => (
                        <button
                          key={c.debut}
                          onClick={() => reserverCreneau(c.debut)}
                          disabled={enCours === c.debut}
                          className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-accent hover:text-accent disabled:opacity-40"
                        >
                          {enCours === c.debut
                            ? '...'
                            : new Date(c.debut).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
