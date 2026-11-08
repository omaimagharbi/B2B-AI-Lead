import type { Property } from './types'
import { propRef } from './property-detect'
import { qar } from './helpers'
import { fmt, translate, type Lang } from './i18n'

// n°4 : texte de la fiche envoyee au client (dans la langue choisie), avec reference, lien public et rappel STOP.
export function composePropertyMessage(lang: Lang, o: { name: string; property: Property; link?: string | null }): string {
  const T = (k: string) => translate(lang, k)
  const p = o.property
  const det = [p.beds ? fmt(T('sp.det'), { beds: p.beds, baths: p.baths, size: p.size_m2 }) : p.size_m2 ? `${p.size_m2} m²` : ''].filter(Boolean).join('')
  const body = [
    fmt(T('sp.hello'), { name: o.name.split(' ')[0] }), '',
    `${p.title}${p.area ? ` - ${p.area}` : ''}`,
    det,
    `${T('sp.price')}: ${qar(p.price)}${p.listing === 'rent' ? ` ${T('sp.permonth')}` : ''}`,
    `${T('sp.ref')}: ${propRef(p.id)}`,
    o.link ? `${T('sp.details')}: ${o.link}` : '',
  ].filter((x, i) => i === 1 || x) // garde la ligne vide apres la salutation, retire les lignes absentes
  return [...body, '', T('pol.stop.footer')].join('\n')
}
