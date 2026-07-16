"use client";

import { useMemo } from "react";
import type { Case, Pion, Plateau, TypeCase } from "@/game/types";

/** Côté du carré de rendu, en unités SVG. La caméra travaille là-dedans. */
const VUE = 1000;
const ZOOM_SUIVI = 2.4;
const COTE_CASE = 26;

const COULEURS_CASES: Record<TypeCase, string> = {
  depart: "#e2e8f0",
  defi: "#a855f7",
  bonus: "#22c55e",
  malus: "#ef4444",
  evenement: "#3b82f6",
  boutique: "#f59e0b",
  etoile: "#facc15",
};

const ICONES_CASES: Record<TypeCase, string> = {
  depart: "🏁",
  defi: "⚔️",
  bonus: "🪙",
  malus: "💀",
  evenement: "❓",
  boutique: "🛒",
  etoile: "☆",
};

const LIBELLES_CASES: Record<TypeCase, string> = {
  depart: "Départ",
  defi: "Défi",
  bonus: "Bonus",
  malus: "Malus",
  evenement: "Événement",
  boutique: "Boutique",
  etoile: "Emplacement d'étoile",
};

/** Assombrit une couleur hex, pour la tranche des cases. */
function assombrir(hex: string, facteur: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * facteur);
  const v = Math.round(((n >> 8) & 255) * facteur);
  const b = Math.round((n & 255) * facteur);
  return `rgb(${r},${v},${b})`;
}

export interface PlateauViewProps {
  plateau: Plateau;
  pions: Pion[];
  pionActifId: string;
  /** Cases portant une étoile. */
  etoilesSur: string[];
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
        <radialGradient id="fondPlateau" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0b1120" />
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
        {/* La piste, sous les cases. */}
        {aretes.map(({ a, b, raccourci }) => (
          <line
            key={`piste-${a.id}-${b.id}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#0b1120"
            strokeWidth={raccourci ? 20 : 30}
            strokeLinecap="round"
          />
        ))}
        {aretes.map(({ a, b, raccourci }) => (
          <line
            key={`liseret-${a.id}-${b.id}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={raccourci ? "#334155" : "#1e293b"}
            strokeWidth={raccourci ? 14 : 24}
            strokeLinecap="round"
            strokeDasharray={raccourci ? "10 8" : undefined}
          />
        ))}

        {Object.values(plateau.cases).map((c) => {
          const proposee = choix.includes(c.id);
          const porteEtoile = etoilesSur.includes(c.id);
          const couleur = COULEURS_CASES[c.type];
          const demi = COTE_CASE / 2;

          return (
            <g
              key={c.id}
              onClick={proposee ? () => onChoisir?.(c.id) : undefined}
              style={{ cursor: proposee ? "pointer" : "default" }}
            >
              <g transform={`translate(${c.x} ${c.y}) rotate(${angles[c.id]})`}>
                {/* Tranche : donne l'épaisseur de la case. */}
                <rect
                  x={-demi}
                  y={-demi + 3}
                  width={COTE_CASE}
                  height={COTE_CASE}
                  rx={6}
                  fill={assombrir(couleur, 0.45)}
                />
                <rect
                  x={-demi}
                  y={-demi}
                  width={COTE_CASE}
                  height={COTE_CASE}
                  rx={6}
                  fill={couleur}
                  stroke={proposee ? "#ffffff" : assombrir(couleur, 0.7)}
                  strokeWidth={proposee ? 2.5 : 1}
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
                opacity={c.type === "etoile" && !porteEtoile ? 0.5 : 1}
                style={{ pointerEvents: "none" }}
              >
                {ICONES_CASES[c.type]}
              </text>

              {porteEtoile && (
                <text
                  x={c.x}
                  y={c.y - 20}
                  textAnchor="middle"
                  fontSize={22}
                  style={{ pointerEvents: "none" }}
                >
                  ⭐
                  <animate
                    attributeName="y"
                    values={`${c.y - 20};${c.y - 27};${c.y - 20}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </text>
              )}

              {proposee && (
                <circle cx={c.x} cy={c.y} r={20} fill="none" stroke="#ffffff" strokeWidth={2}>
                  <animate
                    attributeName="r"
                    values="18;27;18"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.9;0.1;0.9"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}

        {positionsPions.map(({ pion, x, y }) => (
          <g
            key={pion.id}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transformOrigin: "0 0",
              transition: "transform 300ms ease-out",
            }}
          >
            <ellipse cx={0} cy={7} rx={7} ry={2.5} fill="#000000" opacity={0.45} />
            <circle
              r={pion.id === pionActifId ? 8 : 6.5}
              cy={-2}
              fill={pion.couleur}
              stroke="#f8fafc"
              strokeWidth={pion.id === pionActifId ? 2.5 : 1.5}
            />
            {pion.id === pionActifId && (
              <circle r={14} fill="none" stroke={pion.couleur} strokeWidth={2}>
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
