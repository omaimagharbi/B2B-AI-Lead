// n°102 : que faire d'un message WhatsApp venant d'un numero inconnu ? Regle choisie par l'agence (re_settings.unknown_number_rule).
export type UnknownRule = 'create_lead' | 'if_property' | 'inbox_only' | 'ignore'
export const UNKNOWN_RULES: UnknownRule[] = ['create_lead', 'if_property', 'inbox_only', 'ignore']
export const DEFAULT_UNKNOWN_RULE: UnknownRule = 'create_lead' // comportement historique : on ne change rien tant que l'agence n'a pas choisi
export const isUnknownRule = (v: unknown): v is UnknownRule => typeof v === 'string' && (UNKNOWN_RULES as string[]).includes(v)

export type UnknownAction = 'create_lead' | 'inbox_only' | 'ignore'

// Intention immobiliere claire (EN / FR / AR) : acheter, louer, visiter, prix, disponibilite, type de bien.
const INTENT = /(\b(buy|rent|rental|lease|viewing|view|visit|price|available|availability|interested|villa|apartment|flat|studio|office|shop|land|townhouse|penthouse|property|bedroom|bed)\b|\b(acheter|louer|location|visite|visiter|prix|disponible|interesse|appartement|bien|chambres?)\b|شقة|فيلا|ايجار|إيجار|شراء|للبيع|للايجار|للإيجار|معاينة|سعر|متاح|مهتم|عقار|غرفة|غرف)/i

// En mode "if_property" : lead seulement si un bien est identifie dans le message OU si une intention immobiliere claire est exprimee.
export function decideUnknown(rule: UnknownRule, msg: { text: string; propertyDetected: boolean }): UnknownAction {
  switch (rule) {
    case 'ignore': return 'ignore'
    case 'inbox_only': return 'inbox_only'
    case 'if_property': return msg.propertyDetected || INTENT.test(msg.text) ? 'create_lead' : 'inbox_only'
    default: return 'create_lead'
  }
}
