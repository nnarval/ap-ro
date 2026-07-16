import { EFFECTIFS_FIXES, PARTS_MAJORITAIRES, REGLAGES } from "./config";
import { creerRng } from "./rng";
import type { Case, Plateau, TypeCase } from "./types";

/**
 * Répartit `total` unités entre des parts, à la plus forte décimale.
 * Le total est respecté exactement, sans dérive d'arrondi.
 */
function repartir<K extends string>(total: number, parts: Record<K, number>): Record<K, number> {
  const sommeParts = Object.values<number>(parts).reduce((a, b) => a + b, 0);
  const exacts = (Object.entries(parts) as [K, number][]).map(([cle, p]) => ({
    cle,
    exact: (total * p) / sommeParts,
  }));

  const resultat = {} as Record<K, number>;
  let attribue = 0;
  for (const { cle, exact } of exacts) {
    resultat[cle] = Math.floor(exact);
    attribue += resultat[cle];
  }

  const parDecimale = [...exacts].sort(
    (a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)),
  );
  for (let i = 0; attribue < total; i++, attribue++) {
    resultat[parDecimale[i % parDecimale.length].cle]++;
  }
  return resultat;
}

/**
 * Génère un plateau complet à partir d'une graine.
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
 */
export function genererPlateau(graine: number): Plateau {
  const rng = creerRng(graine);
  const cases: Record<string, Case> = {};

  const nb = rng.entier(REGLAGES.casesMin, REGLAGES.casesMax);
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

  // Raccourcis : d'une case du circuit vers une case à peu près opposée.
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
    // superposent.
    const cx = (rng.reel() - 0.5) * rayonBase * 0.5;
    const cy = (rng.reel() - 0.5) * rayonBase * 0.5;

    const longueur = rng.entier(3, 5);
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

  // --- Types de cases, par effectifs et non par tirage pondéré ---

  const assignees = new Set<string>(["c0"]);
  cases.c0.type = "depart";

  // Emplacements d'étoile, répartis régulièrement : sur une partie de 20
  // minutes, courir une demi-boucle derrière une étoile, c'est déjà trop long.
  const nbEtoiles = rng.entier(
    EFFECTIFS_FIXES.emplacementsEtoile.min,
    EFFECTIFS_FIXES.emplacementsEtoile.max,
  );
  const emplacementsEtoile: string[] = [];
  const ecart = nb / nbEtoiles;
  for (let i = 0; i < nbEtoiles; i++) {
    const brut = Math.round(i * ecart + rng.entier(-1, 1));
    let index = ((brut % nb) + nb) % nb;
    // Tous les pions démarrent sur le départ : une étoile posée là serait
    // cueillie au premier tour sans que personne l'ait cherchée.
    if (index === 0) index = 1;
    const id = `c${index}`;
    if (!assignees.has(id)) {
      assignees.add(id);
      emplacementsEtoile.push(id);
      cases[id].type = "etoile";
    }
  }

  const restant = rng.melanger(Object.keys(cases).filter((id) => !assignees.has(id)));

  const nbEvenement = Math.min(
    rng.entier(EFFECTIFS_FIXES.evenement.min, EFFECTIFS_FIXES.evenement.max),
    restant.length,
  );
  const nbBoutique = Math.min(
    rng.entier(EFFECTIFS_FIXES.boutique.min, EFFECTIFS_FIXES.boutique.max),
    restant.length - nbEvenement,
  );

  // Tout ce qui reste va aux trois types majoritaires.
  const majoritaires = repartir(restant.length - nbEvenement - nbBoutique, PARTS_MAJORITAIRES);

  // Le raccourci doit se payer : plus court ET sans risque, ce serait toujours
  // le bon choix. On y concentre donc des malus — mais seulement la moitié du
  // budget. Les y envoyer tous les épuiserait : le circuit principal se
  // retrouverait sans un seul malus, et qui ne prend jamais de raccourci n'en
  // rencontrerait jamais.
  const idsRaccourcis = restant.filter((id) => id.startsWith("r"));
  const idsCircuit = restant.filter((id) => !id.startsWith("r"));
  const parPrioriteMalus = [
    ...idsRaccourcis.slice(0, Math.min(Math.ceil(majoritaires.malus / 2), idsRaccourcis.length)),
    ...idsCircuit,
    ...idsRaccourcis,
  ];

  const poser = (id: string, type: TypeCase) => {
    cases[id].type = type;
    assignees.add(id);
  };

  for (const id of parPrioriteMalus) {
    if (majoritaires.malus === 0) break;
    // La liste cite les raccourcis deux fois (priorité, puis repli) : sans
    // cette garde, une même case consommerait deux fois le budget.
    if (assignees.has(id)) continue;
    poser(id, "malus");
    majoritaires.malus--;
  }

  const reste = restant.filter((id) => !assignees.has(id));
  const aServir: [TypeCase, number][] = [
    ["evenement", nbEvenement],
    ["boutique", nbBoutique],
    ["defi", majoritaires.defi],
    ["bonus", majoritaires.bonus],
  ];
  let curseur = 0;
  for (const [type, combien] of aServir) {
    for (let i = 0; i < combien && curseur < reste.length; i++, curseur++) {
      poser(reste[curseur], type);
    }
  }
  // Filet de sécurité : toute case oubliée devient un bonus.
  for (const id of reste.slice(curseur)) poser(id, "bonus");

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
