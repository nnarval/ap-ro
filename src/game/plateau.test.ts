import { describe, expect, it } from "vitest";
import { effectifsPour } from "./config";
import { genererPlateau } from "./plateau";
import type { Ambiance, TypeCase } from "./types";

/** Un plateau tiré au hasard doit rester jouable, quelle que soit la graine. */
describe("genererPlateau", () => {
  const graines = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);
  const ambiances: Ambiance[] = ["classique", "dejaChaud", "sale", "chaos", "equipes"];

  it("ne produit que des liens vers des cases existantes", () => {
    for (const graine of graines) {
      const p = genererPlateau(graine);
      for (const c of Object.values(p.cases)) {
        expect(c.suivantes.length, `case ${c.id} sans issue (graine ${graine})`).toBeGreaterThan(0);
        for (const suivante of c.suivantes) {
          expect(p.cases[suivante], `${c.id} -> ${suivante} (graine ${graine})`).toBeDefined();
        }
      }
    }
  });

  it("rend toutes les cases atteignables depuis le départ", () => {
    for (const graine of graines) {
      const p = genererPlateau(graine);
      const vues = new Set<string>();
      const pile = [p.depart];
      while (pile.length) {
        const id = pile.pop()!;
        if (vues.has(id)) continue;
        vues.add(id);
        pile.push(...p.cases[id].suivantes);
      }
      expect(vues.size, `graine ${graine}`).toBe(Object.keys(p.cases).length);
    }
  });

  it("respecte des effectifs FIXES par type, propres à l'ambiance", () => {
    for (const ambiance of ambiances) {
      const attendus = effectifsPour(ambiance);
      const totalAttendu = Object.values(attendus).reduce((a, b) => a + b, 0);
      for (const graine of graines) {
        const p = genererPlateau(graine, ambiance);
        const cases = Object.values(p.cases);
        const compte = (t: TypeCase) => cases.filter((c) => c.type === t).length;
        const contexte = `ambiance ${ambiance}, graine ${graine}`;

        expect(compte("depart"), contexte).toBe(1);
        expect(cases.length, contexte).toBe(totalAttendu + 1);
        for (const [type, n] of Object.entries(attendus)) {
          expect(compte(type as TypeCase), `${type}, ${contexte}`).toBe(n);
        }
      }
    }
  });

  it("laisse à chaque croisement au moins un chemin qui ne commence pas par un malus", () => {
    for (const ambiance of ambiances) {
      for (const graine of graines) {
        const p = genererPlateau(graine, ambiance);
        for (const c of Object.values(p.cases)) {
          if (c.suivantes.length <= 1) continue;
          const sansMalus = c.suivantes.filter((s) => p.cases[s].type !== "malus");
          expect(
            sansMalus.length,
            `croisement ${c.id} tout en malus (ambiance ${ambiance}, graine ${graine})`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("garde des malus sur le circuit, pas seulement sur les raccourcis", () => {
    let plateauxSansMalusSurLeCircuit = 0;
    for (const graine of graines) {
      const surCircuit = Object.values(genererPlateau(graine).cases).filter(
        (c) => !c.id.startsWith("r") && c.type === "malus",
      ).length;
      if (surCircuit === 0) plateauxSansMalusSurLeCircuit++;
    }
    // Qui ne prend jamais de raccourci doit quand même croiser des malus.
    expect(plateauxSansMalusSurLeCircuit).toBe(0);
  });

  it("change de forme d'une graine à l'autre", () => {
    const empreintes = new Set(
      graines.slice(0, 50).map((g) => {
        const p = genererPlateau(g);
        return Object.values(p.cases)
          .map((c) => `${Math.round(c.x)},${Math.round(c.y)}`)
          .join("|");
      }),
    );
    expect(empreintes.size).toBe(50);
  });
});
