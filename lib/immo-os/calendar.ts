// Calculs de calendrier purs (heure locale du navigateur). Semaine commencant le dimanche (usage au Qatar).
export const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// 42 jours (6 semaines) couvrant le mois, jours des mois voisins inclus.
export function monthGrid(year: number, month: number, weekStart = 0): Date[] {
  const offset = (new Date(year, month, 1).getDay() - weekStart + 7) % 7
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i))
}
export function weekDays(ref: Date, weekStart = 0): Date[] {
  const offset = (ref.getDay() - weekStart + 7) % 7
  return Array.from({ length: 7 }, (_, i) => new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - offset + i))
}
export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}
// Week-end au Qatar : vendredi (5) et samedi (6)
export const isWeekend = (d: Date) => d.getDay() === 5 || d.getDay() === 6

export function groupByDay<T extends { starts_at: string }>(items: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const it of [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) (out[dayKey(new Date(it.starts_at))] ??= []).push(it)
  return out
}
