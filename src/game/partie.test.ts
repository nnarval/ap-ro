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

describe("duel éclair", () => {
  /**
   * Place le pion actif juste avant `cible`, prêt à y poser le pied.
   * On évite les croisements : le réducteur y demanderait un choix de chemin
   * au lieu d'avancer.
   */
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

  it("se déclenche quand un pion en rejoint un autre, et tire un défi instantané", () => {
    for (const graine of graines.slice(0, 60)) {
      const prep = preparerArrivee(creerPartie(graine, PIONS));
      if (!prep) continue;

      // On poste un adversaire sur la case d'arrivée.
      const avecOccupant: EtatPartie = {
        ...prep.etat,
        pions: prep.etat.pions.map((p, i) => (i === 1 ? { ...p, caseId: prep.cible } : p)),
      };
      const apres = reduire(avecOccupant, { type: "AVANCER", pasRestants: 1 });

      expect(apres.phase, `graine ${graine}`).toBe("defiInstantane");
      expect(defiParId(apres.defiId!)?.categorie, `graine ${graine}`).toBe("instantane");
      expect(pionsSurCaseActive(apres).map((p) => p.id).sort()).toEqual(["p0", "p1"]);
    }
  });

  it("ne se déclenche pas quand la case est libre", () => {
    for (const graine of graines.slice(0, 60)) {
      const prep = preparerArrivee(creerPartie(graine, PIONS));
      if (!prep) continue;
      // Les autres pions sont au départ, la cible n'est pas le départ.
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
    const apres = reduire(duel, { type: "RESOUDRE_DEFI_INSTANTANE", vainqueurId: "p1" });

    // La case doit encore produire son effet : le duel s'intercale, il ne
    // remplace pas la résolution.
    expect(apres.phase).toBe("resolution");
    expect(apres.defiId).toBeNull();
    expect(apres.journal.at(-1)?.texte).toContain(`${REGLAGES.gorgeesPerdantInstantane} gorgées`);
  });

  it("ignore un second « avance » venu d'un autre téléphone", () => {
    // En multi, tous les téléphones enchaînent le déplacement par minuterie.
    // Sans garde, le pion sauterait autant de cases qu'il y a d'appareils.
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

    // Le doublon part du même compteur périmé : il ne doit rien faire.
    expect(reduire(unPas, { type: "AVANCER", pasRestants: 3 })).toBe(unPas);
    // Alors que le pas suivant, lui, passe.
    expect(reduire(unPas, { type: "AVANCER", pasRestants: 2 }).pasRestants).toBe(1);
  });

  it("refuse un vainqueur qui ne participe pas au duel", () => {
    const prep = preparerArrivee(creerPartie(graines[0], PIONS))!;
    const avecOccupant: EtatPartie = {
      ...prep.etat,
      pions: prep.etat.pions.map((p, i) => (i === 1 ? { ...p, caseId: prep.cible } : p)),
    };
    const duel = reduire(avecOccupant, { type: "AVANCER", pasRestants: 1 });
    expect(reduire(duel, { type: "RESOUDRE_DEFI_INSTANTANE", vainqueurId: "p2" })).toBe(duel);
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
