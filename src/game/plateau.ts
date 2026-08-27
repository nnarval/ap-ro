import { effectifsPour } from "./config";
import { creerRng } from "./rng";
import type { Ambiance, Case, Plateau, TypeCase } from "./types";

/**
 * Génère un plateau complet à partir d'une graine et d'une ambiance.
 *
 * Le circuit principal est une courbe en coordonnées polaires : le rayon varie
 * selon quelques harmoniques tirées au hasard, ce qui donne une forme différente
 * à chaque partie. L'avantage du polaire, c'est qu'une courbe dont le rayon
 * reste positif ne peut pas se recouper — le circuit est valide par
 * construction, sans test d'intersection.
 *
 * Viennent ensuite un ou deux raccourcis qui traversent le plateau. Ce sont eux
 * qui créent les croisements, et donc les seules vraies décisions de
 * déplacement du jeu.
 *
 * La composition (le nombre de chaque type de case) est FIXE pour une ambiance
 * donnée : d'une partie à l'autre, seule la forme change. Et à chaque
 * croisement, au moins un chemin ne commence pas par un malus — sinon le choix
 * n'en serait pas un.
 */
export function genererPlateau(graine: number, ambiance: Ambiance = "classique"): Plateau {
  const rng = creerRng(graine);
  const cases: Record<string, Case> = {};

  const effectifs = effectifsPour(ambiance);
  const nbPlayables = Object.values(effectifs).reduce((a, b) => a + b, 0);
  const total = nbPlayables + 1; // + le départ

  // On répartit le total entre le circuit et 1 à 2 raccourcis, de sorte que le
  // total reste exact : la composition en dépend.
  const nbRaccourcis = rng.entier(1, 2);
  const longueurs = Array.from({ length: nbRaccourcis }, () => rng.entier(3, 5));
  const cellulesRaccourcis = longueurs.reduce((a, b) => a + b, 0);
  const nb = total - cellulesRaccourcis;

  const rayonBase = 300;
  const harmoniques = [0, 1, 2].map(() => ({
    frequence: rng.entier(2, 5),
    amplitude: 0.06 + rng.reel() * 0.12,
    phase: rng.reel() * Math.PI * 2,
  }));
  const rayonA = (angle: number) => {
    let facteur = 1;
    for (const h of harmoniques) facteur += h.amplitude * Math.sin(h.frequence * angle + h.phase);
    return rayonBase * facteur;
  };

  // Circuit principal. Le type définitif est posé plus bas.
  const pasAngulaire = (Math.PI * 2) / nb;
  for (let i = 0; i < nb; i++) {
    // Le tremblement reste sous la moitié du pas : l'angle est toujours
    // croissant, donc la courbe reste simple.
    const angle = i * pasAngulaire + (rng.reel() - 0.5) * pasAngulaire * 0.5;
    const rayon = rayonA(angle);
    cases[`c${i}`] = {
      id: `c${i}`,
      type: "bonus",
      x: Math.cos(angle) * rayon,
      y: Math.sin(angle) * rayon,
      suivantes: [`c${(i + 1) % nb}`],
    };
  }

  // Raccourcis. On choisit des départs distincts et des arrivées valides, sans
  // jamais toucher le départ (c0) : ainsi les raccourcis sont toujours posés,
  // et le total de cases reste exact.
  const departsPossibles = rng.melanger(Array.from({ length: nb - 1 }, (_, i) => i + 1));
  for (let k = 0; k < nbRaccourcis; k++) {
    const depart = departsPossibles[k];
    let arrivee = (depart + Math.floor(nb / 2) + rng.entier(-2, 2) + nb) % nb;
    while (arrivee === 0 || arrivee === depart) arrivee = (arrivee + 1) % nb;

    const idDepart = `c${depart}`;
    const idArrivee = `c${arrivee}`;
    const a = cases[idDepart];
    const b = cases[idArrivee];

    // Point de contrôle décalé du centre, sinon tous les raccourcis se
    // superposent.
    const cx = (rng.reel() - 0.5) * rayonBase * 0.5;
    const cy = (rng.reel() - 0.5) * rayonBase * 0.5;

    const longueur = longueurs[k];
    const ids: string[] = [];
    for (let i = 1; i <= longueur; i++) {
      const t = i / (longueur + 1);
      const u = 1 - t;
      const id = `r${k}_${i}`;
      ids.push(id);
      cases[id] = {
        id,
        type: "bonus",
        x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
        y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
        suivantes: [],
      };
    }
    for (let i = 0; i < ids.length; i++) {
      cases[ids[i]].suivantes = [i + 1 < ids.length ? ids[i + 1] : idArrivee];
    }
    a.suivantes = [...a.suivantes, ids[0]];
  }

  // --- Types de cases, par effectifs exacts (jamais par tirage pondéré) ---

  cases.c0.type = "depart";
  const jouables = Object.keys(cases).filter((id) => id !== "c0");

  // Un chemin non-malus garanti à chaque croisement. On réserve, pour chaque
  // case-carrefour, l'une de ses cases-filles : elle ne recevra pas de malus.
  // C'est ce qui empêche un embranchement d'être un mur de malus.
  const reservesSansMalus = new Set<string>();
  for (const c of Object.values(cases)) {
    if (c.suivantes.length > 1) {
      // On réserve la première fille (souvent la continuation du circuit) :
      // le chemin « sûr » existe, le raccourci peut rester piégeux.
      const fille = c.suivantes.find((s) => s !== "c0") ?? c.suivantes[0];
      reservesSansMalus.add(fille);
    }
  }

  // Les malus tombent hors des cases réservées, choisis au hasard.
  const eligiblesMalus = rng.melanger(jouables.filter((id) => !reservesSansMalus.has(id)));
  const malusIds = new Set(eligiblesMalus.slice(0, effectifs.malus));

  const poser = (id: string, type: TypeCase) => {
    cases[id].type = type;
  };
  for (const id of malusIds) poser(id, "malus");

  // Le reste des types, mélangé, sur les cases restantes.
  const autresTypes: TypeCase[] = [];
  const compte = { ...effectifs, malus: 0 };
  for (const [type, n] of Object.entries(compte) as [Exclude<TypeCase, "depart">, number][]) {
    for (let i = 0; i < n; i++) autresTypes.push(type);
  }
  const autresTypesMelanges = rng.melanger(autresTypes);
  const autresIds = jouables.filter((id) => !malusIds.has(id));
  autresIds.forEach((id, i) => poser(id, autresTypesMelanges[i]));

  const xs = Object.values(cases).map((c) => c.x);
  const ys = Object.values(cases).map((c) => c.y);
  const marge = 60;

  return {
    graine,
    cases,
    depart: "c0",
    limites: {
      minX: Math.min(...xs) - marge,
      minY: Math.min(...ys) - marge,
      maxX: Math.max(...xs) + marge,
      maxY: Math.max(...ys) + marge,
    },
  };
}
