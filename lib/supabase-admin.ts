import { createClient } from '@supabase/supabase-js'

// ATTENTION : ce client utilise la service_role key, qui contourne les RLS.
// Il ne doit JAMAIS être importé dans un composant "use client" ou exposé au navigateur.
// Utilisation uniquement dans les fichiers app/api/**/route.ts (execution serveur).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
