// Bibliotheque de templates de message prets a l'emploi, par vertical.
// Purement statique (pas d'IA) : sert juste a reduire la page blanche au
// premier lancement. Le cabinet peut toujours les modifier ensuite.
export const TEMPLATES_PAR_VERTICAL: Record<string, { titre: string; texte: string }[]> = {
  'cabinet-formation': [
    {
      titre: 'Direct - invitation diagnostic',
      texte:
        'Bonjour {nom},\n\n{cabinet} accompagne les entreprises et particuliers dans leur montée en compétences. Décrivez votre besoin en 30 secondes, un expert étudiera votre dossier :\n{lien}',
    },
    {
      titre: 'Orienté résultats',
      texte:
        "Bonjour {nom},\n\n{cabinet} aide les équipes RH à réduire le turnover grâce à des formations sur-mesure. Curieux de voir ce qu'on pourrait faire pour vous ?\n{lien}",
    },
    {
      titre: 'Ton chaleureux / particulier',
      texte:
        "Bonjour {nom},\n\nEn reconversion ou en recherche de nouvelles compétences ? {cabinet} propose un accompagnement personnalisé. Racontez-nous où vous en êtes :\n{lien}",
    },
  ],
  'startup-saas': [
    {
      titre: 'Direct - invitation diagnostic',
      texte:
        "Bonjour {nom},\n\n{cabinet} aide les équipes tech à accélérer leur delivery. Décrivez votre principal blocage technique, un expert regarde votre cas :\n{lien}",
    },
    {
      titre: 'Orienté ROI',
      texte:
        'Bonjour {nom},\n\n{cabinet} a aidé plusieurs équipes à réduire leur dette technique de façon mesurable. Intéressé par un diagnostic rapide ?\n{lien}',
    },
  ],
  'pme-services': [
    {
      titre: 'Direct - invitation diagnostic',
      texte:
        "Bonjour {nom},\n\n{cabinet} accompagne les dirigeants de PME dans leurs décisions clés. Décrivez votre situation, un expert l'étudie personnellement :\n{lien}",
    },
    {
      titre: 'Orienté croissance',
      texte:
        "Bonjour {nom},\n\n{cabinet} aide les PME à structurer leur croissance sans perdre en agilité. Curieux de voir où sont vos marges de progrès ?\n{lien}",
    },
  ],
}

export function templatesPourVertical(verticalSlug: string) {
  return TEMPLATES_PAR_VERTICAL[verticalSlug] ?? TEMPLATES_PAR_VERTICAL['cabinet-formation']
}
