import { describe, expect, it } from "vitest";
import { REGLAGES } from "./config";
import { genererPlateau } from "./plateau";

/** Un plateau tiré au hasard doit rester jouable, quelle que soit la graine. */
describe("genererPlateau", () => {
  const graines = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);

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

  it("laisse assez d'emplacements d'étoile pour en garnir plusieurs", () => {
    for (const graine of graines) {
      const p = genererPlateau(graine);
      // Il faut de la marge : les emplacements occupés par un pion sont écartés
      // au moment de faire réapparaître une étoile.
      expect(p.emplacementsEtoile.length, `graine ${graine}`).toBeGreaterThan(
        REGLAGES.etoilesSurPlateau + 1,
      );
      for (const id of p.emplacementsEtoile) {
        expect(p.cases[id].type).toBe("etoile");
      }
    }
  });

  it("ne pose jamais d'étoile sur le départ", () => {
    for (const graine of graines) {
      const p = genererPlateau(graine);
      expect(p.emplacementsEtoile, `graine ${graine}`).not.toContain(p.depart);
      expect(p.cases[p.depart].type).toBe("depart");
    }
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
