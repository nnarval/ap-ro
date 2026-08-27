"use client";

/**
 * La carte plein écran qui annonce ce qui arrive à l'équipe : défi, malus,
 * roulette, boutique… Elle prend tout l'écran parce que c'est le moment où les
 * gens doivent lever les yeux du plateau et faire quelque chose.
 */
export interface CarteAnnonceProps {
  /** Couleur du type de case, pour que la carte parle le même langage que le
   *  plateau. */
  couleur: string;
  icone: string;
  /** Petit mot au-dessus du titre : « DÉFI », « MALUS »… */
  surtitre: string;
  titre: string;
  /** La règle, lisible à voix haute. */
  consigne?: string;
  /** Les boutons d'action. */
  children?: React.ReactNode;
}

export function CarteAnnonce({
  couleur,
  icone,
  surtitre,
  titre,
  consigne,
  children,
}: CarteAnnonceProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${surtitre} : ${titre}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(15, 42, 67, 0.35)",
          backdropFilter: "blur(3px)",
          animation: "voile-entree 220ms ease-out both",
        }}
      />

      <div
        className="relative w-full max-w-sm rounded-[28px] bg-white p-6 text-center"
        style={{
          animation: "carte-entree 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
          border: `3px solid ${couleur}`,
          boxShadow: `0 24px 60px -12px ${couleur}66, 0 6px 20px rgba(15,42,67,0.15)`,
        }}
      >
        <div className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: couleur, animation: "halo 2.4s ease-in-out infinite" }}
          />
          <span
            className="relative flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: `${couleur}22`, border: `2px solid ${couleur}` }}
          >
            {icone}
          </span>
        </div>

        <div style={{ animation: "carte-contenu 380ms ease-out 140ms both" }}>
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase" style={{ color: couleur }}>
            {surtitre}
          </p>
          <h2 className="mt-1 text-2xl leading-tight font-black text-[#0f2a43]">{titre}</h2>
          {consigne && <p className="mt-2 text-sm text-[#5b7891]">{consigne}</p>}
        </div>

        {children && (
          <div
            className="mt-5 space-y-2"
            style={{ animation: "carte-contenu 380ms ease-out 240ms both" }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
