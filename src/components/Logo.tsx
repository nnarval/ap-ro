"use client";

const COULEURS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];

function Mot({ texte, decalage }: { texte: string; decalage: number }) {
  return (
    <span className="flex">
      {[...texte].map((lettre, i) => (
        <span
          key={i}
          style={{
            color: COULEURS[(i + decalage) % COULEURS.length],
            textShadow: "0 2px 0 rgba(15,42,67,0.18), 0 0 1px #fff",
            transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 4}deg)`,
            display: "inline-block",
          }}
        >
          {lettre}
        </span>
      ))}
    </span>
  );
}

/** Le logo « apéro party », un mot par ligne, lettres arc-en-ciel. */
export function Logo({ taille = 56 }: { taille?: number }) {
  return (
    <div
      className="inline-flex flex-col items-center font-black leading-[0.9] select-none"
      style={{ fontSize: taille, letterSpacing: "-0.02em" }}
      aria-label="Apéro Party"
    >
      <Mot texte="apéro" decalage={0} />
      <Mot texte="party" decalage={3} />
    </div>
  );
}
