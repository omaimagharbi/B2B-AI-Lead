import { supabaseAdmin } from '@/lib/supabase-admin'
import { desinscrireParJeton } from '@/lib/immo-os/optout-server'
import { translate } from '@/lib/immo-os/i18n'

async function desinscrire(token: string) {
  const { data, error } = await supabaseAdmin
    .from('targets')
    .update({ ne_plus_contacter: true })
    .eq('token_desinscription', token)
    .select('nom')
    .single()

  if (!error && !!data) return true
  // Real Estate OS (migration 78) : meme page, jeton d'un lead / client / proprietaire d'une agence immobiliere
  return desinscrireParJeton(token)
}

export default async function DesinscriptionPage({ params }: { params: { token: string } }) {
  const succes = await desinscrire(params.token)

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        {succes ? (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold">Vous avez été désinscrit(e)</h1>
            <p className="text-slate-400">
              Vous ne recevrez plus aucun message de notre part. Si c'était une erreur, vous pouvez
              nous contacter directement.
            </p>
            <p className="text-slate-500 text-sm">{translate('en', 'pol.unsub.ok')}</p>
            <p className="text-slate-500 text-sm" dir="rtl">{translate('ar', 'pol.unsub.ok')}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Lien invalide</h1>
            <p className="text-slate-400">
              Ce lien de désinscription n'est plus valide ou a déjà été utilisé.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
