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
type Client = { nom_entreprise: string; logo_url: string | null }

async function getDonnees(
  token: string
): Promise<{ rapport: Rapport; client: Client | null; score: number | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('diagnostics')
    .select('reponse_ia_complete, statut, recommandations_json, clients(nom_entreprise, logo_url), targets(score_chaleur)')
    .eq('token_acces', token)
    .single()

  // Securite : le rapport n'est visible que si le lead a bien ete debloque
  // (donc le prospect a laisse ses coordonnees)
  if (error || !data || data.statut !== 'debloque') return null

  // @ts-ignore - jointures Supabase typees dynamiquement
  const client = (data.clients as Client | null) ?? null
  // @ts-ignore - jointures Supabase typees dynamiquement
  const scoreDepuisTarget = data.targets?.score_chaleur as number | null | undefined
  const scoreDepuisReco = (data.recommandations_json as { score?: number } | null)?.score
  const score = scoreDepuisReco ?? scoreDepuisTarget ?? null

  return { rapport: data.reponse_ia_complete as Rapport, client, score }
}

function couleurPriorite(priorite: string) {
  if (priorite === 'haute') return 'bg-red-100 text-red-700'
  if (priorite === 'basse') return 'bg-slate-100 text-slate-600'
  return 'bg-amber-100 text-amber-700'
}

function couleurScore(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700'
  if (score >= 40) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default async function RapportPage({ params }: { params: { token: string } }) {
  const donnees = await getDonnees(params.token)

  if (!donnees) notFound()
  const { rapport, client, score } = donnees

  return (
    <main className="min-h-screen bg-white text-slate-900 px-6 py-10 print:p-0">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between print:hidden">
          <span className="text-sm text-slate-500">Rapport confidentiel</span>
          <PrintButton />
        </div>

        <header className="space-y-4 border-b border-slate-200 pb-6">
          {client && (
            <div className="flex items-center gap-3">
              {client.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.logo_url}
                  alt={client.nom_entreprise}
                  className="w-10 h-10 rounded-lg object-contain border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                  {client.nom_entreprise?.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="font-semibold">{client.nom_entreprise}</span>
            </div>
          )}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{rapport.titre}</h1>
            <p className="text-slate-600">{rapport.synthese}</p>
          </div>
          {typeof score === 'number' && (
            <span
              className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${couleurScore(score)}`}
            >
              Score de confiance : {score}/100
            </span>
          )}
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Plan de compétences recommandé</h2>
          {rapport.modules?.map((mod, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{mod.nom}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${couleurPriorite(mod.priorite)}`}>
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
