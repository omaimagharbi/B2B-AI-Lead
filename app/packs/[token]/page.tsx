import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import PackChoisir from './pack-choisir'

type Etape = { nom: string; description: string }
type DiagnosticValide = {
  titre: string
  synthese: string
  methodologie: string
  etapes: Etape[]
}
type Pack = {
  id: string
  pack_propose_nom: string | null
  prix_pack: number | null
  statut_vente: string
}

async function getDonnees(token: string) {
  const { data: diagnostic, error } = await supabaseAdmin
    .from('diagnostics')
    .select('id, json_expert_valide, statut_validation')
    .eq('token_acces', token)
    .single()

  if (error || !diagnostic || diagnostic.statut_validation !== 'valide_par_expert') {
    return null
  }

  const { data: packs } = await supabaseAdmin
    .from('leads_packs')
    .select('id, pack_propose_nom, prix_pack, statut_vente')
    .eq('diagnostic_id', diagnostic.id)

  return {
    diagnostic: diagnostic.json_expert_valide as DiagnosticValide,
    packs: (packs ?? []) as Pack[],
  }
}

export default async function PacksPage({ params }: { params: { token: string } }) {
  const donnees = await getDonnees(params.token)

  if (!donnees) notFound()

  const { diagnostic, packs } = donnees

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <header className="text-center space-y-3">
          <span className="text-accent text-sm font-semibold uppercase tracking-wide">
            Votre solution personnalisée
          </span>
          <h1 className="text-3xl font-bold">{diagnostic.titre}</h1>
          <p className="text-slate-400">{diagnostic.synthese}</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-center">Votre parcours recommandé</h2>
          <div className="space-y-3">
            {diagnostic.etapes?.map((etape, i) => (
              <div key={i} className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex gap-4">
                <div className="text-accent font-bold text-xl">{i + 1}</div>
                <div>
                  <h3 className="font-semibold">{etape.nom}</h3>
                  <p className="text-slate-400 text-sm">{etape.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-center">Choisissez votre pack</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packs.map((pack) => (
              <PackChoisir key={pack.id} pack={pack} />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
