"use client";

import { useEffect, useState } from "react";
import { CarteAnnonce } from "@/components/CarteAnnonce";
import { De } from "@/components/De";
import { PlateauView } from "@/components/PlateauView";
import { Roue } from "@/components/Roue";
import { REGLAGES } from "@/game/config";
import { texteDefi } from "@/game/defis";
import { classement, pionActif, pionsSurCaseActive } from "@/game/partie";
import type { Action, EtatPartie, Pion } from "@/game/types";

const DELAI_PAS_MS = 340;
const DELAI_RESOLUTION_MS = 550;
/** Le premier pas attend que le gros dé finisse sa culbute au centre. */
const DELAI_DE_MS = 1150;

/** Les moments que tout le monde regarde en même temps, quel que soit le
 *  téléphone : réflexe, roulette, événement, fin de manche, duel. */
const PHASES_PARTAGEES = new Set<EtatPartie["phase"]>([
  "reflexe",
  "roulette",
  "evenement",
  "roueManche",
  "defiCollectif",
  "defiDuel",
]);

/** Noir ou blanc sur une couleur donnée, pour garder le texte lisible. */
function couleurTexte(hex?: string): string {
  if (!hex) return "#0f2a43";
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0f2a43" : "#ffffff";
}

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
    "w-full rounded-2xl py-3.5 text-center font-extrabold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100";
  if (variante === "discret") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${base} bg-[#eef4f8] text-[#0f2a43] shadow-[0_2px_0_#cdd9e3]`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} shadow-[0_3px_0_rgba(15,42,67,0.25)]`}
      style={{ backgroundColor: couleur ?? "#16c47f", color: couleurTexte(couleur ?? "#16c47f") }}
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

/** La roulette à shot : la roue des couleurs désigne qui boit. */
function Roulette({ etat, envoyer }: { etat: EtatPartie; envoyer: (a: Action) => void }) {
  const [tournee, setTournee] = useState(false);
  const designe = etat.pions.find((p) => p.id === etat.equipeShot);
  const index = etat.pions.findIndex((p) => p.id === etat.equipeShot);

  return (
    <CarteAnnonce couleur="#ec4899" icone="🥃" surtitre="Roulette à shot" titre="La roue tourne…">
      <Roue
        key={etat.equipeShot ?? "roue"}
        segments={etat.pions.map((p) => ({ label: p.nom, couleur: p.couleur }))}
        gagnantIndex={Math.max(0, index)}
        onFini={() => setTournee(true)}
        taille={230}
      />
      {tournee && designe && (
        <div style={{ animation: "carte-contenu 300ms ease-out both" }}>
          <p className="text-lg font-black" style={{ color: designe.couleur }}>
            {designe.nom} boivent un shot 🥃
          </p>
          <Bouton onClick={() => envoyer({ type: "CONTINUER" })}>Continuer</Bouton>
        </div>
      )}
    </CarteAnnonce>
  );
}

/** Fin de manche : roue à deux côtés, puis roue des équipes si besoin, puis le
 *  défi et le choix du vainqueur. */
function FinDeManche({ etat, envoyer }: { etat: EtatPartie; envoyer: (a: Action) => void }) {
  // 0 = roue à deux côtés, 1 = roue des équipes, 2 = défi + vainqueur.
  const [etape, setEtape] = useState(0);
  const creatrice = etat.pions.find((p) => p.id === etat.equipeCreatriceId);
  const carte = texteDefi(etat.defiId, etat.cartesPerso);

  const deuxCotes = [
    { label: "Une équipe crée", couleur: "#a855f7" },
    { label: "Carte du jeu", couleur: "#16c47f" },
  ];
  const gagnantCote = etat.sourceDefi === "equipe" ? 0 : 1;

  return (
    <CarteAnnonce
      couleur="#facc15"
      icone="🏆"
      surtitre={`Fin de la manche ${etat.manche}`}
      titre="Défi pour une étoile"
    >
      {etape === 0 && (
        <Roue
          key="cote"
          segments={deuxCotes}
          gagnantIndex={gagnantCote}
          onFini={() => setEtape(etat.sourceDefi === "equipe" ? 1 : 2)}
          taille={230}
        />
      )}

      {etape === 1 && (
        <Roue
          key="equipe"
          segments={etat.pions.map((p) => ({ label: p.nom, couleur: p.couleur }))}
          gagnantIndex={Math.max(0, etat.pions.findIndex((p) => p.id === etat.equipeCreatriceId))}
          onFini={() => setEtape(2)}
          taille={230}
        />
      )}

      {etape === 2 && (
        <div style={{ animation: "carte-contenu 300ms ease-out both" }}>
          {etat.sourceDefi === "equipe" && creatrice ? (
            <p className="mb-3 text-sm text-[#0f2a43]">
              <span className="font-black" style={{ color: creatrice.couleur }}>
                {creatrice.nom}
              </span>{" "}
              inventent le défi et l&apos;annoncent à voix haute.
            </p>
          ) : (
            carte && (
              <div className="mb-3">
                <p className="text-base font-black text-[#0f2a43]">{carte.titre}</p>
                <p className="mt-1 text-sm text-[#5b7891]">{carte.consigne}</p>
              </div>
            )
          )}
          <p className="mb-1 text-xs text-[#5b7891]">Qui gagne l&apos;étoile ⭐ ?</p>
          <GrillePions
            pions={etat.pions}
            onChoisir={(vainqueurId) => envoyer({ type: "RESOUDRE_DEFI_COLLECTIF", vainqueurId })}
          />
        </div>
      )}
    </CarteAnnonce>
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
  // lancent la minuterie : le plus rapide fait avancer, les autres sont ignorés
  // par la garde du réducteur. C'est volontaire — si un appareil rame, la partie
  // continue quand même.
  useEffect(() => {
    if (etat.phase === "deplacement") {
      // Le tout premier pas laisse le temps au gros dé de culbuter ; les
      // suivants s'enchaînent au rythme du déplacement.
      const premierPas = etat.pasRestants === etat.de;
      const t = setTimeout(
        () => envoyer({ type: "AVANCER", pasRestants: etat.pasRestants }),
        premierPas ? DELAI_DE_MS : DELAI_PAS_MS,
      );
      return () => clearTimeout(t);
    }
    if (etat.phase === "resolution") {
      const t = setTimeout(() => envoyer({ type: "RESOUDRE_CASE" }), DELAI_RESOLUTION_MS);
      return () => clearTimeout(t);
    }
  }, [etat.phase, etat.pasRestants, etat.de, envoyer]);

  const actif = pionActif(etat);
  const adversaire = etat.pions.find((p) => p.id === etat.adversaireId);
  const defi = texteDefi(etat.defiId, etat.cartesPerso);
  const montreDe = etat.phase === "lancer" || etat.phase === "deplacement";
  // Le gros dé central : au tout début du déplacement, avant le premier pas.
  // Dérivé de l'état partagé, donc affiché sur tous les téléphones à la fois.
  const montreGrosDe =
    etat.phase === "deplacement" && etat.de !== null && etat.pasRestants === etat.de;
  const monPion = etat.pions.find((p) => p.id === monPionId);
  // C'est le téléphone de l'équipe qui joue qui pilote. Les autres regardent,
  // sauf pour les moments partagés que tout le monde voit.
  const jeMene = monPionId === null || monPionId === actif.id;
  const voitCarte = jeMene || PHASES_PARTAGEES.has(etat.phase);
  const cleCarte = `${etat.phase}-${etat.manche}-${etat.indexTour}-${etat.defiId}-${etat.sourceDefi}`;

  function carte() {
    if (!voitCarte) return null;

    switch (etat.phase) {
      case "reflexe":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#f43f5e"
            icone="⚡"
            surtitre="Réflexe"
            titre={defi?.titre ?? "Réflexe"}
            consigne={defi?.consigne}
          >
            <p className="text-xs text-[#5b7891]">
              Tout le monde regarde — désignez qui a gagné.
            </p>
            <GrillePions
              pions={pionsSurCaseActive(etat)}
              onChoisir={(vainqueurId) => envoyer({ type: "RESOUDRE_REFLEXE", vainqueurId })}
            />
          </CarteAnnonce>
        );

      case "choixAdversaire":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#a855f7"
            icone="⚔️"
            surtitre="Case défi"
            titre="Qui défies-tu ?"
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
            <p className="text-xs text-[#5b7891]">
              Qui gagne ? +{REGLAGES.gainDefiDuel} pièces pour le vainqueur.
            </p>
            <GrillePions
              pions={[actif, adversaire]}
              onChoisir={(vainqueurId) => envoyer({ type: "RESOUDRE_DEFI", vainqueurId })}
            />
          </CarteAnnonce>
        );

      case "choixMalus":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#ef4444"
            icone="❗"
            surtitre="Malus"
            titre={defi?.titre ?? "Gage"}
            consigne={defi?.consigne}
          >
            <Bouton onClick={() => envoyer({ type: "CHOISIR_MALUS", gage: true })} couleur="#ef4444">
              Je relève le gage
            </Bouton>
            <Bouton onClick={() => envoyer({ type: "CHOISIR_MALUS", gage: false })} variante="discret">
              Je refuse (−{REGLAGES.perteMalus} 🪙)
            </Bouton>
          </CarteAnnonce>
        );

      case "evenement":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#3b82f6"
            icone="❓"
            surtitre="Case événement"
            titre="Surprise !"
            consigne={etat.evenementTexte ?? undefined}
          >
            <Bouton onClick={() => envoyer({ type: "CONTINUER" })} couleur="#3b82f6">
              Continuer
            </Bouton>
          </CarteAnnonce>
        );

      case "roulette":
        return <Roulette key={cleCarte} etat={etat} envoyer={envoyer} />;

      case "roueManche":
        return (
          <CarteAnnonce
            key={cleCarte}
            couleur="#facc15"
            icone="🎡"
            surtitre={`Fin de la manche ${etat.manche}`}
            titre="La roue des défis"
            consigne="Une équipe invente le défi, ou c'est une carte du jeu. On tourne !"
          >
            <Bouton onClick={() => envoyer({ type: "LANCER_ROUE_MANCHE" })} couleur="#facc15">
              Tourner la roue
            </Bouton>
          </CarteAnnonce>
        );

      case "defiCollectif":
        return <FinDeManche key={cleCarte} etat={etat} envoyer={envoyer} />;

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
                  🥤 {n}
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
    <div className="flex h-dvh flex-col">
      <header className="feston flex items-center justify-between gap-2 px-3 py-2 text-xs">
        <div className="flex gap-2">
          <span className="rounded-full bg-white/80 px-3 py-1 font-bold text-[#0f2a43] shadow-sm">
            Manche {etat.manche}
          </span>
          <span className="rounded-full bg-[#facc15] px-3 py-1 font-bold text-[#0f2a43] shadow-sm">
            ⭐ {etat.etoilesRestantes} à prendre
          </span>
        </div>
        <button
          onClick={() => setSuivrePionActif((v) => !v)}
          className="rounded-full bg-white/80 px-3 py-1 font-bold text-[#0f2a43] shadow-sm active:bg-white"
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
          dernierSautEtoile={etat.dernierSautEtoile}
          choix={jeMene ? etat.choix : []}
          onChoisir={(caseId) => envoyer({ type: "CHOISIR_CHEMIN", caseId })}
          suivrePionActif={suivrePionActif}
        />
        {montreDe && !montreGrosDe && (
          <div className="pointer-events-none absolute right-4 bottom-4">
            <De valeur={etat.de} taille={58} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {etat.pions.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl px-1.5 py-1 text-center text-[11px] shadow-sm ${
              p.id === actif.id ? "bg-white" : "bg-white/70"
            } ${p.id === monPionId ? "ring-2 ring-[#0f2a43]" : ""}`}
          >
            <div className="flex items-center justify-center gap-1 font-bold">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.couleur }}
              />
              <span className="truncate text-[#0f2a43]">{p.nom}</span>
            </div>
            <div className="mt-0.5 text-[#5b7891]">
              ⭐{p.etoiles} 🪙{p.pieces}
              {p.gorgees > 0 && <span className="text-amber-600"> 🥤{p.gorgees}</span>}
            </div>
          </div>
        ))}
      </div>

      <footer className="space-y-2 border-t border-[#cfe4f0] bg-white/70 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="truncate text-center text-xs text-[#5b7891]">
          {etat.journal.at(-1)?.texte ?? "La partie commence"}
        </p>

        {!jeMene && etat.phase !== "terminee" && !PHASES_PARTAGEES.has(etat.phase) && (
          // Les noms d'équipe portent déjà leur article (« Les Rouges ») :
          // toute tournure avec préposition donnerait « au tour de Les Rouges ».
          <p className="py-3 text-center font-extrabold" style={{ color: actif.couleur }}>
            {actif.nom} jouent
          </p>
        )}

        {jeMene && etat.phase === "lancer" && (
          <Bouton onClick={() => envoyer({ type: "LANCER_DE" })} couleur={actif.couleur}>
            {actif.nom} — lancer le dé
          </Bouton>
        )}

        {jeMene && etat.phase === "deplacement" && (
          <p className="py-3 text-center font-extrabold text-[#0f2a43]">
            encore {etat.pasRestants} case{etat.pasRestants > 1 ? "s" : ""}
          </p>
        )}

        {jeMene && etat.phase === "croisement" && (
          <p className="py-3 text-center font-extrabold text-amber-600">
            Croisement — touche la case de ton choix
          </p>
        )}

        {jeMene && etat.phase === "finTour" && (
          <>
            {actif.gorgees > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pb-1">
                <span className="text-xs text-[#5b7891]">Offrir une gorgée :</span>
                {etat.pions
                  .filter((p) => p.id !== actif.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        envoyer({ type: "DONNER_GORGEE", donneurId: actif.id, receveurId: p.id })
                      }
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ backgroundColor: p.couleur, color: couleurTexte(p.couleur) }}
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
            <p className="text-sm text-[#5b7891]">Terminé — les gorgées à distribuer :</p>
            <ul className="space-y-0.5 text-sm">
              {classement(etat).map((p, i) => (
                <li key={p.id}>
                  <span className="text-[#5b7891]">{i + 1}.</span>{" "}
                  <span className="font-bold" style={{ color: p.couleur }}>
                    {p.nom}
                  </span>{" "}
                  — {p.etoiles} ⭐
                </li>
              ))}
            </ul>
            {onRejouer && (
              <Bouton onClick={onRejouer} couleur="#16c47f">
                Nouvelle partie
              </Bouton>
            )}
          </div>
        )}

        {monPion && (
          <p className="text-center text-[11px] text-[#5b7891]">
            Tu joues avec{" "}
            <span className="font-bold" style={{ color: monPion.couleur }}>
              {monPion.nom}
            </span>
          </p>
        )}
      </footer>

      {montreGrosDe && (
        <div
          className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
          style={{ animation: "voile-entree 150ms ease-out both" }}
        >
          <div className="absolute inset-0 bg-white/45" style={{ backdropFilter: "blur(1px)" }} />
          <div className="relative flex flex-col items-center gap-4">
            <De key={`gros-${etat.manche}-${etat.indexTour}-${etat.de}`} valeur={etat.de} taille={150} />
            <p className="text-2xl font-black" style={{ color: actif.couleur }}>
              {actif.nom} font {etat.de}
            </p>
          </div>
        </div>
      )}

      {carte()}
    </div>
  );
}
