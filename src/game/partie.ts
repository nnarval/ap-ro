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
  const [indexEtoile, rngApres] = tirerEntier(rng, 0, plateau.emplacementsEtoile.length - 1);
  rng = rngApres;

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
    etoileSur: plateau.emplacementsEtoile[indexEtoile],
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

/** Déplace l'étoile sur un autre emplacement, à la façon de Mario Party. */
function deplacerEtoile(etat: EtatPartie): { etoileSur: string; rng: number } {
  const candidats = etat.plateau.emplacementsEtoile.filter((id) => id !== etat.etoileSur);
  if (candidats.length === 0) return { etoileSur: etat.etoileSur!, rng: etat.rng };
  const [i, rng] = tirerEntier(etat.rng, 0, candidats.length - 1);
  return { etoileSur: candidats[i], rng };
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
          if (etat.etoileSur !== caseCourante.id) {
            return {
              ...etat,
              phase: "finTour",
              journal: noter(etat, "emplacement d'étoile, mais l'étoile est ailleurs"),
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
      const { etoileSur, rng } = deplacerEtoile(etat);
      const journal = noter(etat, `achète une étoile pour ${etat.prixEtoile} pièces`);

      return {
        ...etat,
        pions: majPionActif(etat, {
          pieces: pion.pieces - etat.prixEtoile,
          etoiles: pion.etoiles + 1,
        }),
        etoilesRestantes,
        etoileSur: etoilesRestantes > 0 ? etoileSur : null,
        prixEtoile: etat.prixEtoile + REGLAGES.inflationEtoile,
        rng,
        phase: etoilesRestantes > 0 ? "finTour" : "terminee",
        journal,
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
