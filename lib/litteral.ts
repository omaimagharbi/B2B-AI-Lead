// Traduction des textes ecrits en francais "en dur" dans les pages (anciennes zones de l'interface
// qui n'utilisaient pas encore traduire()). Cle = texte francais exact ; si aucune traduction n'existe
// pour la langue courante, le texte francais d'origine est conserve (jamais de cle brute affichee).
import type { Langue } from './i18n'
import { LITTERAL_EN } from './litteral-en'
import { LITTERAL_AR } from './litteral-ar'

let langueCourante: Langue = 'en'

// A appeler dans le corps du composant de page (avant le rendu des enfants)
export function definirLangueLitterale(l: Langue) {
  langueCourante = l
}

export function tt(fr: string): string {
  if (langueCourante === 'fr') return fr
  const dico = langueCourante === 'ar' ? LITTERAL_AR : LITTERAL_EN
  return dico[fr] ?? (langueCourante === 'ar' ? LITTERAL_EN[fr] : undefined) ?? fr
}

// Variante avec valeurs : tf('Supprimer "{0}" ?', [nom])
export function tf(fr: string, vars: Array<string | number | null | undefined>): string {
  return tt(fr).replace(/\{(\d+)\}/g, (_m, i) => String(vars[Number(i)] ?? ''))
}
