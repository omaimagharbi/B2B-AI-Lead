import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ATTENTION : ce client utilise la service_role key, qui contourne les RLS.
// Il ne doit JAMAIS être importé dans un composant "use client" ou exposé au navigateur.

let _supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    )
  }

  _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  return _supabaseAdmin
}

// On exporte un objet "proxy" qui se comporte comme le client Supabase,
// mais qui ne le cree reellement qu'au premier appel (jamais au chargement du module/build)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    // @ts-expect-error - acces dynamique aux methodes du client Supabase
    return client[prop]
  },
})
