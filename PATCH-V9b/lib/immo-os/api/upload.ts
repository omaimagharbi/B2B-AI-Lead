import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'
import { sniffImage, MAX_UPLOAD_BYTES } from '@/lib/immo-os/image'

const BUCKET = 'immo-photos'

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { data: ok } = await supabaseAdmin.rpc('verifier_rate_limit', { p_identifiant: `immo-up:${auth.clientUserId}`, p_max: 30, p_fenetre_minutes: 10 })
  if (ok === false) return NextResponse.json({ error: 'Too many uploads. Please wait a few minutes.' }, { status: 429 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received' }, { status: 400 })
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'Image must be under 4 MB' }, { status: 413 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = sniffImage(bytes)
  if (!kind) return NextResponse.json({ error: 'Only JPG, PNG or WebP images are accepted' }, { status: 415 })

  // Chemin impose par le serveur (dossier = agence) : le nom du fichier envoye n'est jamais utilise
  const path = `${auth.clientId}/${crypto.randomUUID()}.${kind.ext}`
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: kind.mime, cacheControl: '31536000', upsert: false })
  if (error) {
    const missing = /bucket not found/i.test(error.message)
    console.error('immo upload:', error.message)
    return NextResponse.json({ error: missing ? 'Photo storage is not set up yet (run migration 72).' : 'Upload failed' }, { status: missing ? 503 : 500 })
  }
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
