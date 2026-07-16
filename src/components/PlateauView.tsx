"use client";

import { useMemo } from "react";
import type { Pion, Plateau, TypeCase } from "@/game/types";

/** Côté du carré de rendu, en unités SVG. La caméra travaille là-dedans. */
const VUE = 1000;
const ZOOM_SUIVI = 2.4;

const COULEURS_CASES: Record<TypeCase, string> = {
  depart: "#e2e8f0",
  bonus: "#22c55e",
  grosBonus: "#10b981",
  malus: "#ef4444",
  defi: "#a855f7",
  evenement: "#3b82f6",
  boutique: "#f59e0b",
  etoile: "#facc15",
  neutre: "#475569",
};

const LIBELLES_CASES: Record<TypeCase, string> = {
  depart: "Départ",
  bonus: "Bonus",
  grosBonus: "Gros bonus",
  malus: "Malus",
  defi: "Défi",
  evenement: "Événement",
  boutique: "Boutique",
  etoile: "Étoile",
  neutre: "Rien",
};

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
    // Vue d'ensemble : on cadre tout le plateau.
    const zoom = Math.min(VUE / (maxX - minX), VUE / (maxY - minY));
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom };
  }, [plateau, pionActif, suivrePionActif]);

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
      const rayon = 11;
      return { pion, x: c.x + Math.cos(angle) * rayon, y: c.y + Math.sin(angle) * rayon };
    });
  }, [pions, plateau]);

  const aretes = useMemo(() => {
    const liste: { de: string; vers: string; raccourci: boolean }[] = [];
    for (const c of Object.values(plateau.cases)) {
      for (const suivante of c.suivantes) {
        liste.push({
          de: c.id,
          vers: suivante,
          raccourci: c.id.startsWith("r") || suivante.startsWith("r"),
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
      <rect width={VUE} height={VUE} fill="#0f172a" />

      <g
        style={{
          // En SVG, les longueurs CSS d'une transformation sont en unités
          // utilisateur : `px` correspond ici au repère du viewBox.
          transform: `translate(${tx}px, ${ty}px) scale(${camera.zoom})`,
          transformOrigin: "0 0",
          transition: "transform 650ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {aretes.map(({ de, vers, raccourci }) => {
          const a = plateau.cases[de];
          const b = plateau.cases[vers];
          return (
            <line
              key={`${de}-${vers}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={raccourci ? "#64748b" : "#334155"}
              strokeWidth={raccourci ? 3 : 5}
              strokeDasharray={raccourci ? "6 6" : undefined}
              strokeLinecap="round"
            />
          );
        })}

        {Object.values(plateau.cases).map((c) => {
          const proposee = choix.includes(c.id);
          const porteEtoile = etoilesSur.includes(c.id);
          return (
            <g
              key={c.id}
              onClick={proposee ? () => onChoisir?.(c.id) : undefined}
              style={{ cursor: proposee ? "pointer" : "default" }}
            >
              <circle
                cx={c.x}
                cy={c.y}
                r={c.type === "depart" ? 13 : 10}
                fill={COULEURS_CASES[c.type]}
                stroke={proposee ? "#ffffff" : "#0f172a"}
                strokeWidth={proposee ? 3 : 1.5}
              >
                <title>{LIBELLES_CASES[c.type]}</title>
              </circle>

              {porteEtoile && (
                <text
                  x={c.x}
                  y={c.y - 17}
                  textAnchor="middle"
                  fontSize={20}
                  style={{ pointerEvents: "none" }}
                >
                  ⭐
                </text>
              )}

              {proposee && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={18}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2}
                  opacity={0.7}
                >
                  <animate
                    attributeName="r"
                    values="14;22;14"
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
            <circle
              r={pion.id === pionActifId ? 9 : 7}
              fill={pion.couleur}
              stroke="#f8fafc"
              strokeWidth={pion.id === pionActifId ? 3 : 1.5}
            />
            {pion.id === pionActifId && (
              <circle r={15} fill="none" stroke={pion.couleur} strokeWidth={2} opacity={0.8}>
                <animate
                  attributeName="r"
                  values="12;19;12"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0;0.8"
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
