import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'
import { sniffImage, MAX_UPLOAD_BYTES } from '@/lib/immo-os/image'
import { sniffChatFile, CHAT_BUCKET, CHAT_MAX_BYTES } from '@/lib/immo-os/media'

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

  // Lot 6b : ?kind=chat -> fichier de conversation (image ou PDF) range dans le bucket des conversations
  const chat = req.nextUrl.searchParams.get('kind') === 'chat'
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (chat) {
    if (bytes.length > CHAT_MAX_BYTES) return NextResponse.json({ error: 'File must be under 4 MB' }, { status: 413 })
    const f = sniffChatFile(bytes)
    if (!f) return NextResponse.json({ error: 'Only JPG, PNG, WebP images or PDF files are accepted' }, { status: 415 })
    const cpath = `${auth.clientId}/out/${crypto.randomUUID()}.${f.ext}`
    const up = await supabaseAdmin.storage.from(CHAT_BUCKET).upload(cpath, bytes, { contentType: f.mime, cacheControl: '31536000', upsert: false })
    if (up.error) { const missing = /bucket not found/i.test(up.error.message); return NextResponse.json({ error: missing ? 'File storage is not set up yet (run migration 80).' : 'Upload failed' }, { status: missing ? 503 : 500 }) }
    return NextResponse.json({ url: supabaseAdmin.storage.from(CHAT_BUCKET).getPublicUrl(cpath).data.publicUrl, type: f.type, name: file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 80) })
  }
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
