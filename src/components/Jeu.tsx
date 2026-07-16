"use client";

import { useEffect, useState } from "react";
import { CarteAnnonce } from "@/components/CarteAnnonce";
import { De } from "@/components/De";
import { PlateauView } from "@/components/PlateauView";
import { REGLAGES } from "@/game/config";
import { defiParId } from "@/game/defis";
import { classement, pionActif, pionsSurCaseActive } from "@/game/partie";
import type { Action, EtatPartie, Pion } from "@/game/types";

const DELAI_PAS_MS = 340;
const DELAI_RESOLUTION_MS = 550;

export function Bouton({
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
    "w-full rounded-xl py-3.5 text-center font-semibold transition active:scale-[0.98] disabled:opacity-40";
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

function GrillePions({ pions, onChoisir }: { pions: Pion[]; onChoisir: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {pions.map((p) => (
        <Bouton key={p.id} onClick={() => onChoisir(p.id)} couleur={p.couleur}>
          {p.nom}
        </Bouton>
      ))}
    </div>
  );
}

export interface JeuProps {
  etat: EtatPartie;
  envoyer: (action: Action) => void;
  /** Le pion que pilote ce téléphone. `null` = simple spectateur. */
  monPionId: string | null;
  onRejouer?: () => void;
}

export function Jeu({ etat, envoyer, monPionId, onRejouer }: JeuProps) {
  const [suivrePionActif, setSuivrePionActif] = useState(true);

  // Déplacement et résolution s'enchaînent tout seuls. Tous les téléphones
  // lancent la minuterie : le plus rapide fait avancer, les autres sont
  // ignorés par la garde du réducteur. C'est volontaire — si un appareil
  // rame, la partie continue quand même.
  useEffect(() => {
    if (etat.phase === "deplacement") {
      const t = setTimeout(
        () => envoyer({ type: "AVANCER", pasRestants: etat.pasRestants }),
        DELAI_PAS_MS,
      );
      return () => clearTimeout(t);
    }
    if (etat.phase === "resolution") {
      const t = setTimeout(() => envoyer({ type: "RESOUDRE_CASE" }), DELAI_RESOLUTION_MS);
      return () => clearTimeout(t);
    }
  }, [etat.phase, etat.pasRestants, envoyer]);

  const actif = pionActif(etat);
  const adversaire = etat.pions.find((p) => p.id === etat.adversaireId);
  const defi = etat.defiId ? defiParId(etat.defiId) : null;
  const montreDe = etat.phase === "lancer" || etat.phase === "deplacement";
  const monPion = etat.pions.find((p) => p.id === monPionId);
  // C'est le téléphone de l'équipe qui joue qui pilote. Les autres regardent.
  const jeMene = monPionId === null || monPionId === actif.id;
  const cleCarte = `${etat.phase}-${etat.manche}-${etat.indexTour}-${etat.defiId}`;

  function carte() {
    if (!jeMene) return null;

    switch (etat.phase) {
      case "defiInstantane":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#f43f5e"
            icone="⚡"
            surtitre="Duel éclair"
            titre={defi?.titre ?? "Défi"}
            consigne={defi?.consigne}
          >
            <p className="text-xs text-slate-400">
              Qui a gagné ? Les autres boivent {REGLAGES.gorgeesPerdantInstantane} gorgées.
            </p>
            <GrillePions
              pions={pionsSurCaseActive(etat)}
              onChoisir={(vainqueurId) => envoyer({ type: "RESOUDRE_DEFI_INSTANTANE", vainqueurId })}
            />
          </CarteAnnonce>
        );

      case "choixMalus":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#ef4444"
            icone="💀"
            surtitre="Malus"
            titre={`${actif.nom}, tu choisis`}
            consigne="Les pièces ou l'honneur."
          >
            <Bouton onClick={() => envoyer({ type: "CHOISIR_MALUS", gage: false })} couleur="#ef4444">
              −{REGLAGES.perteMalus} pièces
            </Bouton>
            <Bouton onClick={() => envoyer({ type: "CHOISIR_MALUS", gage: true })} variante="discret">
              Plutôt un gage
            </Bouton>
          </CarteAnnonce>
        );

      case "choixAdversaire":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#a855f7"
            icone="⚔️"
            surtitre="Case défi"
            titre={`${actif.nom} choisit sa victime`}
            consigne="Le défi ne sera révélé qu'après."
          >
            <GrillePions
              pions={etat.pions.filter((p) => p.id !== actif.id)}
              onChoisir={(pionId) => envoyer({ type: "CHOISIR_ADVERSAIRE", pionId })}
            />
          </CarteAnnonce>
        );

      case "defiDuel":
        if (!adversaire) return null;
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#a855f7"
            icone="⚔️"
            surtitre={`${actif.nom} contre ${adversaire.nom}`}
            titre={defi?.titre ?? "Duel"}
            consigne={defi?.consigne}
          >
            <p className="text-xs text-slate-400">
              Qui gagne ? +{REGLAGES.gainDefiDuel} pièces pour le vainqueur.
            </p>
            <GrillePions
              pions={[actif, adversaire]}
              onChoisir={(vainqueurId) => envoyer({ type: "RESOUDRE_DEFI", vainqueurId })}
            />
          </CarteAnnonce>
        );

      case "defiCollectif":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#facc15"
            icone="🏆"
            surtitre={`Fin de la manche ${etat.manche}`}
            titre={defi?.titre ?? "Défi collectif"}
            consigne={defi?.consigne}
          >
            <p className="text-xs text-slate-400">
              Tout le monde joue. Le gagnant prend une étoile ⭐
            </p>
            <GrillePions
              pions={etat.pions}
              onChoisir={(vainqueurId) => envoyer({ type: "RESOUDRE_DEFI_COLLECTIF", vainqueurId })}
            />
          </CarteAnnonce>
        );

      case "boutique":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#f59e0b"
            icone="🛒"
            surtitre="Boutique"
            titre={`${actif.pieces} 🪙 en poche`}
            consigne="Une étoile, ou de quoi faire boire les autres."
          >
            <Bouton
              onClick={() => envoyer({ type: "ACHETER_ETOILE" })}
              couleur="#facc15"
              disabled={actif.pieces < REGLAGES.prixEtoileBoutique}
            >
              ⭐ Une étoile — {REGLAGES.prixEtoileBoutique} 🪙
            </Bouton>
            <div className="flex gap-2">
              {[1, 3, 5].map((n) => (
                <Bouton
                  key={n}
                  onClick={() => envoyer({ type: "ACHETER_GORGEES", nombre: n })}
                  variante="discret"
                  disabled={actif.pieces < n * REGLAGES.prixGorgee}
                >
                  🍺 {n}
                </Bouton>
              ))}
            </div>
            <Bouton onClick={() => envoyer({ type: "QUITTER_BOUTIQUE" })} variante="discret">
              Quitter
            </Bouton>
          </CarteAnnonce>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-900">
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
          choix={jeMene ? etat.choix : []}
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
            } ${p.id === monPionId ? "ring-1 ring-slate-400" : ""}`}
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

        {!jeMene && etat.phase !== "terminee" && (
          // Les noms d'équipe portent déjà leur article (« Les Rouges ») :
          // toute tournure avec préposition donnerait « au tour de Les Rouges ».
          <p className="py-3 text-center font-semibold" style={{ color: actif.couleur }}>
            {actif.nom} jouent
          </p>
        )}

        {jeMene && etat.phase === "lancer" && (
          <Bouton onClick={() => envoyer({ type: "LANCER_DE" })} couleur={actif.couleur}>
            {actif.nom} — lancer le dé
          </Bouton>
        )}

        {jeMene && etat.phase === "deplacement" && (
          <p className="py-3 text-center font-semibold text-slate-300">
            encore {etat.pasRestants} case{etat.pasRestants > 1 ? "s" : ""}
          </p>
        )}

        {jeMene && etat.phase === "croisement" && (
          <p className="py-3 text-center font-semibold text-amber-300">
            Croisement — touche la case de ton choix
          </p>
        )}

        {jeMene && etat.phase === "finTour" && (
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
                        envoyer({ type: "DONNER_GORGEE", donneurId: actif.id, receveurId: p.id })
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
            {onRejouer && (
              <Bouton onClick={onRejouer} couleur="#34d399">
                Nouvelle partie
              </Bouton>
            )}
          </div>
        )}

        {monPion && (
          <p className="text-center text-[11px] text-slate-500">
            Tu joues avec <span style={{ color: monPion.couleur }}>{monPion.nom}</span>
          </p>
        )}
      </footer>

      {carte()}
    </div>
  );
}
