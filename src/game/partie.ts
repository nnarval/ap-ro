import { REGLAGES } from "./config";
import { tirerDefi, type Ambiance, type CartePerso, type ModeJeu } from "./defis";
import { genererPlateau } from "./plateau";
import { tirer, tirerEntier } from "./rng";
import type { Action, EntreeJournal, EtatPartie, Pion, Plateau } from "./types";

export const COULEURS_PIONS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316",
] as const;

/** Nommées d'après leur couleur : à l'apéro, personne ne retient « équipe 3 ». */
export const NOMS_EQUIPES = [
  "Les Rouges",
  "Les Bleus",
  "Les Verts",
  "Les Jaunes",
  "Les Violets",
  "Les Oranges",
] as const;

export interface DefinitionPion {
  nom: string;
  membres: string[];
}

export interface OptionsPartie {
  mode?: ModeJeu;
  ambiance?: Ambiance;
  objectif?: number;
  cartesPerso?: CartePerso[];
}

/** Les cases qui peuvent accueillir une étoile : toutes, sauf le départ. */
function hotesEtoile(plateau: Plateau): string[] {
  return Object.keys(plateau.cases).filter((id) => id !== plateau.depart);
}

/**
 * Tire un emplacement pour une étoile qui apparaît.
 *
 * On écarte les emplacements déjà pris par une autre étoile, et surtout ceux où
 * un pion se trouve : sinon l'étoile retomberait sous les pieds de quelqu'un —
 * à commencer par celui qui vient de la ramasser — et il l'encaisserait au tour
 * suivant sans avoir rien fait.
 */
function tirerEmplacementEtoile(
  plateau: Plateau,
  pions: readonly Pion[],
  dejaPrises: readonly string[],
  interdits: readonly string[],
  rng: number,
): [emplacement: string | null, rng: number] {
  const occupees = new Set(pions.map((p) => p.caseId));
  const libres = hotesEtoile(plateau).filter(
    (id) => !dejaPrises.includes(id) && !interdits.includes(id),
  );
  const candidats = libres.filter((id) => !occupees.has(id));

  // Repli : si tous les emplacements libres ont un pion dessus, mieux vaut une
  // étoile mal placée qu'un plateau qui n'en a plus. Les `interdits`, eux, le
  // restent — c'est ce qui empêche l'étoile de retomber sur la case que le
  // ramasseur occupe encore.
  const liste = candidats.length > 0 ? candidats : libres;
  if (liste.length === 0) return [null, rng];

  const [i, suivant] = tirerEntier(rng, 0, liste.length - 1);
  return [liste[i], suivant];
}

/** Ramène le plateau au bon nombre d'étoiles, sans dépasser le stock restant. */
function regarnirEtoiles(
  plateau: Plateau,
  pions: readonly Pion[],
  etoilesSur: readonly string[],
  restantes: number,
  rng: number,
  interdits: readonly string[] = [],
): [string[], number] {
  const cible = Math.min(REGLAGES.etoilesSurPlateau, restantes);
  let liste = [...etoilesSur];

  while (liste.length < cible) {
    const [emplacement, suivant] = tirerEmplacementEtoile(plateau, pions, liste, interdits, rng);
    rng = suivant;
    if (!emplacement) break;
    liste.push(emplacement);
  }
  // En fin de partie il peut rester moins d'étoiles à distribuer que le plateau
  // n'en porte : le surplus disparaît, sinon on en donnerait plus que l'objectif.
  if (liste.length > cible) liste = liste.slice(0, cible);

  return [liste, rng];
}

export function creerPartie(
  graine: number,
  definitions: DefinitionPion[],
  options: OptionsPartie = {},
): EtatPartie {
  if (definitions.length < REGLAGES.pionsMin || definitions.length > REGLAGES.pionsMax) {
    throw new Error(
      `Il faut entre ${REGLAGES.pionsMin} et ${REGLAGES.pionsMax} pions, reçu ${definitions.length}.`,
    );
  }

  const mode = options.mode ?? "multi";
  const ambiance = options.ambiance ?? "classique";
  const objectif = options.objectif ?? REGLAGES.objectifParDefaut;
  const cartesPerso = options.cartesPerso ?? [];

  const plateau = genererPlateau(graine, ambiance);
  const pions: Pion[] = definitions.map((d, i) => ({
    id: `p${i}`,
    nom: d.nom,
    couleur: COULEURS_PIONS[i % COULEURS_PIONS.length],
    membres: d.membres,
    caseId: plateau.depart,
    pieces: REGLAGES.piecesDepart,
    etoiles: 0,
    gorgees: 0,
  }));

  // Décalé par rapport à la graine du plateau, sinon les premiers jets de dé
  // seraient corrélés à la forme du circuit.
  const [etoilesSur, rng] = regarnirEtoiles(
    plateau,
    pions,
    [],
    objectif,
    (graine ^ 0x9e3779b9) >>> 0,
  );

  return {
    plateau,
    pions,
    ordreTour: pions.map((p) => p.id),
    indexTour: 0,
    manche: 1,
    phase: "lancer",
    mode,
    ambiance,
    cartesPerso,
    de: null,
    pasRestants: 0,
    choix: [],
    adversaireId: null,
    defiId: null,
    etoilesSur,
    etoilesRestantes: objectif,
    objectifEtoiles: objectif,
    dernierSautEtoile: null,
    gainBonus: null,
    equipeShot: null,
    evenementTexte: null,
    sourceDefi: null,
    equipeCreatriceId: null,
    rng,
    journal: [],
  };
}

export function pionActif(etat: EtatPartie): Pion {
  const id = etat.ordreTour[etat.indexTour];
  const pion = etat.pions.find((p) => p.id === id);
  if (!pion) throw new Error(`Pion actif introuvable : ${id}`);
  return pion;
}

function noter(etat: EtatPartie, texte: string, pionId?: string): EntreeJournal[] {
  return [...etat.journal, { manche: etat.manche, pionId: pionId ?? pionActif(etat).id, texte }];
}

function majPion(etat: EtatPartie, id: string, patch: Partial<Pion>): Pion[] {
  return etat.pions.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

function majPionActif(etat: EtatPartie, patch: Partial<Pion>): Pion[] {
  return majPion(etat, etat.ordreTour[etat.indexTour], patch);
}

/** Tire une carte de la catégorie voulue, en tenant compte de l'ambiance et des
 *  cartes perso. */
function tirerCarte(etat: EtatPartie, categorie: Parameters<typeof tirerDefi>[0]) {
  return tirerDefi(categorie, etat.ambiance, etat.mode, etat.cartesPerso, etat.rng);
}

/**
 * Donne une étoile à un pion et remet le plateau d'aplomb.
 * `retiree` est l'emplacement d'où l'étoile a été prise, s'il y en a un — une
 * étoile gagnée en défi ou achetée ne vient pas du plateau. Quand elle vient du
 * plateau, on note le saut pour l'animer à l'écran.
 */
function donnerEtoile(
  etat: EtatPartie,
  pionId: string,
  coutPieces: number,
  retiree: string | null,
): EtatPartie {
  const beneficiaire = etat.pions.find((p) => p.id === pionId)!;
  const pions = majPion(etat, pionId, {
    etoiles: beneficiaire.etoiles + 1,
    pieces: beneficiaire.pieces - coutPieces,
  });
  const etoilesRestantes = etat.etoilesRestantes - 1;
  const apresRetrait = retiree ? etat.etoilesSur.filter((id) => id !== retiree) : etat.etoilesSur;
  const [etoilesSur, rng] = regarnirEtoiles(
    etat.plateau,
    pions,
    apresRetrait,
    etoilesRestantes,
    etat.rng,
    // Même en dernier recours, l'étoile ne revient pas là où elle vient
    // d'être prise : le ramasseur est encore dessus.
    retiree ? [retiree] : [],
  );

  // Le saut n'a de sens que pour une étoile ramassée sur le plateau.
  const nouvelle = etoilesSur.find((id) => !apresRetrait.includes(id));
  const dernierSautEtoile =
    retiree && nouvelle ? { de: retiree, vers: nouvelle } : etat.dernierSautEtoile;

  return { ...etat, pions, etoilesRestantes, etoilesSur, rng, dernierSautEtoile };
}

/** Fin de tour, ou fin de partie s'il n'y a plus d'étoile à distribuer. */
function suite(etat: EtatPartie): EtatPartie["phase"] {
  return etat.etoilesRestantes > 0 ? "finTour" : "terminee";
}

/** Les pions présents sur la case du pion actif, lui compris. */
export function pionsSurCaseActive(etat: EtatPartie): Pion[] {
  const actif = pionActif(etat);
  return etat.pions.filter((p) => p.caseId === actif.caseId);
}

/** Déplace le pion actif d'une case, en gérant le passage par le départ. */
function avancerSur(etat: EtatPartie, caseId: string): EtatPartie {
  const pion = pionActif(etat);
  const passeParDepart = caseId === etat.plateau.depart;
  const pieces = pion.pieces + (passeParDepart ? REGLAGES.gainTourComplet : 0);
  const pasRestants = etat.pasRestants - 1;
  const pions = majPionActif(etat, { caseId, pieces });
  const journal = passeParDepart
    ? noter(etat, `passe par le départ, +${REGLAGES.gainTourComplet} pièces`)
    : etat.journal;

  const enChemin = { ...etat, pions, pasRestants, choix: [], journal };
  if (pasRestants > 0) return { ...enChemin, phase: "deplacement" };

  // Atterrissage sur une case déjà occupée : réflexe avant que la case ne
  // produise son effet.
  const dejaLa = pions.some((p) => p.id !== pion.id && p.caseId === caseId);
  if (dejaLa) {
    const [defiId, rng] = tirerCarte(enChemin, "reflexe");
    return { ...enChemin, phase: "reflexe", defiId, rng };
  }
  return { ...enChemin, phase: "resolution" };
}

/**
 * Applique une action à l'état. Fonction pure : même état + même action = même
 * résultat, sur n'importe quel appareil.
 *
 * Une action qui ne correspond pas à la phase courante est ignorée plutôt que
 * de lever une erreur — en multi, deux téléphones peuvent envoyer la même
 * action en même temps, et ce n'est pas un cas d'erreur.
 */
export function reduire(etat: EtatPartie, action: Action): EtatPartie {
  switch (action.type) {
    case "LANCER_DE": {
      if (etat.phase !== "lancer") return etat;
      const [de, rng] = tirerEntier(etat.rng, REGLAGES.deMin, REGLAGES.deMax);
      return {
        ...etat,
        de,
        rng,
        pasRestants: de,
        phase: "deplacement",
        dernierSautEtoile: null,
        journal: noter(etat, `fait ${de}`),
      };
    }

    case "AVANCER": {
      if (etat.phase !== "deplacement" || etat.pasRestants <= 0) return etat;
      // Le pas a déjà été fait par le message d'un autre téléphone : on ignore
      // le doublon plutôt que d'avancer une seconde fois.
      if (action.pasRestants !== etat.pasRestants) return etat;
      const courante = etat.plateau.cases[pionActif(etat).caseId];
      if (courante.suivantes.length > 1) {
        return { ...etat, phase: "croisement", choix: courante.suivantes };
      }
      return avancerSur(etat, courante.suivantes[0]);
    }

    case "CHOISIR_CHEMIN": {
      if (etat.phase !== "croisement" || !etat.choix.includes(action.caseId)) return etat;
      return avancerSur(etat, action.caseId);
    }

    case "RESOUDRE_CASE": {
      if (etat.phase !== "resolution") return etat;
      const pion = pionActif(etat);

      // Étoile greffée sur la case : on la ramasse d'abord, elle saute ailleurs.
      let base = etat;
      if (etat.etoilesSur.includes(pion.caseId)) {
        base = donnerEtoile(etat, pion.id, 0, pion.caseId);
        base = { ...base, journal: noter(base, "trouve une étoile !") };
        if (base.etoilesRestantes <= 0) return { ...base, phase: "terminee" };
      }

      const caseCourante = base.plateau.cases[pion.caseId];
      switch (caseCourante.type) {
        case "bonus": {
          const [gain, rng] = tirerEntier(base.rng, REGLAGES.gainBonusMin, REGLAGES.gainBonusMax);
          return {
            ...base,
            rng,
            pions: majPionActif(base, { pieces: pionActif(base).pieces + gain }),
            gainBonus: gain,
            phase: "bonus",
            journal: noter(base, `case bonus, +${gain} pièces`),
          };
        }

        case "malus": {
          // Le malus révèle une carte : un gage à boire, ou un refus payant.
          const [defiId, rng] = tirerCarte(base, "malus");
          return { ...base, defiId, rng, phase: "choixMalus" };
        }

        case "defi":
          return { ...base, phase: "choixAdversaire" };

        case "boutique":
          return { ...base, phase: "boutique" };

        case "roulette": {
          // La roue des couleurs : une équipe est tirée, elle boira le shot.
          const [i, rng] = tirerEntier(base.rng, 0, base.pions.length - 1);
          const designe = base.pions[i];
          return {
            ...base,
            rng,
            equipeShot: designe.id,
            phase: "roulette",
            journal: noter(base, `roulette à shot : ${designe.nom} boit`, designe.id),
          };
        }

        case "evenement":
          return evenement(base);

        default:
          return { ...base, phase: "finTour" };
      }
    }

    case "CHOISIR_MALUS": {
      if (etat.phase !== "choixMalus") return etat;
      const pion = pionActif(etat);
      if (action.gage) {
        return { ...etat, defiId: null, phase: "finTour", journal: noter(etat, "relève le gage") };
      }
      return {
        ...etat,
        pions: majPionActif(etat, { pieces: Math.max(0, pion.pieces - REGLAGES.perteMalus) }),
        defiId: null,
        phase: "finTour",
        journal: noter(etat, `refuse et lâche ${REGLAGES.perteMalus} pièces`),
      };
    }

    case "ACHETER_ETOILE": {
      if (etat.phase !== "boutique") return etat;
      const pion = pionActif(etat);
      if (pion.pieces < REGLAGES.prixEtoileBoutique) return etat;

      const apres = donnerEtoile(etat, pion.id, REGLAGES.prixEtoileBoutique, null);
      return {
        ...apres,
        phase: suite(apres),
        journal: noter(apres, `achète une étoile pour ${REGLAGES.prixEtoileBoutique} pièces`),
      };
    }

    case "ACHETER_GORGEES": {
      if (etat.phase !== "boutique") return etat;
      const pion = pionActif(etat);
      const cout = action.nombre * REGLAGES.prixGorgee;
      if (action.nombre <= 0 || pion.pieces < cout) return etat;

      return {
        ...etat,
        pions: majPionActif(etat, {
          pieces: pion.pieces - cout,
          gorgees: pion.gorgees + action.nombre,
        }),
        journal: noter(etat, `achète ${action.nombre} gorgées à distribuer`),
      };
    }

    case "QUITTER_BOUTIQUE": {
      if (etat.phase !== "boutique") return etat;
      return { ...etat, phase: "finTour" };
    }

    case "RESOUDRE_REFLEXE": {
      if (etat.phase !== "reflexe") return etat;
      const participants = pionsSurCaseActive(etat);
      const vainqueur = participants.find((p) => p.id === action.vainqueurId);
      if (!vainqueur) return etat;

      const perdants = participants.filter((p) => p.id !== vainqueur.id);
      // Les gorgées bues ne sont pas de l'état de jeu : on les annonce, les
      // joueurs boivent. Seules les gorgées achetées en boutique se stockent.
      return {
        ...etat,
        defiId: null,
        phase: "resolution",
        journal: noter(
          etat,
          `${vainqueur.nom} gagne le réflexe — ${perdants
            .map((p) => p.nom)
            .join(", ")} boivent ${REGLAGES.gorgeesPerdantReflexe} gorgées`,
          vainqueur.id,
        ),
      };
    }

    case "CHOISIR_ADVERSAIRE": {
      if (etat.phase !== "choixAdversaire") return etat;
      const actif = pionActif(etat);
      if (action.pionId === actif.id || !etat.pions.some((p) => p.id === action.pionId)) {
        return etat;
      }
      const defie = etat.pions.find((p) => p.id === action.pionId)!;
      // Le défi n'est révélé qu'une fois l'adversaire choisi : sinon on
      // choisirait sa victime en fonction de l'épreuve.
      const [defiId, rng] = tirerCarte(etat, "duel");
      return {
        ...etat,
        adversaireId: action.pionId,
        defiId,
        rng,
        phase: "defiDuel",
        journal: noter(etat, `défie ${defie.nom}`),
      };
    }

    case "RESOUDRE_DEFI": {
      if (etat.phase !== "defiDuel") return etat;
      const actif = pionActif(etat);
      // Seuls les deux duellistes peuvent gagner le duel.
      if (action.vainqueurId !== actif.id && action.vainqueurId !== etat.adversaireId) return etat;

      const vainqueur = etat.pions.find((p) => p.id === action.vainqueurId)!;
      return {
        ...etat,
        pions: majPion(etat, action.vainqueurId, {
          pieces: vainqueur.pieces + REGLAGES.gainDefiDuel,
        }),
        adversaireId: null,
        defiId: null,
        phase: "finTour",
        journal: noter(etat, `${vainqueur.nom} remporte le duel, +${REGLAGES.gainDefiDuel} pièces`),
      };
    }

    case "DONNER_GORGEE": {
      // Les gorgées se distribuent quand on veut, sauf une fois la partie finie.
      if (etat.phase === "terminee") return etat;
      const donneur = etat.pions.find((p) => p.id === action.donneurId);
      const receveur = etat.pions.find((p) => p.id === action.receveurId);
      if (!donneur || !receveur || donneur.gorgees <= 0) return etat;

      return {
        ...etat,
        pions: majPion(etat, donneur.id, { gorgees: donneur.gorgees - 1 }),
        journal: noter(etat, `offre une gorgée à ${receveur.nom}`, donneur.id),
      };
    }

    case "CONTINUER": {
      // Ferme l'annonce d'un bonus, d'un événement ou d'une roulette.
      if (etat.phase !== "evenement" && etat.phase !== "roulette" && etat.phase !== "bonus") {
        return etat;
      }
      return { ...etat, phase: "finTour", equipeShot: null, evenementTexte: null, gainBonus: null };
    }

    case "FIN_TOUR": {
      if (etat.phase !== "finTour") return etat;
      const indexTour = (etat.indexTour + 1) % etat.ordreTour.length;

      // Le placement d'une étoile peut échouer quand tous les emplacements sont
      // occupés. Les pions ayant bougé depuis, on retente ici.
      const [etoilesSur, rng] = regarnirEtoiles(
        etat.plateau,
        etat.pions,
        etat.etoilesSur,
        etat.etoilesRestantes,
        etat.rng,
      );

      const finDeManche = indexTour === 0;
      return {
        ...etat,
        indexTour,
        etoilesSur,
        rng,
        defiId: null,
        dernierSautEtoile: null,
        equipeShot: null,
        evenementTexte: null,
        gainBonus: null,
        // Tour de table bouclé : la manche se termine par la roue à défis.
        phase: finDeManche ? "roueManche" : "lancer",
        de: null,
        pasRestants: 0,
        choix: [],
      };
    }

    case "LANCER_ROUE_MANCHE": {
      if (etat.phase !== "roueManche") return etat;
      // Côté « une équipe crée le défi » ou côté « carte de Claude », 50/50.
      const [cote, rng1] = tirer(etat.rng);
      if (cote < 0.5) {
        const [defiId, rng2] = tirerDefi("collectif", etat.ambiance, etat.mode, etat.cartesPerso, rng1);
        return {
          ...etat,
          rng: rng2,
          sourceDefi: "claude",
          equipeCreatriceId: null,
          defiId,
          phase: "defiCollectif",
        };
      }
      const [i, rng2] = tirerEntier(rng1, 0, etat.pions.length - 1);
      const equipe = etat.pions[i];
      return {
        ...etat,
        rng: rng2,
        sourceDefi: "equipe",
        equipeCreatriceId: equipe.id,
        defiId: null,
        phase: "defiCollectif",
        journal: noter(etat, `${equipe.nom} inventent le défi de fin de manche`, equipe.id),
      };
    }

    case "RESOUDRE_DEFI_COLLECTIF": {
      if (etat.phase !== "defiCollectif") return etat;
      const vainqueur = etat.pions.find((p) => p.id === action.vainqueurId);
      if (!vainqueur) return etat;

      // La fin de manche garantit une étoile : le plateau seul n'en fournit
      // qu'une poignée par partie.
      const apres = donnerEtoile(etat, vainqueur.id, 0, null);
      return {
        ...apres,
        manche: etat.manche + 1,
        indexTour: 0,
        de: null,
        pasRestants: 0,
        defiId: null,
        sourceDefi: null,
        equipeCreatriceId: null,
        dernierSautEtoile: null,
        phase: apres.etoilesRestantes > 0 ? "lancer" : "terminee",
        journal: noter(etat, "remporte le défi de fin de manche et une étoile", vainqueur.id),
      };
    }

    default:
      return etat;
  }
}

/**
 * Case événement : un effet surprise pour l'équipe active. Tiré au sort, appliqué
 * aussitôt, puis annoncé (phase "evenement"). L'équipe ferme avec CONTINUER.
 */
function evenement(etat: EtatPartie): EtatPartie {
  const actif = pionActif(etat);
  const [i, rng] = tirerEntier(etat.rng, 0, 5);
  const base = { ...etat, rng };

  switch (i) {
    case 0: {
      const texte = "Cagnotte surprise : +5 pièces.";
      return annoncerEvenement(
        { ...base, pions: majPionActif(base, { pieces: actif.pieces + 5 }) },
        texte,
      );
    }
    case 1: {
      const texte = "Contrôle surprise : −4 pièces.";
      return annoncerEvenement(
        { ...base, pions: majPionActif(base, { pieces: Math.max(0, actif.pieces - 4) }) },
        texte,
      );
    }
    case 2: {
      const texte = "Tournée offerte : +2 gorgées à distribuer.";
      return annoncerEvenement(
        { ...base, pions: majPionActif(base, { gorgees: actif.gorgees + 2 }) },
        texte,
      );
    }
    case 3: {
      const texte = `Coup de moins bien : ${actif.nom} boivent 3 gorgées.`;
      return annoncerEvenement(base, texte);
    }
    case 4: {
      // Racket : on prend 3 pièces à l'équipe la plus riche (hors soi).
      const victimes = base.pions.filter((p) => p.id !== actif.id);
      const cible = victimes.reduce((a, b) => (b.pieces > a.pieces ? b : a), victimes[0]);
      const vol = Math.min(3, cible.pieces);
      const pions = base.pions.map((p) => {
        if (p.id === cible.id) return { ...p, pieces: p.pieces - vol };
        if (p.id === actif.id) return { ...p, pieces: p.pieces + vol };
        return p;
      });
      return annoncerEvenement(
        { ...base, pions },
        `Racket : ${actif.nom} piquent ${vol} pièces à ${cible.nom}.`,
      );
    }
    default: {
      // Mini-roulette : la roue désigne une équipe qui boit un shot.
      const [j, rng2] = tirerEntier(base.rng, 0, base.pions.length - 1);
      const designe = base.pions[j];
      return annoncerEvenement(
        { ...base, rng: rng2 },
        `Mini-roulette : ${designe.nom} boivent un shot.`,
      );
    }
  }
}

function annoncerEvenement(etat: EtatPartie, texte: string): EtatPartie {
  return {
    ...etat,
    evenementTexte: texte,
    phase: "evenement",
    journal: noter(etat, `événement — ${texte}`),
  };
}

/** Classement final, du plus d'étoiles au moins. Les pièces départagent. */
export function classement(etat: EtatPartie): Pion[] {
  return [...etat.pions].sort((a, b) => b.etoiles - a.etoiles || b.pieces - a.pieces);
}
