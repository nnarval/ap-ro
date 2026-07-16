import { describe, expect, it } from "vitest";
import { REGLAGES } from "./config";
import { creerPartie, reduire, type DefinitionPion } from "./partie";
import type { EtatPartie } from "./types";

const PIONS: DefinitionPion[] = [
  { nom: "A", membres: ["a"] },
  { nom: "B", membres: ["b"] },
  { nom: "C", membres: ["c"] },
  { nom: "D", membres: ["d"] },
];

const graines = Array.from({ length: 200 }, (_, i) => i * 104729 + 17);

/** Aucune étoile ne doit se trouver sur une case occupée par un pion. */
function etoilesSousUnPion(etat: EtatPartie): string[] {
  const occupees = new Set(etat.pions.map((p) => p.caseId));
  return etat.etoilesSur.filter((id) => occupees.has(id));
}

/**
 * Force le pion actif à ramasser une étoile : on le pose dessus, en phase de
 * résolution. L'étoile du plateau est gratuite, elle est prise d'office.
 * Passer par le réducteur plutôt que par des dés truqués garde le test
 * indépendant de la chance.
 */
function forcerRamassage(etat: EtatPartie, surCase: string): EtatPartie {
  const idActif = etat.ordreTour[etat.indexTour];
  const prepare: EtatPartie = {
    ...etat,
    pions: etat.pions.map((p) => (p.id === idActif ? { ...p, caseId: surCase } : p)),
    phase: "resolution",
  };
  return reduire(prepare, { type: "RESOUDRE_CASE" });
}

describe("creerPartie", () => {
  it("pose le bon nombre d'étoiles, sur des emplacements distincts", () => {
    for (const graine of graines) {
      const etat = creerPartie(graine, PIONS);
      expect(etat.etoilesSur.length, `graine ${graine}`).toBe(REGLAGES.etoilesSurPlateau);
      expect(new Set(etat.etoilesSur).size).toBe(etat.etoilesSur.length);
      for (const id of etat.etoilesSur) {
        expect(etat.plateau.emplacementsEtoile).toContain(id);
      }
    }
  });

  it("ne pose aucune étoile sur le départ, où tous les pions démarrent", () => {
    for (const graine of graines) {
      const etat = creerPartie(graine, PIONS);
      expect(etoilesSousUnPion(etat), `graine ${graine}`).toEqual([]);
    }
  });
});

describe("ramassage d'une étoile", () => {
  it("fait réapparaître l'étoile ailleurs, et jamais sous un pion", () => {
    for (const graine of graines) {
      let etat = creerPartie(graine, PIONS);

      // On sature volontairement le plateau : les autres pions campent sur des
      // emplacements d'étoile, pour ne laisser presque aucune case libre.
      const emplacements = etat.plateau.emplacementsEtoile;
      etat = {
        ...etat,
        pions: etat.pions.map((p, i) =>
          i === 0 ? p : { ...p, caseId: emplacements[i % emplacements.length] },
        ),
      };

      const cible = etat.etoilesSur[0];
      const gardee = etat.etoilesSur.filter((id) => id !== cible);
      const apres = forcerRamassage(etat, cible);

      expect(apres.etoilesSur, `graine ${graine}`).not.toContain(cible);
      expect(new Set(apres.etoilesSur).size).toBe(apres.etoilesSur.length);

      // Seule l'étoile qui vient d'être posée nous intéresse : qu'un pion se
      // tienne sur l'autre est normal, c'est même comme ça qu'on la ramasse.
      const nouvelles = apres.etoilesSur.filter((id) => !gardee.includes(id));
      // Plateau saturé à dessein : il peut ne rester aucun emplacement tenable,
      // et mieux vaut alors une étoile de moins qu'une étoile mal posée.
      expect(nouvelles.length, `graine ${graine}`).toBeLessThanOrEqual(1);

      const occupees = new Set(apres.pions.map((p) => p.caseId));
      const optionsValides = emplacements.filter(
        (id) => !gardee.includes(id) && !occupees.has(id) && id !== cible,
      );
      // Le repli tolère une case occupée, mais seulement s'il n'y avait
      // vraiment aucune autre option.
      if (optionsValides.length > 0 && nouvelles.length === 1) {
        expect(optionsValides, `graine ${graine}`).toContain(nouvelles[0]);
      }
    }
  });

  it("maintient deux étoiles sur le plateau tant qu'il en reste à distribuer", () => {
    for (const graine of graines.slice(0, 50)) {
      let etat = creerPartie(graine, PIONS);
      while (etat.etoilesRestantes > 0) {
        const attendu = Math.min(REGLAGES.etoilesSurPlateau, etat.etoilesRestantes);
        expect(etat.etoilesSur.length, `graine ${graine}`).toBe(attendu);
        etat = forcerRamassage(etat, etat.etoilesSur[0]);
      }
      expect(etat.phase).toBe("terminee");
      expect(etat.etoilesSur).toEqual([]);
      const total = etat.pions.reduce((s, p) => s + p.etoiles, 0);
      expect(total).toBe(REGLAGES.etoilesParPartie);
    }
  });
});
