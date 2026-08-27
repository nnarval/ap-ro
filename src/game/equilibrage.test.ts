import { describe, expect, it } from "vitest";
import { REGLAGES } from "./config";
import { creerPartie, pionActif, pionsSurCaseActive, reduire, type DefinitionPion } from "./partie";
import { creerRng } from "./rng";
import type { EtatPartie, Phase } from "./types";

const PIONS: DefinitionPion[] = [
  { nom: "A", membres: ["a"] },
  { nom: "B", membres: ["b"] },
  { nom: "C", membres: ["c"] },
  { nom: "D", membres: ["d"] },
];

type Rng = ReturnType<typeof creerRng>;

/**
 * Un pas de simulation.
 *
 * Le choix aux croisements reste aléatoire : une politique régulière enferme
 * les pions dans une orbite périodique qui peut ne jamais croiser certaines
 * cases, ce qui fausse la mesure. L'équipe achète l'étoile dès qu'elle peut :
 * borne optimiste, de vrais joueurs feront moins bien, jamais mieux.
 */
function unPas(etat: EtatPartie, rng: Rng): EtatPartie {
  switch (etat.phase) {
    case "lancer":
      return reduire(etat, { type: "LANCER_DE" });
    case "deplacement":
      return reduire(etat, { type: "AVANCER", pasRestants: etat.pasRestants });
    case "croisement":
      return reduire(etat, { type: "CHOISIR_CHEMIN", caseId: rng.element(etat.choix) });
    case "reflexe":
      return reduire(etat, {
        type: "RESOUDRE_REFLEXE",
        vainqueurId: rng.element(pionsSurCaseActive(etat)).id,
      });
    case "resolution":
      return reduire(etat, { type: "RESOUDRE_CASE" });
    case "choixMalus":
      return reduire(etat, { type: "CHOISIR_MALUS", gage: rng.reel() < 0.5 });
    case "boutique":
      return pionActif(etat).pieces >= REGLAGES.prixEtoileBoutique
        ? reduire(etat, { type: "ACHETER_ETOILE" })
        : reduire(etat, { type: "QUITTER_BOUTIQUE" });
    case "choixAdversaire":
      return reduire(etat, {
        type: "CHOISIR_ADVERSAIRE",
        pionId: rng.element(etat.pions.filter((p) => p.id !== pionActif(etat).id)).id,
      });
    case "defiDuel":
      return reduire(etat, {
        type: "RESOUDRE_DEFI",
        vainqueurId: rng.reel() < 0.5 ? pionActif(etat).id : etat.adversaireId!,
      });
    case "bonus":
    case "evenement":
    case "roulette":
      return reduire(etat, { type: "CONTINUER" });
    case "finTour":
      return reduire(etat, { type: "FIN_TOUR" });
    case "roueManche":
      return reduire(etat, { type: "LANCER_ROUE_MANCHE" });
    case "defiCollectif":
      return reduire(etat, {
        type: "RESOUDRE_DEFI_COLLECTIF",
        vainqueurId: rng.element(etat.pions).id,
      });
    default:
      return etat;
  }
}

function jouer(
  graine: number,
  arret: (e: EtatPartie) => boolean,
  phasesVues?: Set<Phase>,
): EtatPartie {
  const rng: Rng = creerRng((graine ^ 0x5f3759df) >>> 0);
  let etat = creerPartie(graine, PIONS);
  let garde = 0;

  while (!arret(etat)) {
    if (garde++ > 2_000_000) throw new Error(`Boucle infinie, graine ${graine}`);
    phasesVues?.add(etat.phase);
    etat = unPas(etat, rng);
  }
  phasesVues?.add(etat.phase);
  return etat;
}

const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mediane = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe("équilibrage", () => {
  const graines = Array.from({ length: 150 }, (_, i) => i * 7717 + 3);

  it("finit toujours par distribuer toutes les étoiles, sans jamais se bloquer", () => {
    for (const graine of graines) {
      const etat = jouer(graine, (e) => e.phase === "terminee" || e.manche > 3000);
      expect(etat.phase, `graine ${graine}`).toBe("terminee");
      expect(somme(etat.pions.map((p) => p.etoiles))).toBe(etat.objectifEtoiles);
    }
  });

  /**
   * Une phase qu'aucune partie n'atteint, c'est du contenu que personne ne
   * verra jamais.
   */
  it("fait passer les parties par toutes les phases du jeu", () => {
    const vues = new Set<Phase>();
    for (const graine of graines) {
      jouer(graine, (e) => e.phase === "terminee", vues);
    }

    const attendues: Phase[] = [
      "lancer",
      "deplacement",
      "croisement",
      "reflexe",
      "resolution",
      "bonus",
      "choixMalus",
      "boutique",
      "choixAdversaire",
      "defiDuel",
      "evenement",
      "roulette",
      "finTour",
      "roueManche",
      "defiCollectif",
      "terminee",
    ];
    expect([...attendues].filter((p) => !vues.has(p))).toEqual([]);
  });

  it("boucle la partie dans le nombre de manches visé par l'objectif", () => {
    const objectif = REGLAGES.objectifParDefaut;
    const manches = graines.map((g) => jouer(g, (e) => e.phase === "terminee").manche);
    // Une étoile garantie par fin de manche, plus celles du plateau : la partie
    // ne doit pas traîner au-delà de l'objectif.
    console.log(`  Objectif ${objectif} étoiles : ${mediane(manches)} manches (médiane).`);
    expect(mediane(manches)).toBeLessThanOrEqual(objectif);
  });
});
