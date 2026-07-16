import { REGLAGES } from "./config";
import { genererPlateau } from "./plateau";
import { tirerEntier } from "./rng";
import type { Action, EntreeJournal, EtatPartie, Pion } from "./types";

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
  }));

  // Décalé par rapport à la graine du plateau, sinon les premiers jets de dé
  // seraient corrélés à la forme du circuit.
  let rng = (graine ^ 0x9e3779b9) >>> 0;

  const etoilesSur: string[] = [];
  const nbInitiales = Math.min(REGLAGES.etoilesSurPlateau, REGLAGES.etoilesParPartie);
  while (etoilesSur.length < nbInitiales) {
    const libres = plateau.emplacementsEtoile.filter((id) => !etoilesSur.includes(id));
    if (libres.length === 0) break;
    const [i, suivant] = tirerEntier(rng, 0, libres.length - 1);
    rng = suivant;
    etoilesSur.push(libres[i]);
  }

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
    etoilesSur,
    prixEtoile: REGLAGES.prixEtoile,
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

function noter(etat: EtatPartie, texte: string): EntreeJournal[] {
  return [...etat.journal, { manche: etat.manche, pionId: pionActif(etat).id, texte }];
}

function majPionActif(etat: EtatPartie, patch: Partial<Pion>): Pion[] {
  const id = etat.ordreTour[etat.indexTour];
  return etat.pions.map((p) => (p.id === id ? { ...p, ...patch } : p));
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
 * Tire un emplacement pour une étoile qui réapparaît.
 *
 * On écarte les emplacements déjà occupés par une autre étoile, et surtout ceux
 * où un pion se trouve : sinon l'étoile retomberait sous les pieds de quelqu'un
 * — à commencer par celui qui vient de la ramasser — et il l'encaisserait au
 * tour suivant sans avoir rien fait.
 */
function tirerEmplacementEtoile(
  plateau: EtatPartie["plateau"],
  pions: readonly Pion[],
  dejaPrises: readonly string[],
  rng: number,
): [emplacement: string | null, rng: number] {
  const occupees = new Set(pions.map((p) => p.caseId));
  const libres = plateau.emplacementsEtoile.filter((id) => !dejaPrises.includes(id));
  const candidats = libres.filter((id) => !occupees.has(id));

  // Repli : si tous les emplacements libres ont un pion dessus, mieux vaut une
  // étoile mal placée qu'un plateau qui n'en a plus.
  const liste = candidats.length > 0 ? candidats : libres;
  if (liste.length === 0) return [null, rng];

  const [i, suivant] = tirerEntier(rng, 0, liste.length - 1);
  return [liste[i], suivant];
}

/**
 * Applique une action à l'état. Fonction pure : même état + même action =
 * même résultat, sur n'importe quel appareil.
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
        case "bonus":
          return {
            ...etat,
            pions: majPionActif(etat, { pieces: pion.pieces + REGLAGES.gainBonus }),
            phase: "finTour",
            journal: noter(etat, `case bonus, +${REGLAGES.gainBonus} pièces`),
          };

        case "grosBonus":
          return {
            ...etat,
            pions: majPionActif(etat, { pieces: pion.pieces + REGLAGES.gainGrosBonus }),
            phase: "finTour",
            journal: noter(etat, `gros bonus, +${REGLAGES.gainGrosBonus} pièces`),
          };

        case "malus":
          return {
            ...etat,
            pions: majPionActif(etat, {
              pieces: Math.max(0, pion.pieces - REGLAGES.perteMalus),
            }),
            phase: "finTour",
            journal: noter(etat, `case malus, -${REGLAGES.perteMalus} pièces`),
          };

        case "etoile": {
          if (!etat.etoilesSur.includes(caseCourante.id)) {
            return {
              ...etat,
              phase: "finTour",
              journal: noter(etat, "emplacement d'étoile, mais elle est ailleurs"),
            };
          }
          if (pion.pieces < etat.prixEtoile) {
            return {
              ...etat,
              phase: "finTour",
              journal: noter(etat, `trouve l'étoile mais n'a pas ${etat.prixEtoile} pièces`),
            };
          }
          return { ...etat, phase: "achatEtoile" };
        }

        // Ces cases déclencheront un mini-jeu ou un effet. À faire.
        case "defi":
          return { ...etat, phase: "finTour", journal: noter(etat, "case défi (à venir)") };
        case "evenement":
          return { ...etat, phase: "finTour", journal: noter(etat, "case événement (à venir)") };
        case "boutique":
          return { ...etat, phase: "finTour", journal: noter(etat, "boutique (à venir)") };

        default:
          return { ...etat, phase: "finTour" };
      }
    }

    case "ACHETER_ETOILE": {
      if (etat.phase !== "achatEtoile") return etat;
      if (!action.acheter) {
        return { ...etat, phase: "finTour", journal: noter(etat, "refuse l'étoile") };
      }

      const pion = pionActif(etat);
      const etoilesRestantes = etat.etoilesRestantes - 1;
      const pions = majPionActif(etat, {
        pieces: pion.pieces - etat.prixEtoile,
        etoiles: pion.etoiles + 1,
      });

      // L'étoile ramassée quitte le plateau, puis on regarnit jusqu'au nombre
      // voulu — sans jamais dépasser ce qu'il reste à distribuer.
      let etoilesSur = etat.etoilesSur.filter((id) => id !== pion.caseId);
      let rng = etat.rng;
      const cible = Math.min(REGLAGES.etoilesSurPlateau, etoilesRestantes);
      while (etoilesSur.length < cible) {
        const [emplacement, suivant] = tirerEmplacementEtoile(
          etat.plateau,
          pions,
          etoilesSur,
          rng,
        );
        rng = suivant;
        if (!emplacement) break;
        etoilesSur = [...etoilesSur, emplacement];
      }

      return {
        ...etat,
        pions,
        etoilesRestantes,
        etoilesSur: etoilesRestantes > 0 ? etoilesSur : [],
        prixEtoile: etat.prixEtoile + REGLAGES.inflationEtoile,
        rng,
        phase: etoilesRestantes > 0 ? "finTour" : "terminee",
        journal: noter(etat, `achète une étoile pour ${etat.prixEtoile} pièces`),
      };
    }

    case "FIN_TOUR": {
      if (etat.phase !== "finTour") return etat;
      const indexTour = (etat.indexTour + 1) % etat.ordreTour.length;
      return {
        ...etat,
        indexTour,
        manche: indexTour === 0 ? etat.manche + 1 : etat.manche,
        phase: "lancer",
        de: null,
        pasRestants: 0,
        choix: [],
      };
    }

    default:
      return etat;
  }
}

/** Classement final, du plus d'étoiles au moins. Les pièces départagent. */
export function classement(etat: EtatPartie): Pion[] {
  return [...etat.pions].sort(
    (a, b) => b.etoiles - a.etoiles || b.pieces - a.pieces,
  );
}
