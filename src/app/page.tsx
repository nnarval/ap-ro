"use client";

import { useCallback, useEffect, useState } from "react";
import { De } from "@/components/De";
import { PlateauView } from "@/components/PlateauView";
import { REGLAGES } from "@/game/config";
import { classement, creerPartie, pionActif, reduire, type DefinitionPion } from "@/game/partie";
import { graineAleatoire } from "@/game/rng";
import type { Action, EtatPartie, Pion } from "@/game/types";

/** Pions de test, en attendant l'écran de configuration et le lobby multi. */
const PIONS_DEMO: DefinitionPion[] = [
  { nom: "Les Rouges", membres: ["Alice", "Bob"] },
  { nom: "Les Bleus", membres: ["Chloé", "David"] },
  { nom: "Les Verts", membres: ["Émile"] },
  { nom: "Les Jaunes", membres: ["Fanny", "Gaspard"] },
];

const DELAI_PAS_MS = 340;
const DELAI_RESOLUTION_MS = 550;

function Bouton({
  children,
  onClick,
  couleur,
  variante = "plein",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  couleur?: string;
  variante?: "plein" | "discret";
  disabled?: boolean;
}) {
  const base =
    "flex-1 rounded-xl py-3.5 text-center font-semibold transition active:scale-[0.98] disabled:opacity-40";
  if (variante === "discret") {
    return (
      <button onClick={onClick} disabled={disabled} className={`${base} bg-slate-800 text-slate-200`}>
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} text-slate-950`}
      style={{ backgroundColor: couleur ?? "#f1f5f9" }}
    >
      {children}
    </button>
  );
}

/** Rangée de pions à désigner (adversaire, vainqueur…). */
function ChoixPion({
  pions,
  onChoisir,
  exclure,
}: {
  pions: Pion[];
  onChoisir: (id: string) => void;
  exclure?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {pions
        .filter((p) => p.id !== exclure)
        .map((p) => (
          <Bouton key={p.id} onClick={() => onChoisir(p.id)} couleur={p.couleur}>
            {p.nom}
          </Bouton>
        ))}
    </div>
  );
}

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
  // sur les vraies décisions.
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
  const adversaire = etat.pions.find((p) => p.id === etat.adversaireId);
  const montreDe = etat.phase === "lancer" || etat.phase === "deplacement";

  return (
    <main className="flex h-dvh flex-col bg-slate-900">
      <header className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
        <div className="flex gap-3 text-slate-300">
          <span>Manche {etat.manche}</span>
          <span>⭐ {etat.etoilesRestantes} à prendre</span>
        </div>
        <button
          onClick={() => setSuivrePionActif((v) => !v)}
          className="rounded-full bg-slate-800 px-3 py-1 font-medium text-slate-200 active:bg-slate-700"
        >
          {suivrePionActif ? "Vue d'ensemble" : "Suivre le pion"}
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <PlateauView
          plateau={etat.plateau}
          pions={etat.pions}
          pionActifId={actif.id}
          etoilesSur={etat.etoilesSur}
          choix={etat.choix}
          onChoisir={(caseId) => envoyer({ type: "CHOISIR_CHEMIN", caseId })}
          suivrePionActif={suivrePionActif}
        />
        {montreDe && (
          <div className="pointer-events-none absolute right-4 bottom-4">
            <De valeur={etat.de} taille={58} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {etat.pions.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg px-1.5 py-1 text-center text-[11px] ${
              p.id === actif.id ? "bg-slate-700" : "bg-slate-800/60"
            }`}
          >
            <div className="flex items-center justify-center gap-1 font-medium">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.couleur }}
              />
              <span className="truncate text-slate-200">{p.nom}</span>
            </div>
            <div className="mt-0.5 text-slate-400">
              ⭐{p.etoiles} 🪙{p.pieces}
              {p.gorgees > 0 && <span className="text-amber-300"> 🍺{p.gorgees}</span>}
            </div>
          </div>
        ))}
      </div>

      <footer className="space-y-2 border-t border-slate-800 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="truncate text-center text-xs text-slate-400">
          {etat.journal.at(-1)?.texte ?? "La partie commence"}
        </p>

        {etat.phase === "lancer" && (
          <Bouton onClick={() => envoyer({ type: "LANCER_DE" })} couleur={actif.couleur}>
            {actif.nom} — lancer le dé
          </Bouton>
        )}

        {etat.phase === "deplacement" && (
          <p className="py-3 text-center font-semibold text-slate-300">
            encore {etat.pasRestants} case{etat.pasRestants > 1 ? "s" : ""}
          </p>
        )}

        {etat.phase === "croisement" && (
          <p className="py-3 text-center font-semibold text-amber-300">
            Croisement — touche la case de ton choix
          </p>
        )}

        {etat.phase === "choixMalus" && (
          <div className="flex gap-2">
            <Bouton onClick={() => envoyer({ type: "CHOISIR_MALUS", gage: false })} couleur="#ef4444">
              −{REGLAGES.perteMalus} pièces
            </Bouton>
            <Bouton onClick={() => envoyer({ type: "CHOISIR_MALUS", gage: true })} variante="discret">
              Plutôt un gage
            </Bouton>
          </div>
        )}

        {etat.phase === "boutique" && (
          <div className="space-y-2">
            <Bouton
              onClick={() => envoyer({ type: "ACHETER_ETOILE" })}
              couleur="#facc15"
              disabled={actif.pieces < REGLAGES.prixEtoileBoutique}
            >
              ⭐ Acheter une étoile — {REGLAGES.prixEtoileBoutique} 🪙
            </Bouton>
            <div className="flex gap-2">
              {[1, 3, 5].map((n) => (
                <Bouton
                  key={n}
                  onClick={() => envoyer({ type: "ACHETER_GORGEES", nombre: n })}
                  variante="discret"
                  disabled={actif.pieces < n * REGLAGES.prixGorgee}
                >
                  🍺 {n} gorgée{n > 1 ? "s" : ""}
                </Bouton>
              ))}
            </div>
            <Bouton onClick={() => envoyer({ type: "QUITTER_BOUTIQUE" })} variante="discret">
              Quitter la boutique
            </Bouton>
          </div>
        )}

        {etat.phase === "choixAdversaire" && (
          <div className="space-y-2">
            <p className="text-center text-sm font-semibold text-purple-300">
              ⚔️ {actif.nom} choisit qui défier
            </p>
            <ChoixPion
              pions={etat.pions}
              exclure={actif.id}
              onChoisir={(pionId) => envoyer({ type: "CHOISIR_ADVERSAIRE", pionId })}
            />
          </div>
        )}

        {etat.phase === "defiDuel" && adversaire && (
          <div className="space-y-2">
            <p className="text-center text-sm text-slate-300">
              <span style={{ color: actif.couleur }}>{actif.nom}</span> contre{" "}
              <span style={{ color: adversaire.couleur }}>{adversaire.nom}</span> — qui gagne ?
            </p>
            <div className="flex gap-2">
              {[actif, adversaire].map((p) => (
                <Bouton
                  key={p.id}
                  onClick={() => envoyer({ type: "RESOUDRE_DEFI", vainqueurId: p.id })}
                  couleur={p.couleur}
                >
                  {p.nom}
                </Bouton>
              ))}
            </div>
          </div>
        )}

        {etat.phase === "defiCollectif" && (
          <div className="space-y-2">
            <p className="text-center text-sm font-semibold text-amber-300">
              Défi de fin de manche — le gagnant prend une étoile
            </p>
            <ChoixPion
              pions={etat.pions}
              onChoisir={(vainqueurId) => envoyer({ type: "RESOUDRE_DEFI_COLLECTIF", vainqueurId })}
            />
          </div>
        )}

        {etat.phase === "finTour" && (
          <>
            {actif.gorgees > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pb-1">
                <span className="text-xs text-slate-400">Offrir une gorgée :</span>
                {etat.pions
                  .filter((p) => p.id !== actif.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        envoyer({
                          type: "DONNER_GORGEE",
                          donneurId: actif.id,
                          receveurId: p.id,
                        })
                      }
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-950"
                      style={{ backgroundColor: p.couleur }}
                    >
                      {p.nom}
                    </button>
                  ))}
              </div>
            )}
            <Bouton onClick={() => envoyer({ type: "FIN_TOUR" })}>Au suivant</Bouton>
          </>
        )}

        {etat.phase === "terminee" && (
          <div className="space-y-2 text-center">
            <p className="text-sm text-slate-400">Terminé — les culs secs à distribuer :</p>
            <ul className="space-y-0.5 text-sm">
              {classement(etat).map((p, i) => (
                <li key={p.id}>
                  <span className="text-slate-500">{i + 1}.</span>{" "}
                  <span style={{ color: p.couleur }}>{p.nom}</span> — {p.etoiles} ⭐
                </li>
              ))}
            </ul>
            <Bouton onClick={nouvellePartie} couleur="#34d399">
              Nouvelle partie
            </Bouton>
          </div>
        )}
      </footer>
    </main>
  );
}
