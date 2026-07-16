import { REGLAGES } from "./config";
import { genererPlateau } from "./plateau";
import { tirerEntier } from "./rng";
import type { Action, EntreeJournal, EtatPartie, Pion, Plateau } from "./types";

export const COULEURS_PIONS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316",
] as const;

export interface DefinitionPion {
  nom: string;
  membres: string[];
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
  const libres = plateau.emplacementsEtoile.filter(
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
  // n'en porte : le surplus disparaît, sinon on en donnerait plus que dix.
  if (liste.length > cible) liste = liste.slice(0, cible);

  return [liste, rng];
}

export function creerPartie(graine: number, definitions: DefinitionPion[]): EtatPartie {
  if (definitions.length < REGLAGES.pionsMin || definitions.length > REGLAGES.pionsMax) {
    throw new Error(
      `Il faut entre ${REGLAGES.pionsMin} et ${REGLAGES.pionsMax} pions, reçu ${definitions.length}.`,
    );
  }

  const plateau = genererPlateau(graine);
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
    REGLAGES.etoilesParPartie,
    (graine ^ 0x9e3779b9) >>> 0,
  );

  return {
    plateau,
    pions,
    ordreTour: pions.map((p) => p.id),
    indexTour: 0,
    manche: 1,
    phase: "lancer",
    de: null,
    pasRestants: 0,
    choix: [],
    adversaireId: null,
    etoilesSur,
    etoilesRestantes: REGLAGES.etoilesParPartie,
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

/**
 * Donne une étoile à un pion et remet le plateau d'aplomb.
 * `retiree` est l'emplacement d'où l'étoile a été prise, s'il y en a un — une
 * étoile gagnée en défi ne vient pas du plateau.
 */
function donnerEtoile(
  etat: EtatPartie,
  pionId: string,
  coutPieces: number,
  retiree: string | null,
): EtatPartie {
  const pions = majPion(etat, pionId, {
    etoiles: etat.pions.find((p) => p.id === pionId)!.etoiles + 1,
    pieces: etat.pions.find((p) => p.id === pionId)!.pieces - coutPieces,
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

  return { ...etat, pions, etoilesRestantes, etoilesSur, rng };
}

/** Fin de tour, ou fin de partie s'il n'y a plus d'étoile à distribuer. */
function suite(etat: EtatPartie): EtatPartie["phase"] {
  return etat.etoilesRestantes > 0 ? "finTour" : "terminee";
}

/** Déplace le pion actif d'une case, en gérant le passage par le départ. */
function avancerSur(etat: EtatPartie, caseId: string): EtatPartie {
  const pion = pionActif(etat);
  const passeParDepart = caseId === etat.plateau.depart;
  const pieces = pion.pieces + (passeParDepart ? REGLAGES.gainTourComplet : 0);
  const pasRestants = etat.pasRestants - 1;

  return {
    ...etat,
    pions: majPionActif(etat, { caseId, pieces }),
    pasRestants,
    choix: [],
    phase: pasRestants > 0 ? "deplacement" : "resolution",
    journal: passeParDepart
      ? noter(etat, `passe par le départ, +${REGLAGES.gainTourComplet} pièces`)
      : etat.journal,
  };
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
        journal: noter(etat, `fait ${de}`),
      };
    }

    case "AVANCER": {
      if (etat.phase !== "deplacement" || etat.pasRestants <= 0) return etat;
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
      const caseCourante = etat.plateau.cases[pion.caseId];

      switch (caseCourante.type) {
        case "bonus": {
          const [gain, rng] = tirerEntier(etat.rng, REGLAGES.gainBonusMin, REGLAGES.gainBonusMax);
          return {
            ...etat,
            rng,
            pions: majPionActif(etat, { pieces: pion.pieces + gain }),
            phase: "finTour",
            journal: noter(etat, `case bonus, +${gain} pièces`),
          };
        }

        case "malus":
          return { ...etat, phase: "choixMalus" };

        case "defi":
          return { ...etat, phase: "choixAdversaire" };

        case "boutique":
          return { ...etat, phase: "boutique" };

        case "etoile": {
          if (!etat.etoilesSur.includes(caseCourante.id)) {
            return {
              ...etat,
              phase: "finTour",
              journal: noter(etat, "emplacement d'étoile, mais elle est ailleurs"),
            };
          }
          // Celle-ci se trouve, elle ne s'achète pas : la boutique est l'autre
          // source, payante.
          const apres = donnerEtoile(etat, pion.id, 0, caseCourante.id);
          return {
            ...apres,
            phase: suite(apres),
            journal: noter(etat, "trouve une étoile !"),
          };
        }

        // Le contenu vient plus tard.
        case "evenement":
          return { ...etat, phase: "finTour", journal: noter(etat, "case événement (à venir)") };

        default:
          return { ...etat, phase: "finTour" };
      }
    }

    case "CHOISIR_MALUS": {
      if (etat.phase !== "choixMalus") return etat;
      const pion = pionActif(etat);
      if (action.gage) {
        return { ...etat, phase: "finTour", journal: noter(etat, "préfère le gage") };
      }
      return {
        ...etat,
        pions: majPionActif(etat, { pieces: Math.max(0, pion.pieces - REGLAGES.perteMalus) }),
        phase: "finTour",
        journal: noter(etat, `lâche ${REGLAGES.perteMalus} pièces`),
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
        journal: noter(etat, `achète une étoile pour ${REGLAGES.prixEtoileBoutique} pièces`),
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

    case "CHOISIR_ADVERSAIRE": {
      if (etat.phase !== "choixAdversaire") return etat;
      const actif = pionActif(etat);
      if (action.pionId === actif.id || !etat.pions.some((p) => p.id === action.pionId)) {
        return etat;
      }
      const defie = etat.pions.find((p) => p.id === action.pionId)!;
      return {
        ...etat,
        adversaireId: action.pionId,
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
        phase: "finTour",
        journal: noter(
          etat,
          `${vainqueur.nom} remporte le duel, +${REGLAGES.gainDefiDuel} pièces`,
        ),
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

    case "FIN_TOUR": {
      if (etat.phase !== "finTour") return etat;
      const indexTour = (etat.indexTour + 1) % etat.ordreTour.length;

      // Le placement d'une étoile peut échouer quand tous les emplacements sont
      // occupés. Les pions ayant bougé depuis, on retente ici : sans ça le
      // plateau resterait à court d'étoiles jusqu'au prochain ramassage.
      const [etoilesSur, rng] = regarnirEtoiles(
        etat.plateau,
        etat.pions,
        etat.etoilesSur,
        etat.etoilesRestantes,
        etat.rng,
      );

      // Tour de table bouclé : la manche se termine par le défi collectif.
      return {
        ...etat,
        indexTour,
        etoilesSur,
        rng,
        phase: indexTour === 0 ? "defiCollectif" : "lancer",
        de: null,
        pasRestants: 0,
        choix: [],
      };
    }

    case "RESOUDRE_DEFI_COLLECTIF": {
      if (etat.phase !== "defiCollectif") return etat;
      const vainqueur = etat.pions.find((p) => p.id === action.vainqueurId);
      if (!vainqueur) return etat;

      // C'est ici que les étoiles arrivent vraiment : le plateau seul n'en
      // fournit qu'environ une par partie (voir equilibrage.test.ts).
      const apres = donnerEtoile(etat, vainqueur.id, 0, null);
      return {
        ...apres,
        manche: etat.manche + 1,
        indexTour: 0,
        de: null,
        pasRestants: 0,
        phase: apres.etoilesRestantes > 0 ? "lancer" : "terminee",
        journal: noter(etat, `remporte le défi de fin de manche et une étoile`, vainqueur.id),
      };
    }

    default:
      return etat;
  }
}

/** Classement final, du plus d'étoiles au moins. Les pièces départagent. */
export function classement(etat: EtatPartie): Pion[] {
  return [...etat.pions].sort((a, b) => b.etoiles - a.etoiles || b.pieces - a.pieces);
}
