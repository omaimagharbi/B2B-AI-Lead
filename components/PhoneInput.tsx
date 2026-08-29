'use client'

// Meme liste de pays que lib/pays.ts (PAYS_DISPONIBLES), avec indicatif +
// emoji drapeau, pour que le selecteur telephone couvre tous les pays deja
// geres ailleurs dans l'app (ciblage, zones, devise...) et pas seulement le
// Maghreb/Golfe/France du depart.
export const INDICATIFS_PAYS: { code: string; label: string }[] = [
  { code: '+213', label: '🇩🇿 +213' }, // Algérie
  { code: '+49', label: '🇩🇪 +49' }, // Allemagne
  { code: '+966', label: '🇸🇦 +966' }, // Arabie Saoudite
  { code: '+32', label: '🇧🇪 +32' }, // Belgique
  { code: '+1', label: '🇨🇦 +1' }, // Canada
  { code: '+225', label: '🇨🇮 +225' }, // Côte d'Ivoire
  { code: '+971', label: '🇦🇪 +971' }, // Émirats Arabes Unis
  { code: '+34', label: '🇪🇸 +34' }, // Espagne
  { code: '+1', label: '🇺🇸 +1 (US)' }, // États-Unis
  { code: '+33', label: '🇫🇷 +33' }, // France
  { code: '+39', label: '🇮🇹 +39' }, // Italie
  { code: '+352', label: '🇱🇺 +352' }, // Luxembourg
  { code: '+212', label: '🇲🇦 +212' }, // Maroc
  { code: '+31', label: '🇳🇱 +31' }, // Pays-Bas
  { code: '+974', label: '🇶🇦 +974' }, // Qatar
  { code: '+44', label: '🇬🇧 +44' }, // Royaume-Uni
  { code: '+221', label: '🇸🇳 +221' }, // Sénégal
  { code: '+41', label: '🇨🇭 +41' }, // Suisse
  { code: '+216', label: '🇹🇳 +216' }, // Tunisie
  { code: '', label: 'Autre' },
]

/**
 * Champ téléphone avec sélecteur drapeau + indicatif, même pattern que la page d'inscription.
 * `indicatif` et `numero` sont gérés séparément par l'appelant (comme sur /auth) pour rester
 * cohérent avec le format de stockage `${indicatif}${numero}`.
 */
export default function PhoneInput({
  indicatif,
  onIndicatifChange,
  numero,
  onNumeroChange,
  onNumeroBlur,
  placeholder = 'Téléphone / WhatsApp',
  className = '',
}: {
  indicatif: string
  onIndicatifChange: (v: string) => void
  numero: string
  onNumeroChange: (v: string) => void
  onNumeroBlur?: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={indicatif}
        onChange={(e) => onIndicatifChange(e.target.value)}
        className="rounded-lg bg-slate-950 border border-slate-700 p-3 text-sm"
      >
        {INDICATIFS_PAYS.map((p) => (
          <option key={p.label || 'autre'} value={p.code}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        value={numero}
        onChange={(e) => onNumeroChange(e.target.value)}
        onBlur={(e) => onNumeroBlur?.(e.target.value)}
        placeholder={placeholder}
        type="tel"
        className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
      />
    </div>
  )
}

/** Sépare un numéro stocké "+216xxxxxxxx" en { indicatif, numero } pour pré-remplir le champ. */
export function decouperTelephone(valeur: string | null | undefined): { indicatif: string; numero: string } {
  const v = (valeur ?? '').trim()
  const trouve = INDICATIFS_PAYS.find((p) => p.code && v.startsWith(p.code))
  if (trouve) return { indicatif: trouve.code, numero: v.slice(trouve.code.length) }
  return { indicatif: v.startsWith('+') ? '' : '+216', numero: v }
}
