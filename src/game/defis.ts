import { tirer } from "./rng";

export type CategorieDefi =
  /** Deux équipes sur la même case : jeu de réflexe, le dernier boit. */
  | "reflexe"
  /** La case violette : l'équipe qui tombe dessus choisit qui elle défie. */
  | "duel"
  /** Fin de manche : tout le monde joue, la gagnante prend une étoile. */
  | "collectif"
  /** La case rouge : un gage à boire, qu'on peut refuser contre des pièces. */
  | "malus";

/** Où un défi est jouable. Un défi qui demande un écran par joueur n'a aucun
 *  sens sur un téléphone unique qu'on se passe. */
export type ModeJeu = "local" | "multi";

/**
 * L'ambiance choisie au lobby. Elle pondère le tirage des cartes (et, côté
 * plateau, la proportion de cases musclées).
 */
export type Ambiance = "classique" | "dejaChaud" | "sale" | "chaos" | "equipes";

/**
 * L'intensité d'une carte. C'est le curseur que l'ambiance fait monter ou
 * descendre : « douce » pour lancer la soirée, « hard » quand elle est lancée.
 */
export type Intensite = "douce" | "medium" | "hard";

export interface Defi {
  id: string;
  categorie: CategorieDefi;
  /** Titre court, affiché en gros. */
  titre: string;
  /** La règle, en une phrase lisible à voix haute. Elle doit toujours désigner
   *  la gagnante dès la lecture — jamais « la pire est éliminée ». */
  consigne: string;
  intensite: Intensite;
  modes: ModeJeu[];
}

/**
 * Une carte écrite par une équipe au lobby. Pas d'intensité : les cartes des
 * joueurs passent devant celles du catalogue, on ne les filtre jamais.
 */
export interface CartePerso {
  id: string;
  categorie: CategorieDefi;
  texte: string;
  /** L'équipe qui l'a écrite, pour l'afficher (« carte des Rouges »). */
  equipe: number;
}

/**
 * Le catalogue.
 *
 * Tout tourne autour des gorgées (d'eau, évidemment). Chaque carte désigne la
 * gagnante sans ambiguïté : on lit, on joue, on sait qui a gagné. Le catalogue
 * penche volontairement vers le medium et le hard — l'ambiance adoucit ou
 * durcit à partir de là.
 */
export const DEFIS: Defi[] = [
  // --- Réflexes : deux équipes sur la même case, le dernier à obéir boit. ---
  { id: "r-front", categorie: "reflexe", titre: "Touche ton front", consigne: "Le dernier à toucher son front boit 3 gorgées.", intensite: "douce", modes: ["local", "multi"] },
  { id: "r-sol", categorie: "reflexe", titre: "Touche le sol", consigne: "Le dernier à poser une main au sol boit 3 gorgées.", intensite: "douce", modes: ["local", "multi"] },
  { id: "r-verre", categorie: "reflexe", titre: "Main sur le verre", consigne: "Le dernier à poser un doigt sur son verre boit 4 gorgées.", intensite: "medium", modes: ["local", "multi"] },
  { id: "r-chut", categorie: "reflexe", titre: "Chut", consigne: "Le premier qui parle ou qui rit boit 4 gorgées.", intensite: "medium", modes: ["local", "multi"] },
  { id: "r-debout", categorie: "reflexe", titre: "Debout !", consigne: "Le dernier debout sur ses deux pieds boit 5 gorgées.", intensite: "medium", modes: ["local", "multi"] },
  { id: "r-langue", categorie: "reflexe", titre: "Tire la langue", consigne: "Le dernier à tirer la langue boit 5 gorgées.", intensite: "hard", modes: ["local", "multi"] },

  // --- Duels : 1 contre 1, la carte dit qui l'emporte. Le perdant boit. ---
  { id: "d-bras", categorie: "duel", titre: "Bras de fer", consigne: "Bras de fer. Le perdant boit 4 gorgées.", intensite: "medium", modes: ["local", "multi"] },
  { id: "d-chifoumi", categorie: "duel", titre: "Chifoumi", consigne: "Pierre-feuille-ciseaux en 3 manches gagnantes. Le perdant boit 4 gorgées.", intensite: "douce", modes: ["local", "multi"] },
  { id: "d-regard", categorie: "duel", titre: "Concours de regard", consigne: "On se fixe : le premier qui cligne ou rit boit 5 gorgées.", intensite: "medium", modes: ["local", "multi"] },
  { id: "d-cul-sec", categorie: "duel", titre: "Le plus rapide", consigne: "Cul sec de vos verres au top. Le dernier à finir boit 3 gorgées de plus.", intensite: "hard", modes: ["local", "multi"] },
  { id: "d-equilibre", categorie: "duel", titre: "Sur un pied", consigne: "Tenez sur un pied. Le premier qui repose l'autre pied boit 5 gorgées.", intensite: "medium", modes: ["local", "multi"] },
  { id: "d-imitation", categorie: "duel", titre: "Le meilleur cri", consigne: "Chacun imite un animal. Les autres équipes votent : le moins convaincant boit 4 gorgées.", intensite: "hard", modes: ["local", "multi"] },

  // --- Collectifs : fin de manche, tout le monde joue, une équipe gagne. ---
  { id: "c-premier-boit", categorie: "collectif", titre: "Le plus rapide", consigne: "Au top, tout le monde boit une gorgée. La première équipe à reposer son verre gagne.", intensite: "medium", modes: ["local", "multi"] },
  { id: "c-anecdote", categorie: "collectif", titre: "La meilleure histoire", consigne: "Chaque équipe raconte sa pire soirée en 20 secondes. Les autres votent : la meilleure gagne.", intensite: "medium", modes: ["local", "multi"] },
  { id: "c-mime", categorie: "collectif", titre: "Mime express", consigne: "Chaque équipe mime un film. La première équipe reconnue par la salle gagne.", intensite: "douce", modes: ["local", "multi"] },
  { id: "c-silence", categorie: "collectif", titre: "Le dernier à rire", consigne: "Tout le monde se fixe. La dernière équipe à garder son sérieux gagne.", intensite: "medium", modes: ["local", "multi"] },
  { id: "c-culture", categorie: "collectif", titre: "Cite trois", consigne: "L'hôte annonce un thème (marques de bière, prénoms…). La première équipe à en citer trois gagne.", intensite: "douce", modes: ["local", "multi"] },
  { id: "c-karaoke", categorie: "collectif", titre: "La chanson", consigne: "Chaque équipe chante 10 secondes d'un tube. La salle vote : la meilleure gagne.", intensite: "hard", modes: ["local", "multi"] },

  // --- Malus : le gage à boire, refusable en payant des pièces. ---
  { id: "m-cul-sec", categorie: "malus", titre: "Petit cul sec", consigne: "Finis ton verre d'un trait, ou paie pour refuser.", intensite: "hard", modes: ["local", "multi"] },
  { id: "m-gorgees", categorie: "malus", titre: "Coup dur", consigne: "Bois 3 gorgées, ou paie pour refuser.", intensite: "medium", modes: ["local", "multi"] },
  { id: "m-accent", categorie: "malus", titre: "Grosse honte", consigne: "Parle avec un accent ridicule jusqu'à ton prochain tour, ou paie pour refuser.", intensite: "medium", modes: ["local", "multi"] },
  { id: "m-compliment", categorie: "malus", titre: "Déclaration", consigne: "Fais un compliment gênant à l'équipe de ton choix, ou paie pour refuser.", intensite: "douce", modes: ["local", "multi"] },
  { id: "m-statue", categorie: "malus", titre: "Statue", consigne: "Reste immobile jusqu'à ton prochain tour (2 gorgées si tu bouges), ou paie pour refuser.", intensite: "medium", modes: ["local", "multi"] },
];

const PAR_ID = new Map(DEFIS.map((d) => [d.id, d]));

export function defiParId(id: string): Defi | null {
  return PAR_ID.get(id) ?? null;
}

/**
 * Poids d'une intensité selon l'ambiance. Plus le poids est haut, plus la carte
 * a de chances de sortir. Un zéro l'exclut. Le catalogue penche déjà vers le
 * medium ; ces poids ne font que déplacer le curseur.
 */
const POIDS_AMBIANCE: Record<Ambiance, Record<Intensite, number>> = {
  classique: { douce: 3, medium: 3, hard: 2 },
  dejaChaud: { douce: 1, medium: 4, hard: 2 },
  sale: { douce: 1, medium: 3, hard: 4 },
  chaos: { douce: 0, medium: 2, hard: 5 },
  // Le poids par intensité reste neutre : « Équipes » agit surtout sur le
  // plateau (plus de cases d'interaction), pas sur le durcissement des cartes.
  equipes: { douce: 2, medium: 3, hard: 2 },
};

/** Les cartes des joueurs passent devant : un gros poids, jamais filtrées. */
const POIDS_PERSO = 6;

/**
 * Tire un défi d'une catégorie. Pur et déterministe : l'état ne garde que l'id,
 * ce qui suffit à ce que tous les téléphones affichent le même défi. Les cartes
 * perso partagent le même espace d'id (préfixées « perso- ») et sont mises en
 * avant.
 */
export function tirerDefi(
  categorie: CategorieDefi,
  ambiance: Ambiance,
  mode: ModeJeu,
  perso: readonly CartePerso[],
  rng: number,
): [id: string | null, rng: number] {
  const poids = POIDS_AMBIANCE[ambiance];
  const candidats: { id: string; poids: number }[] = [];

  for (const c of perso) {
    if (c.categorie === categorie) candidats.push({ id: c.id, poids: POIDS_PERSO });
  }
  for (const d of DEFIS) {
    if (d.categorie !== categorie || !d.modes.includes(mode)) continue;
    const p = poids[d.intensite];
    if (p > 0) candidats.push({ id: d.id, poids: p });
  }

  if (candidats.length === 0) {
    // L'ambiance « chaos » exclut les douces : si une catégorie n'a que des
    // douces, on retombe sur elles plutôt que de ne rien tirer.
    for (const d of DEFIS) {
      if (d.categorie === categorie && d.modes.includes(mode)) candidats.push({ id: d.id, poids: 1 });
    }
  }
  if (candidats.length === 0) return [null, rng];

  const total = candidats.reduce((s, c) => s + c.poids, 0);
  const [v, suivant] = tirer(rng);
  let seuil = v * total;
  for (const c of candidats) {
    seuil -= c.poids;
    if (seuil < 0) return [c.id, suivant];
  }
  return [candidats[candidats.length - 1].id, suivant];
}

/** Reconstitue le texte d'un défi, catalogue ou carte perso. */
export function texteDefi(id: string | null, perso: readonly CartePerso[]): { titre: string; consigne: string } | null {
  if (!id) return null;
  const cat = defiParId(id);
  if (cat) return { titre: cat.titre, consigne: cat.consigne };
  const p = perso.find((c) => c.id === id);
  if (p) return { titre: "Carte d'équipe", consigne: p.texte };
  return null;
}
