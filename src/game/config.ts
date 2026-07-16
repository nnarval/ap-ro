/**
 * Réglages d'équilibrage.
 *
 * Cible : ~20 minutes, soit environ 6 manches, 4 à 6 pions, 10 étoiles.
 * Les mesures (voir equilibrage.test.ts) ont montré qu'un plateau seul ne peut
 * pas distribuer 10 étoiles : un pion s'arrête sur une case parmi trente, ça
 * plafonne à ~1,4 occasion par partie. Les étoiles viennent donc surtout des
 * défis de fin de manche, le plateau n'en fournissant qu'un filet.
 */
export const REGLAGES = {
  /** Étoiles à distribuer avant la fin de la partie. */
  etoilesParPartie: 10,

  /** Étoiles présentes en même temps sur le plateau. Une étoile ramassée
   *  réapparaît aussitôt ailleurs pour maintenir ce nombre. */
  etoilesSurPlateau: 2,

  /** L'étoile posée sur le plateau se trouve : elle est gratuite. Celle de la
   *  boutique s'achète. Ce sont les deux sources voulues. */
  prixEtoileBoutique: 10,

  /** 1 pièce = 1 gorgée à distribuer pendant la partie. */
  prixGorgee: 1,

  pionsMin: 2,
  pionsMax: 6,

  deMin: 1,
  deMax: 6,

  casesMin: 26,
  casesMax: 34,
  raccourcisMin: 1,
  raccourcisMax: 2,

  piecesDepart: 5,

  /** La case bonus rapporte un montant variable : ça évite d'avoir à créer un
   *  type « gros bonus », qui coûterait une couleur pour une simple magnitude. */
  gainBonusMin: 2,
  gainBonusMax: 6,

  /** Le malus doit faire réagir sans plomber la partie. Le joueur peut toujours
   *  préférer le gage. */
  perteMalus: 2,

  /** Provisoire, en attendant le contenu des défis. */
  gainDefiDuel: 5,

  gainTourComplet: 4,
} as const;

/**
 * Effectifs par type de case.
 *
 * Les types à effectif fixe sont servis d'abord ; défi, bonus et malus se
 * partagent tout le reste. Ils sont donc majoritaires par construction, quelle
 * que soit la taille du plateau — pas par chance de tirage.
 */
export const EFFECTIFS_FIXES = {
  emplacementsEtoile: { min: 4, max: 6 },
  evenement: { min: 3, max: 4 },
  boutique: { min: 3, max: 4 },
} as const;

/** Parts du reste entre les trois types majoritaires. */
export const PARTS_MAJORITAIRES = {
  defi: 7,
  bonus: 6,
  malus: 5,
} as const;
