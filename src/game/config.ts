import type { Ambiance, TypeCase } from "./types";

/**
 * Réglages d'équilibrage.
 *
 * Cible : une partie d'environ 20 minutes. Le nombre de manches suit l'objectif
 * d'étoiles choisi au lobby (une étoile est garantie à chaque fin de manche, le
 * plateau en ajoute quelques-unes en cours de route).
 */
export const REGLAGES = {
  /** Objectifs proposés au lobby. Le premier est la valeur par défaut. */
  objectifsEtoile: [6, 8, 10, 12, 15, 18] as const,
  objectifParDefaut: 10,

  /** Étoiles présentes en même temps sur le plateau. Une étoile ramassée
   *  réapparaît aussitôt ailleurs pour maintenir ce nombre. */
  etoilesSurPlateau: 2,

  /** L'étoile posée sur le plateau se trouve : elle est gratuite. Celle de la
   *  boutique s'achète. Ce sont deux sources, la fin de manche est la troisième. */
  prixEtoileBoutique: 10,

  /** 1 pièce = 1 gorgée à distribuer pendant la partie. */
  prixGorgee: 1,

  pionsMin: 2,
  pionsMax: 6,

  deMin: 1,
  deMax: 6,

  piecesDepart: 5,

  /** La case bonus rapporte un montant variable : ça évite d'avoir à créer un
   *  type « gros bonus », qui coûterait une couleur pour une simple magnitude. */
  gainBonusMin: 2,
  gainBonusMax: 6,

  /** Refuser un malus se paie. Le joueur peut toujours préférer boire le gage. */
  perteMalus: 2,

  /** Gain du vainqueur d'un duel (case défi). */
  gainDefiDuel: 5,

  /** Gorgées bues par le perdant du réflexe, quand deux équipes se retrouvent
   *  sur la même case. Ce n'est pas de l'état de jeu : on l'affiche, les joueurs
   *  boivent. */
  gorgeesPerdantReflexe: 5,

  gainTourComplet: 4,

  /** Nombre maximum de cartes personnalisées par équipe. */
  cartesPersoParEquipe: 24,
} as const;

export type ObjectifEtoile = (typeof REGLAGES.objectifsEtoile)[number];

/**
 * Effectifs de base des cases, hors départ. Ces nombres sont FIXES d'une partie
 * à l'autre : seule la forme du plateau change, jamais la composition. Un total
 * volontairement rond (31 cases + le départ = 32).
 *
 * L'ambiance applique ensuite de petits transferts (voir `DELTAS_AMBIANCE`),
 * toujours à somme nulle, pour garder le même total.
 */
export const EFFECTIFS_BASE: Record<Exclude<TypeCase, "depart">, number> = {
  defi: 6,
  bonus: 8,
  malus: 7,
  evenement: 4,
  boutique: 3,
  roulette: 3,
};

/**
 * Ajustements par ambiance, à somme nulle : ce qu'on ajoute quelque part, on le
 * retire du bonus (la case la plus « neutre »). « Chaos » muscle malus et
 * roulette ; « Équipes » ajoute des cases d'interaction (défi) ; « Sale »
 * charge les malus.
 */
export const DELTAS_AMBIANCE: Record<Ambiance, Partial<Record<Exclude<TypeCase, "depart">, number>>> = {
  classique: {},
  dejaChaud: { malus: +1, bonus: -1 },
  sale: { malus: +2, bonus: -2 },
  chaos: { malus: +2, roulette: +2, bonus: -4 },
  equipes: { defi: +2, roulette: +1, bonus: -3 },
};

/** La composition finale du plateau, pour une ambiance donnée. */
export function effectifsPour(ambiance: Ambiance): Record<Exclude<TypeCase, "depart">, number> {
  const resultat = { ...EFFECTIFS_BASE };
  for (const [type, delta] of Object.entries(DELTAS_AMBIANCE[ambiance])) {
    resultat[type as Exclude<TypeCase, "depart">] += delta as number;
  }
  return resultat;
}
