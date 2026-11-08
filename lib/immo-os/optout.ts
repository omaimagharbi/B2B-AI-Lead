import { MOTS_STOP_BASE } from '../optout-words'

// Detection pure (aucune dependance base) des demandes STOP / reprise envoyees par WhatsApp.
// Reutilise la liste de mots de la partie B2B (lib/optout-words.ts) et ajoute les formes FR / EN / AR utiles a l'immobilier.
// Volontairement prudent : un message long qui contient "stop" (ex. "the bus stop is near the villa") n'est PAS un opt-out.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents latins
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '') // voyelles breves et tatweel arabes
    .replace(/[إأآ]/g, 'ا')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Mots seuls (message court) : STOP, ARRET, UNSUBSCRIBE, ...
const STOP_TOKENS = new Set(
  [...MOTS_STOP_BASE.filter((m) => !m.includes(' ')).map(norm), 'arret', 'arreter', 'arretez', 'unsubscribe', 'optout', 'cancel', 'quit', 'desinscription', 'desinscrire', 'توقف', 'ايقاف', 'وقف', 'الغاء', 'كفى'],
)
// Expressions (acceptees meme dans un message un peu plus long)
const STOP_PHRASES = [
  'do not contact', 'dont contact', 'don t contact', 'stop messaging', 'stop messages', 'stop texting', 'stop contacting', 'remove me', 'opt out', 'leave me alone',
  'ne plus me contacter', 'ne me contactez plus', 'ne plus m ecrire', 'ne plus recevoir', 'arretez de me', 'supprimez mon numero', 'retirez moi',
  'لا تتواصل معي', 'لا تتواصلوا معي', 'لا ترسل لي', 'لا ترسلوا لي', 'ايقاف الرسائل', 'الغاء الاشتراك', 'احذف رقمي', 'احذفوا رقمي', 'توقفوا عن',
].map(norm)

const START_TOKENS = new Set(['start', 'unstop', 'subscribe', 'resume', 'reprendre', 'reactiver', 'ابدا', 'اشتراك', 'استئناف'].map(norm))

const wordsOf = (t: string) => (t ? t.split(' ') : [])

export function detectOptOut(text: string | null | undefined): boolean {
  const t = norm(String(text ?? ''))
  if (!t) return false
  const w = wordsOf(t)
  if (w.length <= 6 && w.some((x) => STOP_TOKENS.has(x))) return true // "STOP", "stop please", "arret svp"
  return STOP_PHRASES.some((p) => t.includes(p))
}

// Reprise : uniquement un message tres court (START, "reprendre"...), pour ne pas rouvrir le contact par accident.
export function detectOptIn(text: string | null | undefined): boolean {
  const w = wordsOf(norm(String(text ?? '')))
  return w.length > 0 && w.length <= 2 && w.some((x) => START_TOKENS.has(x))
}

export type PolicyLang = 'en' | 'fr' | 'ar'
// Langue de la reponse automatique : alphabet arabe -> ar, mots francais courants -> fr, sinon en.
export function pickLang(text: string | null | undefined, fallback: PolicyLang = 'en'): PolicyLang {
  const s = String(text ?? '')
  if (/[\u0600-\u06FF]/.test(s)) return 'ar'
  if (/\b(arret|arretez|desinscri\w*|ne plus|merci|svp|bonjour|reprendre|contacter|contactez)\b/.test(norm(s))) return 'fr'
  return fallback
}
