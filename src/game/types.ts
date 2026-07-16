/** Les six types de cases, plus le départ, qui est structurel. */
export type TypeCase =
  | "depart"
  | "defi"
  | "bonus"
  | "malus"
  | "evenement"
  | "boutique"
  | "etoile";

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
  depart: string;
  /** Cases où une étoile peut apparaître (toutes de type "etoile"). */
  emplacementsEtoile: string[];
  /** Boîte englobante, pour cadrer la caméra. */
  limites: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface Pion {
  id: string;
  nom: string;
  couleur: string;
  /** Un seul nom = joueur solo, plusieurs = équipe. */
  membres: string[];
  caseId: string;
  pieces: number;
  etoiles: number;
  /** Gorgées achetées, à distribuer quand on veut pendant la partie. */
  gorgees: number;
}

/**
 * Phase courante. Le réducteur n'accepte que les actions correspondant à la
 * phase, ce qui évite qu'un client désynchronisé injecte n'importe quoi.
 */
export type Phase =
  | "lancer"
  | "deplacement"
  | "croisement"
  | "resolution"
  | "choixMalus"
  | "boutique"
  | "choixAdversaire"
  | "defiDuel"
  | "finTour"
  | "defiCollectif"
  | "terminee";

export interface EntreeJournal {
  manche: number;
  pionId: string;
  texte: string;
}

export interface EtatPartie {
  plateau: Plateau;
  pions: Pion[];
  ordreTour: string[];
  indexTour: number;
  manche: number;
  phase: Phase;

  de: number | null;
  pasRestants: number;
  /** En phase "croisement", les cases entre lesquelles choisir. */
  choix: string[];
  /** En phase "defiDuel", le pion défié par le pion actif. */
  adversaireId: string | null;

  /** Cases portant une étoile en ce moment. */
  etoilesSur: string[];
  /** Étoiles qu'il reste à distribuer d'ici la fin de la partie. */
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
  | { type: "CHOISIR_MALUS"; gage: boolean }
  | { type: "ACHETER_ETOILE" }
  | { type: "ACHETER_GORGEES"; nombre: number }
  | { type: "QUITTER_BOUTIQUE" }
  | { type: "CHOISIR_ADVERSAIRE"; pionId: string }
  | { type: "RESOUDRE_DEFI"; vainqueurId: string }
  | { type: "DONNER_GORGEE"; donneurId: string; receveurId: string }
  | { type: "FIN_TOUR" }
  | { type: "RESOUDRE_DEFI_COLLECTIF"; vainqueurId: string };
