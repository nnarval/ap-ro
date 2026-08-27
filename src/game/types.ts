import type { Ambiance, CartePerso, ModeJeu } from "./defis";

export type { Ambiance, CartePerso, ModeJeu };

/**
 * Les types de cases, plus le départ, qui est structurel.
 *
 * Il n'y a plus de case « étoile » dédiée : l'étoile se greffe sur n'importe
 * quelle case et se déplace quand on la ramasse (voir `EtatPartie.etoilesSur`).
 */
export type TypeCase =
  | "depart"
  | "defi"
  | "bonus"
  | "malus"
  | "evenement"
  | "boutique"
  /** La roulette à shot : une roue des couleurs désigne qui boit. */
  | "roulette";

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
  /** Boîte englobante, pour cadrer la caméra. */
  limites: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface Pion {
  id: string;
  /** Le nom de l'équipe. Modifiable au lobby par l'équipe elle-même. */
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
  /** Deux équipes sur la même case : jeu de réflexe, le dernier boit. */
  | "reflexe"
  | "resolution"
  /** Case bonus : on annonce le gain sur une carte avant de continuer. */
  | "bonus"
  | "choixMalus"
  | "boutique"
  | "choixAdversaire"
  | "defiDuel"
  /** Case événement : un effet surprise vient d'être tiré, on l'annonce. */
  | "evenement"
  /** Case roulette : la roue a désigné une équipe qui boit un shot. */
  | "roulette"
  | "finTour"
  /** Fin de manche : la roue à deux côtés (équipe / carte) n'a pas encore été lancée. */
  | "roueManche"
  /** Fin de manche : le défi est connu, on joue puis on désigne la gagnante. */
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

  /** Détermine quels défis sont jouables. */
  mode: ModeJeu;
  /** Pondère le tirage des cartes. */
  ambiance: Ambiance;
  /** Les cartes écrites par les équipes au lobby, mises en avant au tirage. */
  cartesPerso: CartePerso[];

  de: number | null;
  pasRestants: number;
  /** En phase "croisement", les cases entre lesquelles choisir. */
  choix: string[];
  /** En phase "defiDuel", l'équipe défiée par l'équipe active. */
  adversaireId: string | null;
  /** Défi en cours. On ne garde que l'id : le catalogue étant dans le code (et
   *  les cartes perso dans l'état), ça suffit à ce que tous affichent le même. */
  defiId: string | null;

  /** Cases portant une étoile en ce moment (n'importe quelle case, hors départ). */
  etoilesSur: string[];
  /** Étoiles qu'il reste à distribuer d'ici la fin de la partie. */
  etoilesRestantes: number;
  /** Objectif de la partie : nombre total d'étoiles à distribuer. */
  objectifEtoiles: number;
  /** Dernier saut d'étoile, pour l'animer côté écran. Remis à zéro au tour suivant. */
  dernierSautEtoile: { de: string; vers: string } | null;

  /** En phase "bonus", le nombre de pièces gagnées, pour l'afficher. */
  gainBonus: number | null;
  /** En phase "roulette", l'équipe désignée par la roue pour boire le shot. */
  equipeShot: string | null;
  /** En phase "evenement", le texte de l'effet tiré. */
  evenementTexte: string | null;
  /** En fin de manche : d'où vient le défi une fois la roue lancée. */
  sourceDefi: "claude" | "equipe" | null;
  /** Si la roue tombe côté « équipe », l'équipe désignée pour créer le défi. */
  equipeCreatriceId: string | null;

  /** État du RNG. Fait partie de l'état : la partie est rejouable à l'identique. */
  rng: number;
  journal: EntreeJournal[];
}

export type Action =
  | { type: "LANCER_DE" }
  /**
   * `pasRestants` est le compteur dont l'émetteur croit partir. En multi, tous
   * les téléphones enchaînent le déplacement par minuterie : sans cette garde,
   * six « avance d'une case » simultanés feraient sauter six cases.
   */
  | { type: "AVANCER"; pasRestants: number }
  | { type: "CHOISIR_CHEMIN"; caseId: string }
  | { type: "RESOUDRE_CASE" }
  | { type: "RESOUDRE_REFLEXE"; vainqueurId: string }
  | { type: "CHOISIR_MALUS"; gage: boolean }
  | { type: "ACHETER_ETOILE" }
  | { type: "ACHETER_GORGEES"; nombre: number }
  | { type: "QUITTER_BOUTIQUE" }
  | { type: "CHOISIR_ADVERSAIRE"; pionId: string }
  | { type: "RESOUDRE_DEFI"; vainqueurId: string }
  | { type: "DONNER_GORGEE"; donneurId: string; receveurId: string }
  /** Ferme l'annonce d'un événement ou d'une roulette, et passe à la fin du tour. */
  | { type: "CONTINUER" }
  | { type: "FIN_TOUR" }
  /** Fin de manche : lance la roue à deux côtés (équipe / carte). */
  | { type: "LANCER_ROUE_MANCHE" }
  | { type: "RESOUDRE_DEFI_COLLECTIF"; vainqueurId: string };
