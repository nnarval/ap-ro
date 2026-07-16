import { POIDS_CASES, REGLAGES } from "./config";
import { creerRng } from "./rng";
import type { Case, Plateau, TypeCase } from "./types";

/**
 * Génère un plateau complet à partir d'une graine.
 *
 * Le circuit principal est une courbe en coordonnées polaires : le rayon varie
 * selon quelques harmoniques tirées au hasard, ce qui donne une forme organique
 * différente à chaque partie. L'avantage du polaire, c'est qu'une courbe dont le
 * rayon reste positif ne peut pas se recouper toute seule — le circuit est
 * valide par construction, sans avoir à tester les intersections.
 *
 * Viennent ensuite un ou deux raccourcis qui traversent le plateau. Ce sont eux
 * qui créent les croisements, et donc les seules vraies décisions de
 * déplacement du jeu.
 */
export function genererPlateau(graine: number): Plateau {
  const rng = creerRng(graine);
  const cases: Record<string, Case> = {};

  const nb = rng.entier(REGLAGES.casesMin, REGLAGES.casesMax);
  const rayonBase = 300;

  // Trois harmoniques : la forme a des lobes, sans devenir illisible.
  const harmoniques = [0, 1, 2].map(() => ({
    frequence: rng.entier(2, 5),
    amplitude: 0.06 + rng.reel() * 0.12,
    phase: rng.reel() * Math.PI * 2,
  }));

  const rayonA = (angle: number) => {
    let facteur = 1;
    for (const h of harmoniques) {
      facteur += h.amplitude * Math.sin(h.frequence * angle + h.phase);
    }
    return rayonBase * facteur;
  };

  // Circuit principal.
  const pasAngulaire = (Math.PI * 2) / nb;
  for (let i = 0; i < nb; i++) {
    // Le tremblement reste sous la moitié du pas : l'angle est toujours
    // croissant, donc la courbe reste simple.
    const angle = i * pasAngulaire + (rng.reel() - 0.5) * pasAngulaire * 0.5;
    const rayon = rayonA(angle);
    cases[`c${i}`] = {
      id: `c${i}`,
      type: "neutre",
      x: Math.cos(angle) * rayon,
      y: Math.sin(angle) * rayon,
      suivantes: [`c${(i + 1) % nb}`],
    };
  }

  cases.c0.type = "depart";

  // Emplacements d'étoile, répartis régulièrement pour qu'aucun pion ne soit
  // jamais très loin de l'un d'eux : sur une partie de 20 minutes, courir une
  // demi-boucle derrière une étoile, c'est déjà trop long.
  const nbEtoiles = rng.entier(REGLAGES.emplacementsEtoileMin, REGLAGES.emplacementsEtoileMax);
  const emplacementsEtoile: string[] = [];
  const ecart = nb / nbEtoiles;
  for (let i = 0; i < nbEtoiles; i++) {
    const brut = Math.round(i * ecart + rng.entier(-1, 1));
    let index = ((brut % nb) + nb) % nb;
    // Tous les pions démarrent sur le départ : une étoile posée là serait
    // cueillie au premier tour sans que personne l'ait cherchée.
    if (index === 0) index = 1;
    const id = `c${index}`;
    if (!emplacementsEtoile.includes(id)) {
      emplacementsEtoile.push(id);
      cases[id].type = "etoile";
    }
  }

  // Raccourcis. Ils partent d'une case du circuit et rejoignent une case à peu
  // près opposée, en passant près du centre.
  const nbRaccourcis = rng.entier(REGLAGES.raccourcisMin, REGLAGES.raccourcisMax);
  const departsUtilises = new Set<string>();

  for (let k = 0; k < nbRaccourcis; k++) {
    const depart = rng.entier(0, nb - 1);
    const idDepart = `c${depart}`;
    const arrivee = (depart + Math.floor(nb / 2) + rng.entier(-2, 2) + nb) % nb;
    const idArrivee = `c${arrivee}`;

    if (
      idDepart === "c0" ||
      idArrivee === "c0" ||
      departsUtilises.has(idDepart) ||
      idDepart === idArrivee
    ) {
      continue;
    }
    departsUtilises.add(idDepart);

    const a = cases[idDepart];
    const b = cases[idArrivee];
    // Point de contrôle décalé du centre, sinon tous les raccourcis se
    // ressemblent et se superposent.
    const cx = (rng.reel() - 0.5) * rayonBase * 0.5;
    const cy = (rng.reel() - 0.5) * rayonBase * 0.5;

    const longueur = rng.entier(3, 5);
    const idsRaccourci: string[] = [];
    for (let i = 1; i <= longueur; i++) {
      const t = i / (longueur + 1);
      const u = 1 - t;
      const id = `r${k}_${i}`;
      idsRaccourci.push(id);
      cases[id] = {
        id,
        type: "neutre",
        x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
        y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
        suivantes: [],
      };
    }

    for (let i = 0; i < idsRaccourci.length; i++) {
      cases[idsRaccourci[i]].suivantes = [
        i + 1 < idsRaccourci.length ? idsRaccourci[i + 1] : idArrivee,
      ];
    }
    // La case de départ devient un croisement.
    a.suivantes = [...a.suivantes, idsRaccourci[0]];
  }

  // Types des cases encore neutres.
  const typesPonderes: TypeCase[] = [];
  for (const [type, poids] of Object.entries(POIDS_CASES)) {
    for (let i = 0; i < poids; i++) typesPonderes.push(type as TypeCase);
  }
  for (const c of Object.values(cases)) {
    if (c.type === "neutre") c.type = rng.element(typesPonderes);
  }
  // Le raccourci doit se payer : un chemin plus court ET sans risque serait
  // toujours le bon choix, donc on y force du malus.
  for (const c of Object.values(cases)) {
    if (c.id.startsWith("r") && c.type === "bonus") c.type = "malus";
  }

  const xs = Object.values(cases).map((c) => c.x);
  const ys = Object.values(cases).map((c) => c.y);
  const marge = 60;

  return {
    graine,
    cases,
    depart: "c0",
    emplacementsEtoile,
    limites: {
      minX: Math.min(...xs) - marge,
      minY: Math.min(...ys) - marge,
      maxX: Math.max(...xs) + marge,
      maxY: Math.max(...ys) + marge,
    },
  };
}
