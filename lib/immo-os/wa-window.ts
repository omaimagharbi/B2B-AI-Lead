// Parties de la logique WhatsApp Business utilisables aussi dans le navigateur (aucune dependance Node).
export const WINDOW_MS = 24 * 3600000

// Fenetre de service client : 24 h apres le DERNIER message du client, on peut repondre librement ; ensuite, modele approuve obligatoire.
export function windowState(lastInbound: string | null | undefined, now = Date.now()): { open: boolean; msLeft: number } {
  const t = lastInbound ? new Date(lastInbound).getTime() : NaN
  if (!Number.isFinite(t)) return { open: false, msLeft: 0 }
  const left = t + WINDOW_MS - now
  return { open: left > 0, msLeft: Math.max(0, left) }
}

export const templateVars = (body: string | null | undefined): number => { const n = Array.from(String(body ?? '').matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1])); return n.length ? Math.max(...n) : 0 }
export const renderTemplate = (body: string | null | undefined, params: string[]): string => String(body ?? '').replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? '')

