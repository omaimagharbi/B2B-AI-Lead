import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import PrintButton from './print-button'

type Module = { nom: string; priorite: string; description: string }
type Rapport = {
  titre: string
  synthese: string
  modules: Module[]
  certification_recommandee: string
  duree_estimee: string
}

async function getRapport(token: string): Promise<Rapport | null> {
  const { data, error } = await supabaseAdmin
    .from('diagnostics')
    .select('reponse_ia_complete, statut')
    .eq('token_acces', token)
    .single()

  // Securite : le rapport n'est visible que si le lead a bien ete debloque
  // (donc le prospect a laisse ses coordonnees)
  if (error || !data || data.statut !== 'debloque') return null

  return data.reponse_ia_complete as Rapport
}

export default async function RapportPage({ params }: { params: { token: string } }) {
  const rapport = await getRapport(params.token)

  if (!rapport) notFound()

  return (
    <main className="min-h-screen bg-white text-slate-900 px-6 py-10 print:p-0">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between print:hidden">
          <span className="text-sm text-slate-500">B2B AI Lead Machine — Rapport confidentiel</span>
          <PrintButton />
        </div>

        <header className="space-y-2 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold">{rapport.titre}</h1>
          <p className="text-slate-600">{rapport.synthese}</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Plan de compétences recommandé</h2>
          {rapport.modules?.map((mod, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{mod.nom}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    mod.priorite === 'haute'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  Priorité {mod.priorite}
                </span>
              </div>
              <p className="text-slate-600 mt-1">{mod.description}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
          <div>
            <p className="text-sm text-slate-500">Certification recommandée</p>
            <p className="font-semibold">{rapport.certification_recommandee}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Durée estimée</p>
            <p className="font-semibold">{rapport.duree_estimee}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
