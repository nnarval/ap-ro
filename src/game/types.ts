/** Types de cases. Les effets concrets viendront plus tard. */
export type TypeCase =
  | "depart"
  | "bonus"
  | "grosBonus"
  | "malus"
  | "defi"
  | "evenement"
  | "boutique"
  | "etoile"
  | "neutre";

export interface Case {
  id: string;
  type: TypeCase;
  /** Position sur le plateau, en unités abstraites (voir `Plateau.limites`). */
  x: number;
  y: number;
  /** Cases accessibles depuis celle-ci. Plus d'une = croisement, le joueur choisit. */
  suivantes: string[];
}

export interface Plateau {
  graine: number;
  cases: Record<string, Case>;
  /** Case de départ. */
  depart: string;
  /** Cases où l'étoile peut apparaître (toutes de type "etoile"). */
  emplacementsEtoile: string[];
  /** Boîte englobante, pour cadrer la caméra. */
  limites: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface Pion {
  id: string;
  nom: string;
  couleur: string;
  /** Les joueurs derrière ce pion. Un seul nom = joueur solo, plusieurs = équipe. */
  membres: string[];
  caseId: string;
  pieces: number;
  etoiles: number;
}

/**
 * Phase courante du tour. Le réducteur n'accepte que les actions correspondant
 * à la phase, ce qui évite qu'un client désynchronisé injecte n'importe quoi.
 */
export type Phase =
  | "lancer"
  | "deplacement"
  | "croisement"
  | "resolution"
  | "achatEtoile"
  | "finTour"
  | "terminee";

export interface EntreeJournal {
  manche: number;
  pionId: string;
  texte: string;
}

export interface EtatPartie {
  plateau: Plateau;
  pions: Pion[];
  /** Ordre de passage, par id de pion. */
  ordreTour: string[];
  indexTour: number;
  manche: number;
  phase: Phase;

  /** Dernier jet de dé, pour l'affichage. */
  de: number | null;
  /** Cases qu'il reste à parcourir pour le pion actif. */
  pasRestants: number;
  /** En phase "croisement", les cases entre lesquelles choisir. */
  choix: string[];

  /** Case où se trouve l'étoile actuellement. */
  etoileSur: string | null;
  prixEtoile: number;
  etoilesRestantes: number;

  /** État du RNG. Fait partie de l'état : la partie est rejouable à l'identique. */
  rng: number;
  journal: EntreeJournal[];
}

export type Action =
  | { type: "LANCER_DE" }
  | { type: "AVANCER" }
  | { type: "CHOISIR_CHEMIN"; caseId: string }
  | { type: "RESOUDRE_CASE" }
  | { type: "ACHETER_ETOILE"; acheter: boolean }
  | { type: "FIN_TOUR" };
