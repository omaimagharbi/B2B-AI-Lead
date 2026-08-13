import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Route publique (pas d'authentification) : capture l'interet d'un visiteur
// pour une carte pas encore codee, sans creer de compte. Utilisee par la
// fenetre "Beta privee" sur la page d'accueil.
export async function POST(req: NextRequest) {
  try {
    const { email, nom_entreprise, telephone, carte_slug, sous_secteur } = await req.json()

    if (!email || !carte_slug) {
      return NextResponse.json({ error: 'Email et carte manquants' }, { status: 400 })
    }
    if (!nom_entreprise || !String(nom_entreprise).trim()) {
      return NextResponse.json({ error: "Le nom de l'entreprise est requis" }, { status: 400 })
    }
    if (!telephone || !String(telephone).trim()) {
      return NextResponse.json({ error: 'Le numéro de téléphone est requis' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('beta_demandes').insert({
      email: String(email).trim().toLowerCase(),
      nom_entreprise: String(nom_entreprise).trim(),
      telephone: String(telephone).trim(),
      carte_slug: String(carte_slug).trim(),
      sous_secteur: sous_secteur ? String(sous_secteur).trim() : null,
    })

    if (error) {
      console.error('Erreur insertion beta_demandes:', error)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur route beta/demande:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
