import { redirect } from 'next/navigation'

// Lien court a envoyer aux prospects immobilier : /immobilier (ajouter ?lang=fr|ar pour une autre langue)
export default function Immobilier({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = searchParams.lang === 'fr' || searchParams.lang === 'ar' ? `&lang=${searchParams.lang}` : ''
  redirect(`/secteurs?secteur=immobilier${lang}`)
}
