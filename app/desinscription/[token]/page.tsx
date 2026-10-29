import { supabaseAdmin } from '@/lib/supabase-admin'

async function desinscrire(token: string) {
  const { data, error } = await supabaseAdmin
    .from('targets')
    .update({ ne_plus_contacter: true })
    .eq('token_desinscription', token)
    .select('nom')
    .single()

  return !error && !!data
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
