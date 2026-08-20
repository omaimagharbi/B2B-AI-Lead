'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PAYS_DISPONIBLES } from '@/lib/pays'

type Profil = {
  id: string
  nom_complet: string | null
  telephone: string | null
  photo_url: string | null
  pays: string | null
  genre: string | null
  date_naissance: string | null
}

type Experience = {
  id: string
  intitule: string
  entreprise: string | null
  date_debut: string | null
  date_fin: string | null
  en_cours: boolean
  description: string | null
}

type Formation = {
  id: string
  diplome: string
  etablissement: string | null
  date_debut: string | null
  date_fin: string | null
  en_cours: boolean
  description: string | null
}

type Mission = {
  id: string
  titre: string
  description: string | null
  statut: 'en_cours' | 'terminee'
}

async function fetchAvecToken(url: string, options: RequestInit = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
}

export default function ProfilPage() {
  const router = useRouter()
  const [chargement, setChargement] = useState(true)
  const [email, setEmail] = useState('')
  const [profil, setProfil] = useState<Profil | null>(null)
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [formations, setFormations] = useState<Formation[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [uploadEnCours, setUploadEnCours] = useState(false)
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false)

  useEffect(() => {
    const charger = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/auth')
        return
      }
      setEmail(sessionData.session.user.email ?? '')

      const { data: clientUser } = await supabase
        .from('client_users')
        .select('id, nom_complet, telephone, photo_url, pays, genre, date_naissance')
        .eq('auth_user_id', sessionData.session.user.id)
        .single()

      if (clientUser) setProfil(clientUser as Profil)

      const [resExp, resForm, resMiss] = await Promise.all([
        fetchAvecToken('/api/profil/experiences'),
        fetchAvecToken('/api/profil/formations'),
        fetchAvecToken('/api/profil/missions'),
      ])
      if (resExp.ok) setExperiences((await resExp.json()).experiences ?? [])
      if (resForm.ok) setFormations((await resForm.json()).formations ?? [])
      if (resMiss.ok) setMissions((await resMiss.json()).missions ?? [])

      setChargement(false)
    }
    charger()
  }, [router])

  const sauvegarderProfil = async (changements: Partial<Profil>) => {
    if (!profil) return
    setProfil({ ...profil, ...changements })
    setSauvegardeEnCours(true)
    await fetchAvecToken('/api/team/modifier', {
      method: 'PATCH',
      body: JSON.stringify({ id: profil.id, ...changements }),
    })
    setSauvegardeEnCours(false)
  }

  const uploaderPhoto = async (fichier: File) => {
    if (!profil) return
    setUploadEnCours(true)
    try {
      const chemin = `${profil.id}-${Date.now()}.${fichier.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(chemin, fichier)
      if (error) {
        alert("Échec de l'upload de la photo")
        return
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(chemin)
      await sauvegarderProfil({ photo_url: urlData.publicUrl })
    } finally {
      setUploadEnCours(false)
    }
  }

  if (chargement) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Chargement...</p>
      </main>
    )
  }

  if (!profil) return null

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">👤 Mon profil</h1>
          <a href="/dashboard" className="text-sm text-accent underline">
            ← Retour au dashboard
          </a>
        </div>

        {/* Photo + infos générales */}
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              {profil.photo_url ? (
                <img
                  src={profil.photo_url}
                  alt="Photo de profil"
                  className="w-20 h-20 rounded-full object-cover border-2 border-slate-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl border-2 border-slate-700">
                  🙂
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploaderPhoto(e.target.files[0])}
              />
              <span className="block text-xs text-accent mt-1 text-center">
                {uploadEnCours ? '...' : 'Changer'}
              </span>
            </label>
            <div>
              <p className="font-semibold text-lg">{profil.nom_complet || '(sans nom)'}</p>
              <p className="text-slate-400 text-sm">{email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Nom complet</label>
              <input
                value={profil.nom_complet ?? ''}
                onChange={(e) => setProfil({ ...profil, nom_complet: e.target.value })}
                onBlur={(e) => sauvegarderProfil({ nom_complet: e.target.value })}
                className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Téléphone</label>
              <input
                value={profil.telephone ?? ''}
                onChange={(e) => setProfil({ ...profil, telephone: e.target.value })}
                onBlur={(e) => sauvegarderProfil({ telephone: e.target.value })}
                placeholder="+216 XX XXX XXX"
                className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Pays</label>
              <select
                value={profil.pays ?? ''}
                onChange={(e) => sauvegarderProfil({ pays: e.target.value })}
                className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              >
                <option value="">—</option>
                {PAYS_DISPONIBLES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Genre</label>
              <select
                value={profil.genre ?? ''}
                onChange={(e) => sauvegarderProfil({ genre: e.target.value })}
                className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              >
                <option value="">—</option>
                <option value="femme">Femme</option>
                <option value="homme">Homme</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Date de naissance</label>
              <input
                type="date"
                value={profil.date_naissance ?? ''}
                onChange={(e) => sauvegarderProfil({ date_naissance: e.target.value })}
                className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
            </div>
          </div>
          {sauvegardeEnCours && <p className="text-xs text-slate-500">Enregistrement...</p>}
        </section>

        <SectionExperiences experiences={experiences} setExperiences={setExperiences} />
        <SectionFormations formations={formations} setFormations={setFormations} />
        <SectionMissions missions={missions} setMissions={setMissions} />
      </div>
    </main>
  )
}

function SectionExperiences({
  experiences,
  setExperiences,
}: {
  experiences: Experience[]
  setExperiences: (v: Experience[]) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [form, setForm] = useState({
    intitule: '',
    entreprise: '',
    date_debut: '',
    date_fin: '',
    en_cours: false,
    description: '',
  })

  const ajouter = async () => {
    if (!form.intitule.trim()) return
    const res = await fetchAvecToken('/api/profil/experiences', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      setExperiences([data.experience, ...experiences])
      setForm({ intitule: '', entreprise: '', date_debut: '', date_fin: '', en_cours: false, description: '' })
      setOuvert(false)
    }
  }

  const supprimer = async (id: string) => {
    await fetchAvecToken(`/api/profil/experiences?id=${id}`, { method: 'DELETE' })
    setExperiences(experiences.filter((e) => e.id !== id))
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">💼 Expériences</h2>
        <button onClick={() => setOuvert(!ouvert)} className="text-xs text-accent">
          {ouvert ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {experiences.length === 0 && !ouvert && (
        <p className="text-slate-500 text-sm">Aucune expérience renseignée.</p>
      )}

      <div className="space-y-3">
        {experiences.map((exp) => (
          <div key={exp.id} className="rounded-lg border border-slate-800 p-3 flex justify-between gap-3">
            <div>
              <p className="font-medium text-sm">{exp.intitule}</p>
              {exp.entreprise && <p className="text-slate-400 text-xs">{exp.entreprise}</p>}
              <p className="text-slate-500 text-xs">
                {exp.date_debut ?? '?'} — {exp.en_cours ? 'en cours' : exp.date_fin ?? '?'}
              </p>
              {exp.description && <p className="text-slate-400 text-xs mt-1">{exp.description}</p>}
            </div>
            <button onClick={() => supprimer(exp.id)} className="text-xs text-red-400 shrink-0">
              Retirer
            </button>
          </div>
        ))}
      </div>

      {ouvert && (
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <input
            value={form.intitule}
            onChange={(e) => setForm({ ...form, intitule: e.target.value })}
            placeholder="Intitulé du poste"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
          />
          <input
            value={form.entreprise}
            onChange={(e) => setForm({ ...form, entreprise: e.target.value })}
            placeholder="Entreprise"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.date_debut}
              onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <input
              type="date"
              value={form.date_fin}
              disabled={form.en_cours}
              onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm disabled:opacity-40"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={form.en_cours}
              onChange={(e) => setForm({ ...form, en_cours: e.target.checked })}
            />
            Poste actuel
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optionnel)"
            rows={2}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
          />
          <button onClick={ajouter} className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold">
            Enregistrer
          </button>
        </div>
      )}
    </section>
  )
}

function SectionFormations({
  formations,
  setFormations,
}: {
  formations: Formation[]
  setFormations: (v: Formation[]) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [form, setForm] = useState({
    diplome: '',
    etablissement: '',
    date_debut: '',
    date_fin: '',
    en_cours: false,
    description: '',
  })

  const ajouter = async () => {
    if (!form.diplome.trim()) return
    const res = await fetchAvecToken('/api/profil/formations', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      setFormations([data.formation, ...formations])
      setForm({ diplome: '', etablissement: '', date_debut: '', date_fin: '', en_cours: false, description: '' })
      setOuvert(false)
    }
  }

  const supprimer = async (id: string) => {
    await fetchAvecToken(`/api/profil/formations?id=${id}`, { method: 'DELETE' })
    setFormations(formations.filter((f) => f.id !== id))
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🎓 Formation</h2>
        <button onClick={() => setOuvert(!ouvert)} className="text-xs text-accent">
          {ouvert ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {formations.length === 0 && !ouvert && (
        <p className="text-slate-500 text-sm">Aucune formation renseignée.</p>
      )}

      <div className="space-y-3">
        {formations.map((f) => (
          <div key={f.id} className="rounded-lg border border-slate-800 p-3 flex justify-between gap-3">
            <div>
              <p className="font-medium text-sm">{f.diplome}</p>
              {f.etablissement && <p className="text-slate-400 text-xs">{f.etablissement}</p>}
              <p className="text-slate-500 text-xs">
                {f.date_debut ?? '?'} — {f.en_cours ? 'en cours' : f.date_fin ?? '?'}
              </p>
              {f.description && <p className="text-slate-400 text-xs mt-1">{f.description}</p>}
            </div>
            <button onClick={() => supprimer(f.id)} className="text-xs text-red-400 shrink-0">
              Retirer
            </button>
          </div>
        ))}
      </div>

      {ouvert && (
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <input
            value={form.diplome}
            onChange={(e) => setForm({ ...form, diplome: e.target.value })}
            placeholder="Diplôme / certification"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
          />
          <input
            value={form.etablissement}
            onChange={(e) => setForm({ ...form, etablissement: e.target.value })}
            placeholder="Établissement"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.date_debut}
              onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <input
              type="date"
              value={form.date_fin}
              disabled={form.en_cours}
              onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm disabled:opacity-40"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={form.en_cours}
              onChange={(e) => setForm({ ...form, en_cours: e.target.checked })}
            />
            En cours
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optionnel)"
            rows={2}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
          />
          <button onClick={ajouter} className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold">
            Enregistrer
          </button>
        </div>
      )}
    </section>
  )
}

function SectionMissions({
  missions,
  setMissions,
}: {
  missions: Mission[]
  setMissions: (v: Mission[]) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [form, setForm] = useState({ titre: '', description: '' })

  const ajouter = async () => {
    if (!form.titre.trim()) return
    const res = await fetchAvecToken('/api/profil/missions', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      setMissions([data.mission, ...missions])
      setForm({ titre: '', description: '' })
      setOuvert(false)
    }
  }

  const basculerStatut = async (mission: Mission) => {
    const nouveauStatut = mission.statut === 'terminee' ? 'en_cours' : 'terminee'
    setMissions(missions.map((m) => (m.id === mission.id ? { ...m, statut: nouveauStatut } : m)))
    await fetchAvecToken('/api/profil/missions', {
      method: 'PATCH',
      body: JSON.stringify({ id: mission.id, statut: nouveauStatut }),
    })
  }

  const supprimer = async (id: string) => {
    await fetchAvecToken(`/api/profil/missions?id=${id}`, { method: 'DELETE' })
    setMissions(missions.filter((m) => m.id !== id))
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🎯 Missions</h2>
        <button onClick={() => setOuvert(!ouvert)} className="text-xs text-accent">
          {ouvert ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {missions.length === 0 && !ouvert && <p className="text-slate-500 text-sm">Aucune mission renseignée.</p>}

      <div className="space-y-3">
        {missions.map((m) => (
          <div key={m.id} className="rounded-lg border border-slate-800 p-3 flex justify-between gap-3">
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                {m.titre}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    m.statut === 'terminee' ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'
                  }`}
                >
                  {m.statut === 'terminee' ? 'Terminée' : 'En cours'}
                </span>
              </p>
              {m.description && <p className="text-slate-400 text-xs mt-1">{m.description}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button onClick={() => basculerStatut(m)} className="text-xs text-accent">
                {m.statut === 'terminee' ? 'Rouvrir' : 'Terminer'}
              </button>
              <button onClick={() => supprimer(m.id)} className="text-xs text-red-400">
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>

      {ouvert && (
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <input
            value={form.titre}
            onChange={(e) => setForm({ ...form, titre: e.target.value })}
            placeholder="Titre de la mission"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optionnel)"
            rows={2}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
          />
          <button onClick={ajouter} className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold">
            Enregistrer
          </button>
        </div>
      )}
    </section>
  )
}
