import { describe, expect, it } from "vitest";
import { REGLAGES } from "./config";
import { creerPartie, pionActif, reduire, type DefinitionPion } from "./partie";
import { creerRng } from "./rng";
import type { EtatPartie } from "./types";

const PIONS: DefinitionPion[] = [
  { nom: "A", membres: ["a"] },
  { nom: "B", membres: ["b"] },
  { nom: "C", membres: ["c"] },
  { nom: "D", membres: ["d"] },
];

/** Manches jouables en 20 minutes, d'après le rythme visé (~3,5 min/manche). */
const MANCHES_CIBLE = 6;

type Rng = ReturnType<typeof creerRng>;

interface Mesures {
  etat: EtatPartie;
  /** Tours de pion joués. */
  tours: number;
  /** Fois où un pion s'est arrêté sur une case portant une étoile. */
  atterrissages: number;
  /** Parmi ceux-là, ceux où il avait de quoi payer. */
  solvables: number;
  piecesMax: number;
}

/**
 * Joue jusqu'à `arret`. Le choix aux croisements doit rester aléatoire : une
 * politique régulière enferme les pions dans une orbite périodique qui peut ne
 * jamais croiser certaines cases, ce qui fausse la mesure.
 *
 * Le pion achète dès qu'il peut : c'est une borne optimiste, de vrais joueurs
 * feront moins bien, jamais mieux.
 */
function jouer(graine: number, arret: (e: EtatPartie) => boolean): Mesures {
  const rng: Rng = creerRng((graine ^ 0x5f3759df) >>> 0);
  let etat = creerPartie(graine, PIONS);
  const m: Omit<Mesures, "etat"> = { tours: 0, atterrissages: 0, solvables: 0, piecesMax: 0 };
  let garde = 0;

  while (!arret(etat)) {
    if (garde++ > 2_000_000) throw new Error(`Boucle infinie, graine ${graine}`);

    switch (etat.phase) {
      case "lancer":
        m.tours++;
        etat = reduire(etat, { type: "LANCER_DE" });
        break;
      case "deplacement":
        etat = reduire(etat, { type: "AVANCER" });
        break;
      case "croisement":
        etat = reduire(etat, { type: "CHOISIR_CHEMIN", caseId: rng.element(etat.choix) });
        break;
      case "resolution": {
        const p = pionActif(etat);
        if (etat.etoilesSur.includes(p.caseId)) {
          m.atterrissages++;
          if (p.pieces >= etat.prixEtoile) m.solvables++;
        }
        etat = reduire(etat, { type: "RESOUDRE_CASE" });
        break;
      }
      case "achatEtoile":
        etat = reduire(etat, { type: "ACHETER_ETOILE", acheter: true });
        break;
      case "finTour":
        etat = reduire(etat, { type: "FIN_TOUR" });
        break;
      default:
        return { ...m, etat };
    }
    for (const p of etat.pions) m.piecesMax = Math.max(m.piecesMax, p.pieces);
  }
  return { ...m, etat };
}

const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const moyenne = (xs: number[]) => somme(xs) / xs.length;
const mediane = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe("équilibrage", () => {
  const graines = Array.from({ length: 150 }, (_, i) => i * 7717 + 3);

  it("finit toujours par distribuer toutes les étoiles, sans jamais se bloquer", () => {
    for (const graine of graines) {
      // Borne très large : on teste l'absence de blocage, pas la vitesse.
      const { etat } = jouer(graine, (e) => e.phase === "terminee" || e.manche > 3000);
      expect(etat.phase, `graine ${graine}`).toBe("terminee");
      expect(somme(etat.pions.map((p) => p.etoiles))).toBe(REGLAGES.etoilesParPartie);
    }
  });

  it("mesure ce qu'une partie de 20 minutes distribue réellement", () => {
    const parties = graines.map((g) => jouer(g, (e) => e.manche > MANCHES_CIBLE));
    const etoiles = parties.map((p) => somme(p.etat.pions.map((x) => x.etoiles)));
    const atterrissages = somme(parties.map((p) => p.atterrissages));
    const solvables = somme(parties.map((p) => p.solvables));

    const completes = graines.map((g) => jouer(g, (e) => e.phase === "terminee").etat.manche);

    console.log(
      [
        "",
        `  Sur ${MANCHES_CIBLE} manches (la cible des 20 minutes) :`,
        `    étoiles distribuées : ${moyenne(etoiles).toFixed(2)} en moyenne ` +
          `(objectif ${REGLAGES.etoilesParPartie})`,
        `    atterrissages sur une étoile : ${(atterrissages / parties.length).toFixed(2)} par partie`,
        `    dont le pion pouvait payer : ${
          atterrissages ? ((100 * solvables) / atterrissages).toFixed(0) : 0
        }%`,
        `    pièces max jamais atteintes : ${Math.max(...parties.map((p) => p.piecesMax))} ` +
          `(prix de l'étoile : ${REGLAGES.prixEtoile})`,
        "",
        `  Pour distribuer les ${REGLAGES.etoilesParPartie} étoiles, il faut en réalité ` +
          `${mediane(completes)} manches (médiane), max ${Math.max(...completes)}.`,
        "",
      ].join("\n"),
    );

    // Garde-fou : le jour où l'économie sera revue, ce seuil doit sauter et
    // c'est le signal qu'il faut le resserrer.
    expect(moyenne(etoiles)).toBeLessThan(REGLAGES.etoilesParPartie);
  });
});
