import { describe, expect, it } from "vitest";
import { REGLAGES } from "./config";
import { defiParId } from "./defis";
import { creerPartie, pionsSurCaseActive, reduire, type DefinitionPion } from "./partie";
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
  it("pose le bon nombre d'étoiles, sur des emplacements distincts et hors départ", () => {
    for (const graine of graines) {
      const etat = creerPartie(graine, PIONS);
      expect(etat.etoilesSur.length, `graine ${graine}`).toBe(REGLAGES.etoilesSurPlateau);
      expect(new Set(etat.etoilesSur).size).toBe(etat.etoilesSur.length);
      expect(etat.etoilesSur, `graine ${graine}`).not.toContain(etat.plateau.depart);
      expect(etoilesSousUnPion(etat), `graine ${graine}`).toEqual([]);
    }
  });

  it("respecte l'objectif d'étoiles demandé", () => {
    for (const objectif of REGLAGES.objectifsEtoile) {
      const etat = creerPartie(graines[0], PIONS, { objectif });
      expect(etat.objectifEtoiles).toBe(objectif);
      expect(etat.etoilesRestantes).toBe(objectif);
    }
  });
});

describe("réflexe", () => {
  /** Place le pion actif juste avant `cible`, prêt à y poser le pied. */
  function preparerArrivee(etat: EtatPartie): { etat: EtatPartie; cible: string } | null {
    const depuis = Object.values(etat.plateau.cases).find(
      (c) => c.suivantes.length === 1 && c.suivantes[0] !== etat.plateau.depart,
    );
    if (!depuis) return null;
    const cible = depuis.suivantes[0];
    return {
      etat: {
        ...etat,
        pions: etat.pions.map((p, i) => (i === 0 ? { ...p, caseId: depuis.id } : p)),
        phase: "deplacement",
        pasRestants: 1,
      },
      cible,
    };
  }

  it("se déclenche quand une équipe en rejoint une autre, et tire un réflexe", () => {
    for (const graine of graines.slice(0, 60)) {
      const prep = preparerArrivee(creerPartie(graine, PIONS));
      if (!prep) continue;

      const avecOccupant: EtatPartie = {
        ...prep.etat,
        pions: prep.etat.pions.map((p, i) => (i === 1 ? { ...p, caseId: prep.cible } : p)),
      };
      const apres = reduire(avecOccupant, { type: "AVANCER", pasRestants: 1 });

      expect(apres.phase, `graine ${graine}`).toBe("reflexe");
      expect(defiParId(apres.defiId!)?.categorie, `graine ${graine}`).toBe("reflexe");
      expect(pionsSurCaseActive(apres).map((p) => p.id).sort()).toEqual(["p0", "p1"]);
    }
  });

  it("ne se déclenche pas quand la case est libre", () => {
    for (const graine of graines.slice(0, 60)) {
      const prep = preparerArrivee(creerPartie(graine, PIONS));
      if (!prep) continue;
      const apres = reduire(prep.etat, { type: "AVANCER", pasRestants: 1 });
      expect(apres.phase, `graine ${graine}`).toBe("resolution");
      expect(apres.defiId).toBeNull();
    }
  });

  it("rend la main à la case une fois le vainqueur désigné", () => {
    const prep = preparerArrivee(creerPartie(graines[0], PIONS))!;
    const avecOccupant: EtatPartie = {
      ...prep.etat,
      pions: prep.etat.pions.map((p, i) => (i === 1 ? { ...p, caseId: prep.cible } : p)),
    };
    const duel = reduire(avecOccupant, { type: "AVANCER", pasRestants: 1 });
    const apres = reduire(duel, { type: "RESOUDRE_REFLEXE", vainqueurId: "p1" });

    expect(apres.phase).toBe("resolution");
    expect(apres.defiId).toBeNull();
    expect(apres.journal.at(-1)?.texte).toContain(`${REGLAGES.gorgeesPerdantReflexe} gorgées`);
  });

  it("ignore un second « avance » venu d'un autre téléphone", () => {
    const etat = creerPartie(graines[0], PIONS);
    const depuis = Object.values(etat.plateau.cases).find((c) => c.suivantes.length === 1)!;
    const enRoute: EtatPartie = {
      ...etat,
      pions: etat.pions.map((p, i) => (i === 0 ? { ...p, caseId: depuis.id } : p)),
      phase: "deplacement",
      pasRestants: 3,
    };

    const unPas = reduire(enRoute, { type: "AVANCER", pasRestants: 3 });
    expect(unPas.pasRestants).toBe(2);
    expect(reduire(unPas, { type: "AVANCER", pasRestants: 3 })).toBe(unPas);
    expect(reduire(unPas, { type: "AVANCER", pasRestants: 2 }).pasRestants).toBe(1);
  });

  it("refuse un vainqueur qui ne participe pas au réflexe", () => {
    const prep = preparerArrivee(creerPartie(graines[0], PIONS))!;
    const avecOccupant: EtatPartie = {
      ...prep.etat,
      pions: prep.etat.pions.map((p, i) => (i === 1 ? { ...p, caseId: prep.cible } : p)),
    };
    const duel = reduire(avecOccupant, { type: "AVANCER", pasRestants: 1 });
    expect(reduire(duel, { type: "RESOUDRE_REFLEXE", vainqueurId: "p2" })).toBe(duel);
  });
});

describe("étoile greffée sur une case", () => {
  it("saute ailleurs quand on la ramasse, et jamais sous un pion", () => {
    for (const graine of graines) {
      let etat = creerPartie(graine, PIONS);

      // On sature volontairement le plateau : les autres pions campent sur des
      // cases-hôtes possibles, pour ne laisser presque aucune case libre.
      const hotes = Object.keys(etat.plateau.cases).filter((id) => id !== etat.plateau.depart);
      etat = {
        ...etat,
        pions: etat.pions.map((p, i) =>
          i === 0 ? p : { ...p, caseId: hotes[(i * 5) % hotes.length] },
        ),
      };

      const cible = etat.etoilesSur[0];
      const gardee = etat.etoilesSur.filter((id) => id !== cible);
      const apres = forcerRamassage(etat, cible);

      expect(apres.etoilesSur, `graine ${graine}`).not.toContain(cible);
      expect(new Set(apres.etoilesSur).size).toBe(apres.etoilesSur.length);
      expect(apres.etoilesRestantes).toBe(etat.etoilesRestantes - 1);

      const nouvelles = apres.etoilesSur.filter((id) => !gardee.includes(id));
      expect(nouvelles.length, `graine ${graine}`).toBeLessThanOrEqual(1);
      if (nouvelles.length === 1) {
        expect(apres.dernierSautEtoile).toEqual({ de: cible, vers: nouvelles[0] });
        const occupees = new Set(apres.pions.map((p) => p.caseId));
        const optionsValides = hotes.filter(
          (id) => !gardee.includes(id) && !occupees.has(id) && id !== cible,
        );
        if (optionsValides.length > 0) {
          expect(optionsValides, `graine ${graine}`).toContain(nouvelles[0]);
        }
      }
    }
  });

  it("maintient deux étoiles sur le plateau tant qu'il en reste à distribuer", () => {
    for (const graine of graines.slice(0, 50)) {
      let etat = creerPartie(graine, PIONS, { objectif: 8 });
      let garde = 0;
      while (etat.etoilesRestantes > 0 && garde++ < 100) {
        const attendu = Math.min(REGLAGES.etoilesSurPlateau, etat.etoilesRestantes);
        expect(etat.etoilesSur.length, `graine ${graine}`).toBe(attendu);
        etat = forcerRamassage(etat, etat.etoilesSur[0]);
      }
      expect(etat.etoilesRestantes).toBe(0);
      expect(etat.etoilesSur).toEqual([]);
      const total = etat.pions.reduce((s, p) => s + p.etoiles, 0);
      expect(total).toBe(8);
    }
  });
});
