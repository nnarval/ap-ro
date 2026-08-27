import type { Ambiance, CartePerso, CategorieDefi } from "../game/defis";
import type { Action, EtatPartie } from "../game/types";

/**
 * Le contrat entre les téléphones et le serveur de partie.
 *
 * Imports relatifs volontaires : ce fichier est compilé aussi bien par Next que
 * par le Worker Cloudflare, qui n'a pas l'alias `@/`.
 */

/** Alphabet des codes de partie : ni O/0 ni I/1/L, qu'on confond en les dictant
 *  à voix haute dans une pièce bruyante. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LONGUEUR_CODE = 4;

export function genererCode(): string {
  let code = "";
  for (let i = 0; i < LONGUEUR_CODE; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function codeValide(code: string): boolean {
  return code.length === LONGUEUR_CODE && [...code].every((c) => ALPHABET.includes(c));
}

export interface JoueurSalon {
  /** L'identifiant de connexion. Change si le joueur recharge la page. */
  id: string;
  nom: string;
  /** Index de l'équipe, donc du pion. */
  equipe: number;
  connecte: boolean;
}

export interface Salon {
  code: string;
  /** Le premier arrivé mène : c'est lui qui lance la partie. */
  hoteId: string | null;
  joueurs: JoueurSalon[];
  nbEquipes: number;
  /** Noms d'équipe, indexés par équipe. Chaque équipe modifie le sien. */
  nomsEquipes: string[];
  /** Objectif d'étoiles choisi par l'hôte. */
  objectif: number;
  /** Ambiance choisie par l'hôte. */
  ambiance: Ambiance;
  /** Cartes écrites par les équipes, avant le lancement. */
  cartesPerso: CartePerso[];
}

export type MessageClient =
  | { type: "rejoindre"; nom: string }
  | { type: "changerEquipe"; joueurId: string; equipe: number }
  | { type: "reglerEquipes"; nbEquipes: number }
  | { type: "renommerEquipe"; equipe: number; nom: string }
  | { type: "reglerObjectif"; objectif: number }
  | { type: "reglerAmbiance"; ambiance: Ambiance }
  | { type: "ajouterCartePerso"; categorie: CategorieDefi; texte: string }
  | { type: "supprimerCartePerso"; id: string }
  | { type: "demarrer" }
  | { type: "action"; action: Action }
  | { type: "rejouer" };

export type MessageServeur =
  | {
      type: "etat";
      salon: Salon;
      partie: EtatPartie | null;
      /** Qui es-tu, dans ce salon. */
      toiId: string;
    }
  | { type: "erreur"; message: string };
