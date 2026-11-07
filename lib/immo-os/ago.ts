// Temps relatif traduit (EN / FR / AR) a partir du dictionnaire : agoLocal(iso, t, tf)
export function agoLocal(iso: string | null | undefined, t: (k: string) => string, tf: (k: string, v: Record<string, string | number>) => string, never = 'o.never'): string {
  if (!iso) return t(never)
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return t('ago.now')
  if (s < 3600) return tf('ago.min', { n: Math.floor(s / 60) })
  if (s < 86400) return tf('ago.h', { n: Math.floor(s / 3600) })
  if (s < 172800) return t('ago.y')
  return tf('ago.d', { n: Math.floor(s / 86400) })
}
