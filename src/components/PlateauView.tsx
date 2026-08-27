"use client";

import { useMemo } from "react";
import type { Case, Pion, Plateau, TypeCase } from "@/game/types";

/** Côté du carré de rendu, en unités SVG. La caméra travaille là-dedans. */
const VUE = 1000;
const ZOOM_SUIVI = 2.4;
const COTE_CASE = 28;

const COULEURS_CASES: Record<TypeCase, string> = {
  depart: "#e2e8f0",
  defi: "#a855f7",
  bonus: "#22c55e",
  malus: "#ef4444",
  evenement: "#3b82f6",
  boutique: "#f59e0b",
  roulette: "#ec4899",
};

const ICONES_CASES: Record<TypeCase, string> = {
  depart: "🏁",
  defi: "⚔️",
  bonus: "➕",
  malus: "❗",
  evenement: "❓",
  boutique: "🛒",
  roulette: "🥃",
};

const LIBELLES_CASES: Record<TypeCase, string> = {
  depart: "Départ",
  defi: "Défi",
  bonus: "Bonus",
  malus: "Malus",
  evenement: "Événement",
  boutique: "Boutique",
  roulette: "Roulette à shot",
};

export interface PlateauViewProps {
  plateau: Plateau;
  pions: Pion[];
  pionActifId: string;
  /** Cases portant une étoile. */
  etoilesSur: string[];
  /** Dernier saut d'étoile, pour l'animer. */
  dernierSautEtoile: { de: string; vers: string } | null;
  /** Cases proposées au croisement. Cliquables. */
  choix: string[];
  onChoisir?: (caseId: string) => void;
  /** `false` = vue d'ensemble. */
  suivrePionActif: boolean;
}

export function PlateauView({
  plateau,
  pions,
  pionActifId,
  etoilesSur,
  dernierSautEtoile,
  choix,
  onChoisir,
  suivrePionActif,
}: PlateauViewProps) {
  const pionActif = pions.find((p) => p.id === pionActifId);

  const camera = useMemo(() => {
    const { minX, minY, maxX, maxY } = plateau.limites;
    if (suivrePionActif && pionActif) {
      const cible = plateau.cases[pionActif.caseId];
      return { x: cible.x, y: cible.y, zoom: ZOOM_SUIVI };
    }
    const zoom = Math.min(VUE / (maxX - minX), VUE / (maxY - minY));
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom };
  }, [plateau, pionActif, suivrePionActif]);

  /** Chaque case est orientée le long du parcours : c'est ce qui fait lire une
   *  piste plutôt qu'un semis de pastilles. */
  const angles = useMemo(() => {
    const table: Record<string, number> = {};
    for (const c of Object.values(plateau.cases)) {
      const suivante = plateau.cases[c.suivantes[0]];
      table[c.id] = suivante
        ? (Math.atan2(suivante.y - c.y, suivante.x - c.x) * 180) / Math.PI
        : 0;
    }
    return table;
  }, [plateau]);

  // Plusieurs pions peuvent occuper la même case : on les écarte en étoile
  // autour du centre, sinon ils se cachent les uns les autres.
  const positionsPions = useMemo(() => {
    const parCase = new Map<string, Pion[]>();
    for (const p of pions) {
      const liste = parCase.get(p.caseId) ?? [];
      liste.push(p);
      parCase.set(p.caseId, liste);
    }
    return pions.map((pion) => {
      const colocataires = parCase.get(pion.caseId)!;
      const index = colocataires.indexOf(pion);
      const c = plateau.cases[pion.caseId];
      if (colocataires.length === 1) return { pion, x: c.x, y: c.y };
      const angle = (index / colocataires.length) * Math.PI * 2;
      return { pion, x: c.x + Math.cos(angle) * 12, y: c.y + Math.sin(angle) * 12 };
    });
  }, [pions, plateau]);

  const aretes = useMemo(() => {
    const liste: { a: Case; b: Case; raccourci: boolean }[] = [];
    for (const c of Object.values(plateau.cases)) {
      for (const idSuivante of c.suivantes) {
        liste.push({
          a: c,
          b: plateau.cases[idSuivante],
          raccourci: c.id.startsWith("r") || idSuivante.startsWith("r"),
        });
      }
    }
    return liste;
  }, [plateau]);

  const tx = VUE / 2 - camera.x * camera.zoom;
  const ty = VUE / 2 - camera.y * camera.zoom;

  return (
    <svg
      viewBox={`0 0 ${VUE} ${VUE}`}
      className="h-full w-full touch-none select-none"
      role="img"
      aria-label="Plateau de jeu"
    >
      <defs>
        <radialGradient id="fondPlateau" cx="50%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#d6f0ff" />
          <stop offset="100%" stopColor="#b3e2ff" />
        </radialGradient>
      </defs>
      <rect width={VUE} height={VUE} fill="url(#fondPlateau)" />

      <g
        style={{
          // En SVG, les longueurs CSS d'une transformation sont en unités
          // utilisateur : `px` correspond ici au repère du viewBox.
          transform: `translate(${tx}px, ${ty}px) scale(${camera.zoom})`,
          transformOrigin: "0 0",
          transition: "transform 650ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* La piste : un boudin blanc cerné de foncé, sous les cases. */}
        {aretes.map(({ a, b, raccourci }) => (
          <line
            key={`casing-${a.id}-${b.id}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#0f2a43"
            strokeWidth={raccourci ? 26 : 36}
            strokeLinecap="round"
          />
        ))}
        {aretes.map(({ a, b, raccourci }) => (
          <line
            key={`piste-${a.id}-${b.id}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#ffffff"
            strokeWidth={raccourci ? 16 : 26}
            strokeLinecap="round"
            strokeDasharray={raccourci ? "2 16" : undefined}
          />
        ))}

        {Object.values(plateau.cases).map((c) => {
          const proposee = choix.includes(c.id);
          const porteEtoile = etoilesSur.includes(c.id);
          const arriveeEtoile = dernierSautEtoile?.vers === c.id;
          const couleur = COULEURS_CASES[c.type];
          const demi = COTE_CASE / 2;

          return (
            <g
              key={c.id}
              onClick={proposee ? () => onChoisir?.(c.id) : undefined}
              style={{ cursor: proposee ? "pointer" : "default" }}
            >
              <g transform={`translate(${c.x} ${c.y}) rotate(${angles[c.id]})`}>
                {/* Ombre portée douce. */}
                <rect
                  x={-demi}
                  y={-demi + 4}
                  width={COTE_CASE}
                  height={COTE_CASE}
                  rx={8}
                  fill="#0f2a43"
                  opacity={0.18}
                />
                <rect
                  x={-demi}
                  y={-demi}
                  width={COTE_CASE}
                  height={COTE_CASE}
                  rx={8}
                  fill={couleur}
                  stroke={proposee ? "#0f2a43" : "#ffffff"}
                  strokeWidth={proposee ? 3 : 2}
                >
                  <title>{LIBELLES_CASES[c.type]}</title>
                </rect>
              </g>

              {/* L'icône reste droite : une case pivotée ne doit pas rendre son
                  symbole illisible. */}
              <text
                x={c.x}
                y={c.y + 5}
                textAnchor="middle"
                fontSize={14}
                style={{ pointerEvents: "none" }}
              >
                {ICONES_CASES[c.type]}
              </text>

              {porteEtoile && (
                <text
                  x={c.x}
                  y={c.y - 22}
                  textAnchor="middle"
                  fontSize={24}
                  style={{
                    pointerEvents: "none",
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: arriveeEtoile ? "etoile-arrivee 600ms ease-out both" : undefined,
                  }}
                >
                  ⭐
                  {!arriveeEtoile && (
                    <animate
                      attributeName="y"
                      values={`${c.y - 22};${c.y - 29};${c.y - 22}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  )}
                </text>
              )}

              {proposee && (
                <circle cx={c.x} cy={c.y} r={20} fill="none" stroke="#0f2a43" strokeWidth={2.5}>
                  <animate attributeName="r" values="18;27;18" dur="1.2s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.9;0.15;0.9"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* L'étoile qui vient d'être ramassée jaillit là où elle était. */}
        {dernierSautEtoile && plateau.cases[dernierSautEtoile.de] && (
          <text
            key={`saut-${dernierSautEtoile.de}-${dernierSautEtoile.vers}`}
            x={plateau.cases[dernierSautEtoile.de].x}
            y={plateau.cases[dernierSautEtoile.de].y - 22}
            textAnchor="middle"
            fontSize={26}
            style={{
              pointerEvents: "none",
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: "etoile-gagnee 900ms ease-out both",
            }}
          >
            ⭐
          </text>
        )}

        {positionsPions.map(({ pion, x, y }) => (
          <g
            key={pion.id}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transformOrigin: "0 0",
              transition: "transform 300ms ease-out",
            }}
          >
            <ellipse cx={0} cy={7} rx={7} ry={2.5} fill="#0f2a43" opacity={0.35} />
            <circle
              r={pion.id === pionActifId ? 8 : 6.5}
              cy={-2}
              fill={pion.couleur}
              stroke="#ffffff"
              strokeWidth={pion.id === pionActifId ? 2.5 : 1.5}
            />
            {pion.id === pionActifId && (
              <circle r={14} fill="none" stroke={pion.couleur} strokeWidth={2.5}>
                <animate attributeName="r" values="11;20;11" dur="1.6s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0.9;0;0.9"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
