"use client";

import { useCallback, useEffect, useState } from "react";
import { PlateauView } from "@/components/PlateauView";
import { classement, creerPartie, pionActif, reduire, type DefinitionPion } from "@/game/partie";
import { graineAleatoire } from "@/game/rng";
import type { Action, EtatPartie } from "@/game/types";

/** Pions de test, en attendant l'écran de configuration et le lobby multi. */
const PIONS_DEMO: DefinitionPion[] = [
  { nom: "Les Rouges", membres: ["Alice", "Bob"] },
  { nom: "Les Bleus", membres: ["Chloé", "David"] },
  { nom: "Les Verts", membres: ["Émile"] },
  { nom: "Les Jaunes", membres: ["Fanny", "Gaspard"] },
];

/** Cadence du pion qui saute de case en case. */
const DELAI_PAS_MS = 340;
const DELAI_RESOLUTION_MS = 550;

export default function Page() {
  const [etat, setEtat] = useState<EtatPartie | null>(null);
  const [suivrePionActif, setSuivrePionActif] = useState(true);

  const envoyer = useCallback((action: Action) => {
    setEtat((e) => (e ? reduire(e, action) : e));
  }, []);

  const nouvellePartie = useCallback(() => {
    setEtat(creerPartie(graineAleatoire(), PIONS_DEMO));
  }, []);

  // La graine est tirée au montage : générer côté serveur donnerait un plateau
  // différent de celui du client et casserait l'hydratation.
  useEffect(() => {
    nouvellePartie();
  }, [nouvellePartie]);

  // Déplacement et résolution s'enchaînent tout seuls : le joueur ne tape que
  // sur le dé, les croisements et la fin de tour.
  useEffect(() => {
    if (!etat) return;
    if (etat.phase === "deplacement") {
      const t = setTimeout(() => envoyer({ type: "AVANCER" }), DELAI_PAS_MS);
      return () => clearTimeout(t);
    }
    if (etat.phase === "resolution") {
      const t = setTimeout(() => envoyer({ type: "RESOUDRE_CASE" }), DELAI_RESOLUTION_MS);
      return () => clearTimeout(t);
    }
  }, [etat, envoyer]);

  if (!etat) {
    return (
      <main className="flex h-dvh items-center justify-center text-slate-400">
        Génération du plateau…
      </main>
    );
  }

  const actif = pionActif(etat);
  const terminee = etat.phase === "terminee";

  return (
    <main className="flex h-dvh flex-col bg-slate-900">
      <header className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <div className="flex gap-3 text-slate-300">
          <span>Manche {etat.manche}</span>
          <span>⭐ {etat.etoilesRestantes} restantes</span>
          <span>Étoile : {etat.prixEtoile} 🪙</span>
        </div>
        <button
          onClick={() => setSuivrePionActif((v) => !v)}
          className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 active:bg-slate-700"
        >
          {suivrePionActif ? "Vue d'ensemble" : "Suivre le pion"}
        </button>
      </header>

      <div className="min-h-0 flex-1">
        <PlateauView
          plateau={etat.plateau}
          pions={etat.pions}
          pionActifId={actif.id}
          etoilesSur={etat.etoilesSur}
          choix={etat.choix}
          onChoisir={(caseId) => envoyer({ type: "CHOISIR_CHEMIN", caseId })}
          suivrePionActif={suivrePionActif}
        />
      </div>

      <div className="grid grid-cols-4 gap-1 px-2 py-2">
        {etat.pions.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg px-2 py-1.5 text-center text-xs ${
              p.id === actif.id ? "bg-slate-700" : "bg-slate-800/60"
            }`}
          >
            <div className="flex items-center justify-center gap-1 font-medium">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: p.couleur }}
              />
              <span className="truncate text-slate-200">{p.nom}</span>
            </div>
            <div className="mt-0.5 text-slate-400">
              ⭐ {p.etoiles} · 🪙 {p.pieces}
            </div>
          </div>
        ))}
      </div>

      <footer className="space-y-2 border-t border-slate-800 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {terminee ? (
          <div className="space-y-2 text-center">
            <p className="text-sm text-slate-400">Partie terminée — les culs secs à distribuer :</p>
            <ul className="space-y-1 text-sm">
              {classement(etat).map((p, i) => (
                <li key={p.id}>
                  <span className="text-slate-500">{i + 1}.</span>{" "}
                  <span style={{ color: p.couleur }}>{p.nom}</span> — {p.etoiles} ⭐
                </li>
              ))}
            </ul>
            <button
              onClick={nouvellePartie}
              className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 active:bg-emerald-400"
            >
              Nouvelle partie
            </button>
          </div>
        ) : (
          <>
            <p className="text-center text-sm text-slate-400">
              {etat.journal.at(-1)?.texte ?? "À toi de jouer"}
            </p>

            {etat.phase === "lancer" && (
              <button
                onClick={() => envoyer({ type: "LANCER_DE" })}
                className="w-full rounded-xl py-4 text-lg font-bold text-slate-950"
                style={{ backgroundColor: actif.couleur }}
              >
                {actif.nom} — lancer le dé
              </button>
            )}

            {etat.phase === "deplacement" && (
              <p className="py-4 text-center text-lg font-bold">
                🎲 {etat.de} — encore {etat.pasRestants}
              </p>
            )}

            {etat.phase === "croisement" && (
              <p className="py-4 text-center text-lg font-bold text-amber-300">
                Croisement — touche la case de ton choix
              </p>
            )}

            {etat.phase === "achatEtoile" && (
              <div className="flex gap-2">
                <button
                  onClick={() => envoyer({ type: "ACHETER_ETOILE", acheter: true })}
                  className="flex-1 rounded-xl bg-amber-400 py-4 font-bold text-slate-950 active:bg-amber-300"
                >
                  Acheter l&apos;étoile ({etat.prixEtoile} 🪙)
                </button>
                <button
                  onClick={() => envoyer({ type: "ACHETER_ETOILE", acheter: false })}
                  className="rounded-xl bg-slate-800 px-4 py-4 text-slate-300 active:bg-slate-700"
                >
                  Non
                </button>
              </div>
            )}

            {etat.phase === "finTour" && (
              <button
                onClick={() => envoyer({ type: "FIN_TOUR" })}
                className="w-full rounded-xl bg-slate-100 py-4 font-bold text-slate-900 active:bg-slate-300"
              >
                Au suivant
              </button>
            )}
          </>
        )}
      </footer>
    </main>
  );
}
