import { tirerEntier } from "./rng";

export type CategorieDefi =
  /** La case violette : le pion qui tombe dessus choisit qui il défie. */
  | "duel"
  /** Fin de manche : tout le monde joue, le gagnant prend une étoile. */
  | "collectif"
  /** Deux pions sur la même case : un geste idiot, le perdant boit. */
  | "instantane";

/** Où un défi est jouable. Un défi qui demande un écran par joueur n'a aucun
 *  sens sur un téléphone unique qu'on se passe. */
export type ModeJeu = "local" | "multi";

export interface Defi {
  id: string;
  categorie: CategorieDefi;
  /** Titre court, affiché en gros. */
  titre: string;
  /** La règle, en une phrase lisible à voix haute. */
  consigne: string;
  modes: ModeJeu[];
}

/**
 * Le catalogue.
 *
 * Les instantanés sont écrits : ce sont des jeux de réflexe, ils tiennent en
 * une phrase et marchent partout. Les duels et les collectifs attendent leur
 * contenu — les entrées ci-dessous sont des coquilles pour que la boucle de jeu
 * tourne, à remplacer telles quelles.
 */
export const DEFIS: Defi[] = [
  // --- Instantanés : le dernier à obéir a perdu. ---
  {
    id: "i-front",
    categorie: "instantane",
    titre: "Touche ton front",
    consigne: "Le dernier à toucher son front a perdu.",
    modes: ["local", "multi"],
  },
  {
    id: "i-verre",
    categorie: "instantane",
    titre: "Touche ton verre",
    consigne: "Le dernier à poser un doigt sur son verre a perdu.",
    modes: ["local", "multi"],
  },
  {
    id: "i-sol",
    categorie: "instantane",
    titre: "Touche le sol",
    consigne: "Le dernier à toucher le sol a perdu.",
    modes: ["local", "multi"],
  },
  {
    id: "i-nez",
    categorie: "instantane",
    titre: "Doigt sur le nez",
    consigne: "Le dernier à mettre un doigt sur son nez a perdu.",
    modes: ["local", "multi"],
  },
  {
    id: "i-debout",
    categorie: "instantane",
    titre: "Debout !",
    consigne: "Le dernier debout sur ses deux pieds a perdu.",
    modes: ["local", "multi"],
  },
  {
    id: "i-silence",
    categorie: "instantane",
    titre: "Chut",
    consigne: "Le premier qui parle ou qui rit a perdu.",
    modes: ["local", "multi"],
  },

  // --- Duels : à remplir. ---
  {
    id: "d-a-venir-1",
    categorie: "duel",
    titre: "Duel",
    consigne: "Contenu à venir. Faites-vous un duel et désignez le vainqueur.",
    modes: ["local", "multi"],
  },
  {
    id: "d-a-venir-2",
    categorie: "duel",
    titre: "Duel",
    consigne: "Contenu à venir. Faites-vous un duel et désignez le vainqueur.",
    modes: ["local", "multi"],
  },

  // --- Collectifs : à remplir. ---
  {
    id: "c-a-venir-1",
    categorie: "collectif",
    titre: "Défi de fin de manche",
    consigne: "Contenu à venir. Jouez tous, puis désignez le vainqueur.",
    modes: ["local", "multi"],
  },
  {
    id: "c-a-venir-2",
    categorie: "collectif",
    titre: "Défi de fin de manche",
    consigne: "Contenu à venir. Jouez tous, puis désignez le vainqueur.",
    modes: ["local", "multi"],
  },
];

const PAR_ID = new Map(DEFIS.map((d) => [d.id, d]));

export function defiParId(id: string): Defi | null {
  return PAR_ID.get(id) ?? null;
}

/**
 * Tire un défi d'une catégorie. Pur et déterministe : l'état ne garde que l'id,
 * ce qui suffit à ce que tous les téléphones affichent le même défi.
 */
export function tirerDefi(
  categorie: CategorieDefi,
  mode: ModeJeu,
  rng: number,
): [id: string | null, rng: number] {
  const candidats = DEFIS.filter((d) => d.categorie === categorie && d.modes.includes(mode));
  if (candidats.length === 0) return [null, rng];
  const [i, suivant] = tirerEntier(rng, 0, candidats.length - 1);
  return [candidats[i].id, suivant];
}
