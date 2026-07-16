"use client";

import { useEffect, useRef, useState } from "react";

/** Faces du dé, en index d'une grille 3x3 lue de gauche à droite. */
const POINTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/**
 * Rotation à appliquer au cube pour amener chaque face devant, sachant comment
 * les faces sont posées dans `FACES` plus bas.
 */
const ORIENTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

/** Où chaque face est collée sur le cube. */
const FACES: Record<number, string> = {
  1: "translateZ(var(--demi))",
  2: "rotateY(90deg) translateZ(var(--demi))",
  3: "rotateX(90deg) translateZ(var(--demi))",
  4: "rotateX(-90deg) translateZ(var(--demi))",
  5: "rotateY(-90deg) translateZ(var(--demi))",
  6: "rotateY(180deg) translateZ(var(--demi))",
};

export interface DeProps {
  /** Valeur affichée. `null` = le dé n'a pas encore été lancé. */
  valeur: number | null;
  /** Côté du dé, en pixels. */
  taille?: number;
}

export function De({ valeur, taille = 64 }: DeProps) {
  // Chaque nouveau lancer ajoute des tours complets : c'est ce qui fait
  // culbuter le cube au lieu de le faire glisser d'une face à l'autre.
  const [tours, setTours] = useState(0);
  const precedente = useRef<number | null>(null);

  useEffect(() => {
    if (valeur !== null && valeur !== precedente.current) setTours((t) => t + 1);
    precedente.current = valeur;
  }, [valeur]);

  const orientation = ORIENTATIONS[valeur ?? 1];

  return (
    <div
      style={{ width: taille, height: taille, perspective: taille * 4 }}
      aria-label={valeur ? `Dé : ${valeur}` : "Dé"}
      role="img"
    >
      <div
        style={{
          // @ts-expect-error -- variable CSS consommée par les faces
          "--demi": `${taille / 2}px`,
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          // Deux tours sur un axe, trois sur l'autre : ça culbute au lieu de
          // pivoter. Des multiples de 360° ne changent pas la face d'arrivée.
          transform: `rotateX(${orientation.x + 720 * tours}deg) rotateY(${
            orientation.y + 1080 * tours
          }deg)`,
          transition: "transform 900ms cubic-bezier(0.2, 0.9, 0.25, 1)",
        }}
      >
        {Object.entries(FACES).map(([face, transform]) => (
          <div
            key={face}
            style={{
              position: "absolute",
              inset: 0,
              transform,
              backfaceVisibility: "hidden",
              borderRadius: taille * 0.18,
              background: "linear-gradient(150deg, #ffffff 0%, #d8dee9 100%)",
              boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.15)",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              padding: taille * 0.14,
              gap: taille * 0.04,
            }}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                style={{
                  borderRadius: "9999px",
                  background: POINTS[Number(face)].includes(i) ? "#0f172a" : "transparent",
                  boxShadow: POINTS[Number(face)].includes(i)
                    ? "inset 0 1px 1px rgba(255,255,255,0.35)"
                    : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
