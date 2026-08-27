"use client";

import { useEffect, useRef, useState } from "react";

export interface SegmentRoue {
  label: string;
  couleur: string;
}

export interface RoueProps {
  segments: SegmentRoue[];
  /** Index du segment gagnant : la roue s'arrête dessus. */
  gagnantIndex: number;
  /** Appelé une fois la roue arrêtée. */
  onFini?: () => void;
  taille?: number;
  /** Durée de rotation, en ms. */
  duree?: number;
}

const R = 92;
const CENTRE = 100;

function pointSur(angleDeg: number, rayon: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTRE + Math.cos(a) * rayon, CENTRE + Math.sin(a) * rayon];
}

/** Noir ou blanc selon la clarté du fond, pour que le label reste lisible. */
function contraste(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0f2a43" : "#ffffff";
}

/**
 * Une roue qui tourne et s'arrête sur un segment décidé d'avance.
 *
 * Le gagnant est connu au montage (il vient de l'état de partie, calculé par le
 * serveur) : la roue ne fait que révéler ce résultat en beauté. Elle tourne
 * plusieurs tours puis aligne le segment gagnant sous le repère du haut.
 */
export function Roue({ segments, gagnantIndex, onFini, taille = 260, duree = 3400 }: RoueProps) {
  const n = segments.length;
  const seg = 360 / n;
  // Cinq tours, puis on amène le centre du segment gagnant tout en haut.
  const cible = 360 * 5 - (gagnantIndex + 0.5) * seg;
  const [rotation, setRotation] = useState(0);
  const fini = useRef(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setRotation(cible));
    const fin = setTimeout(() => {
      if (fini.current) return;
      fini.current = true;
      onFini?.();
    }, duree + 60);
    return () => {
      cancelAnimationFrame(t);
      clearTimeout(fin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: taille, height: taille }} className="relative mx-auto">
      {/* Repère : le triangle qui pointe le segment gagnant. */}
      <div
        className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1"
        style={{
          width: 0,
          height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "12px solid transparent",
          borderTop: "20px solid #0f2a43",
          filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.25))",
        }}
      />
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: `transform ${duree}ms cubic-bezier(0.17, 0.67, 0.16, 1)`,
        }}
      >
        <circle cx={CENTRE} cy={CENTRE} r={R + 5} fill="#0f2a43" />
        {segments.map((s, i) => {
          const a0 = i * seg;
          const a1 = (i + 1) * seg;
          const [x0, y0] = pointSur(a0, R);
          const [x1, y1] = pointSur(a1, R);
          const grand = seg > 180 ? 1 : 0;
          const [lx, ly] = pointSur(a0 + seg / 2, R * 0.62);
          return (
            <g key={i}>
              <path
                d={`M ${CENTRE} ${CENTRE} L ${x0} ${y0} A ${R} ${R} 0 ${grand} 1 ${x1} ${y1} Z`}
                fill={s.couleur}
                stroke="#ffffff"
                strokeWidth={2}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${a0 + seg / 2} ${lx} ${ly})`}
                fontSize={n > 4 ? 11 : 13}
                fontWeight={800}
                fill={contraste(s.couleur)}
                style={{ pointerEvents: "none" }}
              >
                {s.label.length > 16 ? s.label.slice(0, 15) + "…" : s.label}
              </text>
            </g>
          );
        })}
        <circle cx={CENTRE} cy={CENTRE} r={12} fill="#ffffff" stroke="#0f2a43" strokeWidth={3} />
      </svg>
    </div>
  );
}
