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

/** Manches jouables en 20 minutes, d'après le rythme visé. */
const MANCHES_CIBLE = 6;

type Rng = ReturnType<typeof creerRng>;

/**
 * Un pas de simulation.
 *
 * Le choix aux croisements doit rester aléatoire : une politique régulière
 * enferme les pions dans une orbite périodique qui peut ne jamais croiser
 * certaines cases, ce qui fausse la mesure.
 *
 * Le pion achète l'étoile dès qu'il peut : c'est une borne optimiste, de vrais
 * joueurs feront moins bien, jamais mieux.
 */
function unPas(etat: EtatPartie, rng: Rng): EtatPartie {
  switch (etat.phase) {
    case "lancer":
      return reduire(etat, { type: "LANCER_DE" });
    case "deplacement":
      return reduire(etat, { type: "AVANCER", pasRestants: etat.pasRestants });
    case "croisement":
      return reduire(etat, { type: "CHOISIR_CHEMIN", caseId: rng.element(etat.choix) });
    case "defiInstantane":
      return reduire(etat, {
        type: "RESOUDRE_DEFI_INSTANTANE",
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
    case "finTour":
      return reduire(etat, { type: "FIN_TOUR" });
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

/** D'où viennent les étoiles, d'après le journal. */
function sources(etat: EtatPartie) {
  const contient = (motif: string) =>
    etat.journal.filter((e) => e.texte.includes(motif)).length;
  return {
    plateau: contient("trouve une étoile"),
    boutique: contient("achète une étoile"),
    defiCollectif: contient("défi de fin de manche"),
  };
}

const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const moyenne = (xs: number[]) => somme(xs) / xs.length;
const mediane = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe("équilibrage", () => {
  const graines = Array.from({ length: 150 }, (_, i) => i * 7717 + 3);

  it("finit toujours par distribuer toutes les étoiles, sans jamais se bloquer", () => {
    for (const graine of graines) {
      const etat = jouer(graine, (e) => e.phase === "terminee" || e.manche > 3000);
      expect(etat.phase, `graine ${graine}`).toBe("terminee");
      expect(somme(etat.pions.map((p) => p.etoiles))).toBe(REGLAGES.etoilesParPartie);
    }
  });

  /**
   * Une phase qu'aucune partie n'atteint, c'est du contenu que personne ne
   * verra jamais — et ça n'a rien de théorique : les malus ont déjà été,
   * pendant un temps, tous relégués sur les raccourcis.
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
      "defiInstantane",
      "resolution",
      "choixMalus",
      "boutique",
      "choixAdversaire",
      "defiDuel",
      "finTour",
      "defiCollectif",
      "terminee",
    ];
    expect([...attendues].filter((p) => !vues.has(p))).toEqual([]);
  });

  it("distribue le gros des étoiles dans le temps imparti", () => {
    const parties = graines.map((g) =>
      jouer(g, (e) => e.manche > MANCHES_CIBLE || e.phase === "terminee"),
    );
    const etoiles = parties.map((e) => somme(e.pions.map((p) => p.etoiles)));
    const src = parties.map(sources);

    console.log(
      [
        "",
        `  Après ${MANCHES_CIBLE} manches (la cible des 20 minutes) :`,
        `    étoiles distribuées : ${moyenne(etoiles).toFixed(1)} / ${REGLAGES.etoilesParPartie}`,
        `    dont défi de fin de manche : ${moyenne(src.map((s) => s.defiCollectif)).toFixed(1)}`,
        `         trouvées sur le plateau : ${moyenne(src.map((s) => s.plateau)).toFixed(1)}`,
        `         achetées en boutique : ${moyenne(src.map((s) => s.boutique)).toFixed(1)}`,
        "",
        `  Partie complète : ${mediane(
          graines.map((g) => jouer(g, (e) => e.phase === "terminee").manche),
        )} manches (médiane).`,
        "",
      ].join("\n"),
    );

    // Le défi de fin de manche garantit une étoile par manche : sans lui, le
    // plateau seul plafonnait à ~0,3 étoile par partie.
    expect(moyenne(etoiles)).toBeGreaterThanOrEqual(MANCHES_CIBLE);
  });
});
