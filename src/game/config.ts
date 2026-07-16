/**
 * Tous les réglages d'équilibrage de la partie.
 *
 * Cible : une partie de ~20 minutes, 4 à 6 pions, 10 étoiles distribuées.
 * Ça fait une étoile toutes les 2 minutes environ — beaucoup plus rapide que
 * Mario Party (5 étoiles en 2h). D'où le plateau court, le dé généreux et
 * l'étoile bon marché. Ces nombres sont des hypothèses à corriger après les
 * premières vraies parties.
 */
export const REGLAGES = {
  /** Nombre d'étoiles à distribuer avant la fin de la partie. */
  etoilesParPartie: 10,

  /** Prix de l'étoile, en pièces. */
  prixEtoile: 7,
  /** Le prix monte de ce montant à chaque étoile achetée (0 = prix fixe). */
  inflationEtoile: 0,

  /** Nombre de pions sur le plateau. Un pion = un joueur, ou une équipe. */
  pionsMin: 2,
  pionsMax: 6,

  /** Faces du dé. */
  deMin: 1,
  deMax: 6,

  /** Taille du circuit principal, en cases. */
  casesMin: 26,
  casesMax: 34,

  /** Raccourcis qui traversent le plateau et créent des croisements. */
  raccourcisMin: 1,
  raccourcisMax: 2,

  /** Emplacements où l'étoile peut apparaître. Elle se déplace après chaque achat. */
  emplacementsEtoileMin: 5,
  emplacementsEtoileMax: 7,

  /** Pièces distribuées au départ. */
  piecesDepart: 5,

  /** Effets des cases, en pièces. */
  gainBonus: 3,
  gainGrosBonus: 6,
  perteMalus: 3,

  /** Pièces gagnées en passant sur la case de départ. */
  gainTourComplet: 4,
} as const;

/** Répartition des types de cases sur le circuit, en poids relatifs. */
export const POIDS_CASES = {
  bonus: 26,
  defi: 24,
  malus: 18,
  evenement: 14,
  neutre: 10,
  boutique: 8,
} as const;
