"use client";

/**
 * La carte plein écran qui annonce ce qui arrive au joueur : défi, malus,
 * boutique… Elle prend tout l'écran parce que c'est le moment où les gens
 * doivent lever les yeux du plateau et faire quelque chose.
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
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
        style={{ animation: "voile-entree 220ms ease-out both" }}
      />

      <div
        className="relative w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl"
        style={{
          animation: "carte-entree 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
          borderColor: couleur,
          background: `linear-gradient(160deg, ${couleur}22 0%, #0f172a 55%)`,
          boxShadow: `0 25px 60px -12px ${couleur}55`,
        }}
      >
        <div className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: couleur, animation: "halo 2.4s ease-in-out infinite" }}
          />
          <span
            className="relative flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: `${couleur}33`, border: `2px solid ${couleur}` }}
          >
            {icone}
          </span>
        </div>

        <div style={{ animation: "carte-contenu 380ms ease-out 140ms both" }}>
          <p
            className="text-xs font-bold tracking-[0.2em] uppercase"
            style={{ color: couleur }}
          >
            {surtitre}
          </p>
          <h2 className="mt-1 text-2xl leading-tight font-black text-slate-50">{titre}</h2>
          {consigne && <p className="mt-2 text-sm text-slate-300">{consigne}</p>}
        </div>

        {children && (
          <div className="mt-5 space-y-2" style={{ animation: "carte-contenu 380ms ease-out 240ms both" }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
